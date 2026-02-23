import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/authService';

const parseToken = (req: Request): string | null => {
    const authHeader = req.header('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        const bearerToken = authHeader.slice(7).trim();
        if (bearerToken) {
            return bearerToken;
        }
    }

    const queryToken = req.query.accessToken;
    if (typeof queryToken === 'string' && queryToken.trim()) {
        return queryToken.trim();
    }

    return null;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = parseToken(req);
        if (!token) {
            res.status(401).json({
                success: false,
                error: '未登录或登录已过期'
            });
            return;
        }

        const user = await authService.authenticate(token);
        if (!user) {
            res.status(401).json({
                success: false,
                error: '未登录或登录已过期'
            });
            return;
        }

        req.userId = user.id;
        req.authUser = user;
        req.authToken = token;
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '鉴权失败'
        });
    }
};
