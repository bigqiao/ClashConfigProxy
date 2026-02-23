import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import { dataService } from '../services/dataService';
import { clashService } from '../services/clashService';
import type { APIResponse, Config, ClashProxy } from '../../../shared/dist/types';
import { logger } from '../utils/logger';

const router = Router();
const DEFAULT_SOURCE_TYPE: NonNullable<Config['sourceType']> = 'url';

const isValidProxy = (proxy: unknown): proxy is ClashProxy => {
    if (!proxy || typeof proxy !== 'object') {
        return false;
    }

    const value = proxy as Partial<ClashProxy>;
    return typeof value.name === 'string'
        && value.name.trim().length > 0
        && typeof value.type === 'string'
        && value.type.trim().length > 0
        && typeof value.server === 'string'
        && value.server.trim().length > 0
        && typeof value.port === 'number'
        && Number.isFinite(value.port);
};

const normalizeSourceType = (sourceType: unknown): NonNullable<Config['sourceType']> => {
    if (sourceType === 'custom') {
        return 'custom';
    }
    return DEFAULT_SOURCE_TYPE;
};

const buildConfigPayload = (payload: Record<string, unknown>): { success: true; data: Pick<Config, 'name' | 'sourceType' | 'url' | 'customProxy' | 'enabled' | 'status' | 'lastFetch'> } | { success: false; error: string } => {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
        return { success: false, error: '配置名称不能为空' };
    }

    const sourceType = normalizeSourceType(payload.sourceType);
    const enabled = payload.enabled === undefined ? true : payload.enabled;
    if (typeof enabled !== 'boolean') {
        return { success: false, error: 'enabled必须是布尔值' };
    }

    if (sourceType === 'custom') {
        if (!isValidProxy(payload.customProxy)) {
            return {
                success: false,
                error: '自定义节点格式无效，需要包含 name/type/server/port'
            };
        }

        return {
            success: true,
            data: {
                name,
                sourceType,
                customProxy: payload.customProxy,
                enabled,
                status: 'success',
                lastFetch: new Date()
            }
        };
    }

    const url = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!url) {
        return { success: false, error: '配置URL不能为空' };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { success: false, error: 'URL必须以http://或https://开头' };
    }

    return {
        success: true,
        data: {
            name,
            sourceType,
            url,
            enabled,
            status: 'pending'
        }
    };
};

router.get('/schemes/:name/configs', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.userId, req.params.name);
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
        const scheme = await dataService.getScheme(req.userId, req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const built = buildConfigPayload(req.body as Record<string, unknown>);
        if (!built.success) {
            return res.status(400).json({
                success: false,
                error: built.error
            });
        }

        const newConfig: Config = {
            id: uuidv4(),
            ...built.data
        };

        const updatedConfigs = [...scheme.configs, newConfig];
        await dataService.updateScheme(req.userId, req.params.name, { configs: updatedConfigs });

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
        const scheme = await dataService.getScheme(req.userId, req.params.name);
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

        const { name, url, enabled, sourceType, customProxy } = req.body as Record<string, unknown>;
        const updates: Partial<Config> = {};
        const currentConfig = scheme.configs[configIndex];
        const currentSourceType = normalizeSourceType(currentConfig.sourceType);
        const targetSourceType = sourceType === undefined
            ? currentSourceType
            : normalizeSourceType(sourceType);

        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    error: '配置名称不能为空'
                });
            }
            updates.name = name.trim();
        }

        updates.sourceType = targetSourceType;
        if (targetSourceType === 'url') {
            if (url !== undefined && typeof url !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'URL格式无效'
                });
            }

            const urlToUse = url !== undefined
                ? url.trim()
                : (currentConfig.url || '').trim();
            const trimmedUrl = urlToUse;
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
            updates.customProxy = undefined;
            const changedToUrl = currentSourceType !== 'url';
            const changedUrl = trimmedUrl !== (currentConfig.url || '').trim();
            updates.status = changedToUrl || changedUrl ? 'pending' : currentConfig.status;
            if (updates.status !== 'success') {
                updates.lastFetch = undefined;
                updates.error = undefined;
            }
        } else {
            const proxyToUse = customProxy !== undefined
                ? customProxy
                : currentConfig.customProxy;
            if (!isValidProxy(proxyToUse)) {
                return res.status(400).json({
                    success: false,
                    error: '自定义节点格式无效，需要包含 name/type/server/port'
                });
            }
            updates.customProxy = proxyToUse;
            updates.url = undefined;
            updates.status = 'success';
            updates.error = undefined;
            updates.lastFetch = new Date();
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

        await dataService.updateScheme(req.userId, req.params.name, { configs: updatedConfigs });

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
        const scheme = await dataService.getScheme(req.userId, req.params.name);
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
        await dataService.updateScheme(req.userId, req.params.name, { configs: updatedConfigs });

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
        const scheme = await dataService.getScheme(req.userId, req.params.name);
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

        const result = await clashService.resolveConfig(req.userId, config);
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
        const scheme = await dataService.getScheme(req.userId, req.params.name);
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
        const result = await clashService.resolveConfig(req.userId, config);

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

        await dataService.updateScheme(req.userId, req.params.name, { configs: updatedConfigs });

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
