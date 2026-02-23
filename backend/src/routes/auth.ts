import { Router } from 'express';
import type { APIResponse, AuthUser } from '../../../shared/dist/types';
import { authenticate } from '../middleware/authenticate';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';

const router = Router();

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body as { username?: string; password?: string };
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: '用户名和密码不能为空'
            });
        }

        const result = await authService.register(username, password);
        const response: APIResponse<{ token: string; user: AuthUser }> = {
            success: true,
            data: result
        };
        res.status(201).json(response);
    } catch (error) {
        logger.error('注册失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '注册失败'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body as { username?: string; password?: string };
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: '用户名和密码不能为空'
            });
        }

        const result = await authService.login(username, password);
        const response: APIResponse<{ token: string; user: AuthUser }> = {
            success: true,
            data: result
        };
        res.json(response);
    } catch (error) {
        logger.error('登录失败:', error as Error);
        res.status(401).json({
            success: false,
            error: (error as Error).message || '登录失败'
        });
    }
});

router.get('/me', authenticate, async (req, res) => {
    const response: APIResponse<AuthUser> = {
        success: true,
        data: req.authUser
    };
    res.json(response);
});

router.post('/logout', authenticate, async (req, res) => {
    try {
        if (req.authToken) {
            await authService.logout(req.authToken);
        }
        const response: APIResponse = {
            success: true,
            message: '已退出登录'
        };
        res.json(response);
    } catch (error) {
        logger.error('退出登录失败:', error as Error);
        res.status(500).json({
            success: false,
            error: '退出登录失败'
        });
    }
});

router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: '旧密码和新密码不能为空'
            });
        }

        if (!req.authUser) {
            return res.status(401).json({
                success: false,
                error: '未登录或登录已过期'
            });
        }

        await authService.changePassword(req.authUser.id, oldPassword, newPassword, req.authToken);
        const response: APIResponse = {
            success: true,
            message: '密码修改成功'
        };
        res.json(response);
    } catch (error) {
        logger.error('修改密码失败:', error as Error);
        res.status(400).json({
            success: false,
            error: (error as Error).message || '修改密码失败'
        });
    }
});

export { router as authRoutes };
