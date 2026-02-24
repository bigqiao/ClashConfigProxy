import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

interface BruteForceGuardOptions {
    windowMs: number;
    maxFailures: number;
    blockMs: number;
    staleMs: number;
}

interface AttemptEntry {
    failures: number[];
    blockedUntil: number;
    lastSeen: number;
}

const DEFAULT_OPTIONS: BruteForceGuardOptions = {
    windowMs: 10 * 60 * 1000,
    maxFailures: 5,
    blockMs: 15 * 60 * 1000,
    staleMs: 30 * 60 * 1000
};

const normalizeUsername = (username: unknown): string | null => {
    if (typeof username !== 'string') {
        return null;
    }
    const value = username.trim().toLowerCase();
    return value.length > 0 ? value : null;
};

export class BruteForceGuard {
    private readonly attempts = new Map<string, AttemptEntry>();
    private readonly options: BruteForceGuardOptions;

    constructor(options?: Partial<BruteForceGuardOptions>) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
    }

    guard = (req: Request, res: Response, next: NextFunction): void => {
        const keys = this.getKeys(req);
        const now = Date.now();

        for (const key of keys) {
            if (this.isBlocked(key, now)) {
                logger.warn(`Brute force blocked: ${key}`);
                res.status(429).json({
                    success: false,
                    error: '请求过于频繁，请稍后再试'
                });
                return;
            }
        }

        next();
    };

    onSuccess(req: Request): void {
        const keys = this.getKeys(req);
        for (const key of keys) {
            this.attempts.delete(key);
        }
    }

    onFailure(req: Request): void {
        const keys = this.getKeys(req);
        const now = Date.now();

        for (const key of keys) {
            const entry = this.getOrCreate(key, now);
            entry.failures = entry.failures.filter(ts => now - ts <= this.options.windowMs);
            entry.failures.push(now);
            entry.lastSeen = now;

            if (entry.failures.length >= this.options.maxFailures) {
                entry.blockedUntil = now + this.options.blockMs;
                logger.warn(`Brute force lock triggered: ${key}, count=${entry.failures.length}`);
            }
        }

        this.cleanup(now);
    }

    private getKeys(req: Request): string[] {
        const username = normalizeUsername((req.body as Record<string, unknown> | undefined)?.username);
        const keys: string[] = [];
        if (username) {
            keys.push(`user:${username}`);
        }
        return keys;
    }

    private getOrCreate(key: string, now: number): AttemptEntry {
        const existing = this.attempts.get(key);
        if (existing) {
            return existing;
        }
        const entry: AttemptEntry = {
            failures: [],
            blockedUntil: 0,
            lastSeen: now
        };
        this.attempts.set(key, entry);
        return entry;
    }

    private isBlocked(key: string, now: number): boolean {
        const entry = this.attempts.get(key);
        if (!entry) {
            return false;
        }

        if (entry.blockedUntil > now) {
            entry.lastSeen = now;
            return true;
        }

        entry.failures = entry.failures.filter(ts => now - ts <= this.options.windowMs);
        entry.lastSeen = now;
        return false;
    }

    private cleanup(now: number): void {
        for (const [key, entry] of this.attempts.entries()) {
            const expiredBlock = entry.blockedUntil > 0 && entry.blockedUntil <= now;
            if (expiredBlock) {
                entry.blockedUntil = 0;
            }

            const stale = now - entry.lastSeen > this.options.staleMs;
            const empty = entry.failures.length === 0 && entry.blockedUntil === 0;
            if (stale || empty) {
                this.attempts.delete(key);
            }
        }
    }
}

export const bruteForceGuard = new BruteForceGuard();
