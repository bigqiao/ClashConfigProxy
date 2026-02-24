import { Router } from 'express';
import { dataService } from '../services/dataService';
import type { APIResponse, Scheme } from '../../../shared/dist/types';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
    try {
        const schemes = await dataService.loadSchemes(req.userId);
        const response: APIResponse<Scheme[]> = {
            success: true,
            data: schemes
        };
        res.json(response);
    } catch (error) {
        logger.error('获取方案列表失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '获取方案列表失败'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, description, enabled = true, configs = [], rules } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: '方案名称不能为空'
            });
        }

        const defaultRules = {
            deduplication: 'by_name' as const,
            nameConflictResolve: 'rename' as const,
            enabledOnly: true
        };

        const scheme = await dataService.createScheme(req.userId, {
            name: name.trim(),
            description: description || '',
            enabled,
            configs,
            rules: rules || defaultRules
        });

        const response: APIResponse<Scheme> = {
            success: true,
            data: scheme
        };
        res.status(201).json(response);
    } catch (error) {
        logger.error('创建方案失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '创建方案失败'
        });
    }
});

router.get('/:name', async (req, res) => {
    try {
        const scheme = await dataService.getScheme(req.userId, req.params.name);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                error: '方案不存在'
            });
        }

        const response: APIResponse<Scheme> = {
            success: true,
            data: scheme
        };
        res.json(response);
    } catch (error) {
        logger.error('获取方案失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '获取方案失败'
        });
    }
});

router.put('/:name', async (req, res) => {
    try {
        const { description, enabled, rules } = req.body;
        const updates: Record<string, any> = {};
        if (description !== undefined) updates.description = description;
        if (enabled !== undefined) updates.enabled = enabled;
        if (rules !== undefined) updates.rules = rules;
        const scheme = await dataService.updateScheme(req.userId, req.params.name, updates);

        const response: APIResponse<Scheme> = {
            success: true,
            data: scheme
        };
        res.json(response);
    } catch (error) {
        logger.error('更新方案失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '更新方案失败'
        });
    }
});

router.delete('/:name', async (req, res) => {
    try {
        await dataService.deleteScheme(req.userId, req.params.name);
        res.json({
            success: true,
            message: '方案删除成功'
        });
    } catch (error) {
        logger.error('删除方案失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '删除方案失败'
        });
    }
});

export { router as schemeRoutes };
