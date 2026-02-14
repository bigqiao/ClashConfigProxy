import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import { dataService } from '../services/dataService';
import { clashService } from '../services/clashService';
import type { APIResponse, Config } from '../../../shared/dist/types';
import { logger } from '../utils/logger';

const router = Router();

router.get('/schemes/:name/configs', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const response: APIResponse<Config[]> = {
            success: true,
            data: scheme.configs
        };
        res.json(response);
    } catch (error) {
        logger.error('获取配置列表失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '获取配置列表失败'
        });
    }
});

router.post('/schemes/:name/configs', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const { name, url, enabled = true } = req.body;
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const trimmedUrl = typeof url === 'string' ? url.trim() : '';

        if (!trimmedName || !trimmedUrl) {
            return res.status(400).json({
                success: false,
                error: '配置名称和URL不能为空'
            });
        }

        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            return res.status(400).json({
                success: false,
                error: 'URL必须以http://或https://开头'
            });
        }

        const newConfig: Config = {
            id: uuidv4(),
            name: trimmedName,
            url: trimmedUrl,
            enabled,
            status: 'pending'
        };

        const updatedConfigs = [...scheme.configs, newConfig];
        await dataService.updateScheme(req.params.name, { configs: updatedConfigs });

        const response: APIResponse<Config> = {
            success: true,
            data: newConfig
        };
        res.status(201).json(response);
    } catch (error) {
        logger.error('添加配置失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '添加配置失败'
        });
    }
});

router.put('/schemes/:name/configs/:id', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const configIndex = scheme.configs.findIndex(c => c.id === req.params.id);
        if (configIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }

        const { name, url, enabled } = req.body;
        const updates: Partial<Config> = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    error: '配置名称不能为空'
                });
            }
            updates.name = name.trim();
        }

        if (url !== undefined) {
            if (typeof url !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'URL格式无效'
                });
            }

            const trimmedUrl = url.trim();
            if (!trimmedUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'URL不能为空'
                });
            }

            if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
                return res.status(400).json({
                    success: false,
                    error: 'URL必须以http://或https://开头'
                });
            }
            updates.url = trimmedUrl;
        }

        if (enabled !== undefined) {
            if (typeof enabled !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'enabled必须是布尔值'
                });
            }
            updates.enabled = enabled;
        }

        const updatedConfig = {
            ...scheme.configs[configIndex],
            ...updates
        };

        const updatedConfigs = [...scheme.configs];
        updatedConfigs[configIndex] = updatedConfig;

        await dataService.updateScheme(req.params.name, { configs: updatedConfigs });

        const response: APIResponse<Config> = {
            success: true,
            data: updatedConfig
        };
        res.json(response);
    } catch (error) {
        logger.error('更新配置失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '更新配置失败'
        });
    }
});

router.delete('/schemes/:name/configs/:id', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const configIndex = scheme.configs.findIndex(c => c.id === req.params.id);
        if (configIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }

        const updatedConfigs = scheme.configs.filter(c => c.id !== req.params.id);
        await dataService.updateScheme(req.params.name, { configs: updatedConfigs });

        res.json({
            success: true,
            message: '配置删除成功'
        });
    } catch (error) {
        logger.error('删除配置失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '删除配置失败'
        });
    }
});

router.get('/schemes/:name/configs/:id/preview', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const config = scheme.configs.find(c => c.id === req.params.id);
        if (!config) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }

        const result = await clashService.fetchConfig(config.url);
        if (!result.success || !result.config) {
            return res.status(500).json({
                success: false,
                error: result.error || '获取配置失败'
            });
        }

        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.send(yaml.dump(result.config));
    } catch (error) {
        logger.error('预览配置失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '预览配置失败'
        });
    }
});

router.post('/schemes/:name/configs/:id/refresh', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const configIndex = scheme.configs.findIndex(c => c.id === req.params.id);
        if (configIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }

        const config = scheme.configs[configIndex];
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

        const updatedConfigs = [...scheme.configs];
        updatedConfigs[configIndex] = updatedConfig;

        await dataService.updateScheme(req.params.name, { configs: updatedConfigs });

        const response: APIResponse<Config> = {
            success: true,
            data: updatedConfig
        };
        res.json(response);
    } catch (error) {
        logger.error('刷新配置失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '刷新配置失败'
        });
    }
});

export { router as configRoutes };
