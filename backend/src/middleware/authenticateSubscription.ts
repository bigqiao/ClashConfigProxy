import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/authService';

const parseSessionToken = (req: Request): string | null => {
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

const parseSubscriptionToken = (req: Request): string | null => {
    const queryToken = req.query.subscriptionToken;
    if (typeof queryToken === 'string' && queryToken.trim()) {
        return queryToken.trim();
    }

    const headerToken = req.header('x-subscription-token');
    if (headerToken && headerToken.trim()) {
        return headerToken.trim();
    }

    return null;
};

export const authenticateSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const sessionToken = parseSessionToken(req);
        if (sessionToken) {
            const sessionUser = await authService.authenticate(sessionToken);
            if (sessionUser) {
                req.userId = sessionUser.id;
                req.authUser = sessionUser;
                req.authToken = sessionToken;
                next();
                return;
            }
        }

        const subscriptionToken = parseSubscriptionToken(req);
        if (!subscriptionToken) {
            res.status(401).json({
                success: false,
                error: '无效的订阅凭证'
            });
            return;
        }

        const user = await authService.authenticateSubscriptionToken(subscriptionToken);
        if (!user) {
            res.status(401).json({
                success: false,
                error: '无效的订阅凭证'
            });
            return;
        }

        req.userId = user.id;
        req.authUser = user;
        next();
    } catch {
        res.status(500).json({
            success: false,
            error: '订阅鉴权失败'
        });
    }
};
