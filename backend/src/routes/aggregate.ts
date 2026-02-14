import { Router } from 'express';
import yaml from 'js-yaml';
import { dataService } from '../services/dataService';
import { clashService } from '../services/clashService';
import type { APIResponse } from '../../../shared/dist/types';
import { logger } from '../utils/logger';

const router = Router();

router.get('/schemes/:name/clash', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
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

        const aggregatedConfig = await clashService.aggregateConfigs(scheme);

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

router.get('/schemes/:name/nodes', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
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

        const aggregatedConfig = await clashService.aggregateConfigs(scheme);

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
        const scheme = await dataService.getScheme(req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const refreshPromises = scheme.configs.map(async (config) => {
            const result = await clashService.fetchConfig(config.url);
            const updatedConfig = {
                ...config,
                status: result.success ? 'success' as const : 'error' as const,
                lastFetch: new Date()
            };
            if (result.success) {
                delete updatedConfig.error;
            } else {
                updatedConfig.error = result.error || 'Unknown error';
            }
            return updatedConfig;
        });

        const updatedConfigs = await Promise.all(refreshPromises);
        await dataService.updateScheme(req.params.name, { configs: updatedConfigs });

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
        const schemes = await dataService.loadSchemes();
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

export { router as aggregateRoutes };
