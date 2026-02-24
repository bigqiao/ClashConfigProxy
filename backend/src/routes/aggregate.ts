import { Router } from 'express';
import yaml from 'js-yaml';
import { dataService } from '../services/dataService';
import { clashService } from '../services/clashService';
import { appRuleService, APP_GROUPS } from '../services/appRuleService';
import type { APIResponse, AvailableApp, Config } from '../../../shared/dist/types';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/authenticate';
import { authenticateSubscription } from '../middleware/authenticateSubscription';
import { applyConfigUpdateResult } from '../utils/configUpdateLog';

const router = Router();

router.get('/schemes/:name/clash', authenticateSubscription, async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.userId, req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        if (!scheme.enabled) {
            return res.status(400).json({
                success: false,
                error: '方案已禁用'
            });
        }

        const { aggregatedConfig, resolvedConfigs } = await clashService.aggregateConfigsWithResults(req.userId, scheme);
        const now = new Date();
        const resultMap = new Map(resolvedConfigs.map(({ config, result }) => [config.id, result]));
        const updatedConfigs = scheme.configs.map((config) => {
            const result = resultMap.get(config.id);
            if (!result) {
                return config;
            }
            return applyConfigUpdateResult(config, result, now);
        });
        await dataService.updateScheme(req.userId, req.params.name, { configs: updatedConfigs });

        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.send(yaml.dump(aggregatedConfig));
    } catch (error) {
        logger.error('生成聚合配置失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '生成聚合配置失败'
        });
    }
});

router.use(authenticate);

router.get('/schemes/:name/nodes', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.userId, req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }
        if (!scheme.enabled) {
            return res.status(400).json({
                success: false,
                error: '方案已禁用'
            });
        }

        const aggregatedConfig = await clashService.aggregateConfigs(req.userId, scheme);

        const response: APIResponse<{ proxies: any[]; groups: any[] }> = {
            success: true,
            data: {
                proxies: aggregatedConfig.proxies,
                groups: aggregatedConfig['proxy-groups']
            }
        };
        res.json(response);
    } catch (error) {
        logger.error('获取节点列表失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '获取节点列表失败'
        });
    }
});

router.post('/schemes/:name/refresh-all', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.userId, req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const refreshPromises = scheme.configs.map(async (config) => {
            const result = await clashService.resolveConfig(req.userId, config);
            return applyConfigUpdateResult(config, result, new Date());
        });

        const updatedConfigs = await Promise.all(refreshPromises);
        await dataService.updateScheme(req.userId, req.params.name, { configs: updatedConfigs });

        const response: APIResponse<{ refreshed: number; failed: number }> = {
            success: true,
            data: {
                refreshed: updatedConfigs.filter(c => c.status === 'success').length,
                failed: updatedConfigs.filter(c => c.status === 'error').length
            }
        };
        res.json(response);
    } catch (error) {
        logger.error('批量刷新配置失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '批量刷新配置失败'
        });
    }
});

router.get('/status', async (req, res) => {
    try {
        const schemes = await dataService.loadSchemes(req.userId);
        const totalConfigs = schemes.reduce((sum, scheme) => sum + scheme.configs.length, 0);
        const enabledSchemes = schemes.filter(s => s.enabled).length;

        const response: APIResponse<{
            totalSchemes: number;
            enabledSchemes: number;
            totalConfigs: number;
        }> = {
            success: true,
            data: {
                totalSchemes: schemes.length,
                enabledSchemes,
                totalConfigs
            }
        };
        res.json(response);
    } catch (error) {
        logger.error('获取系统状态失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '获取系统状态失败'
        });
    }
});

router.get('/available-apps', async (req, res) => {
    try {
        const apps = await appRuleService.getAvailableApps(req.userId);
        const customGroups = await appRuleService.getCustomGroups(req.userId);
        const groups = [...APP_GROUPS, ...customGroups];
        const response: APIResponse<{ apps: AvailableApp[]; groups: string[] }> = {
            success: true,
            data: { apps, groups }
        };
        res.json(response);
    } catch (error) {
        logger.error('获取可用应用列表失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '获取可用应用列表失败'
        });
    }
});

router.get('/app-categories', async (req, res) => {
    try {
        const apps = await appRuleService.getAvailableApps(req.userId);
        const overrides = await appRuleService.getCategoryOverrides(req.userId);
        const customGroups = await appRuleService.getCustomGroups(req.userId);
        // 构建完整的应用→分类映射
        const mapping: Record<string, string> = {};
        for (const app of apps) {
            if (app.defaultGroup) {
                mapping[app.name] = app.defaultGroup;
            }
        }
        const groups = [...APP_GROUPS, ...customGroups];
        const response: APIResponse<{ mapping: Record<string, string>; overrides: Record<string, string>; groups: string[]; customGroups: string[] }> = {
            success: true,
            data: { mapping, overrides, groups, customGroups }
        };
        res.json(response);
    } catch (error) {
        logger.error('获取应用分类失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '获取应用分类失败'
        });
    }
});

router.put('/app-categories', async (req, res) => {
    try {
        const { overrides, customGroups } = req.body;
        if (!overrides || typeof overrides !== 'object') {
            return res.status(400).json({
                success: false,
                error: '请求体需要 overrides 字段'
            });
        }
        await appRuleService.updateCategoryOverrides(req.userId, overrides, customGroups);
        const response: APIResponse = {
            success: true,
            message: '应用分类已更新'
        };
        res.json(response);
    } catch (error) {
        logger.error('更新应用分类失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '更新应用分类失败'
        });
    }
});

router.post('/available-apps/refresh', async (req, res) => {
    try {
        const apps = await appRuleService.refresh(req.userId);
        const customGroups = await appRuleService.getCustomGroups(req.userId);
        const groups = [...APP_GROUPS, ...customGroups];
        const response: APIResponse<{ apps: AvailableApp[]; groups: string[]; count: number }> = {
            success: true,
            data: { apps, groups, count: apps.length }
        };
        res.json(response);
    } catch (error) {
        logger.error('刷新可用应用列表失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '刷新可用应用列表失败'
        });
    }
});

export { router as aggregateRoutes };
