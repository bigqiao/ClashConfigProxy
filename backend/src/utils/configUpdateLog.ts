import type { Config, ConfigUpdateLogEntry } from '../../../shared/dist/types';
import type { ResolveConfigResult } from '../services/clashService';

export const UPDATE_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const UPDATE_LOG_MAX_ENTRIES = 100;

export const buildUpdateLog = (result: ResolveConfigResult): string => {
    if (result.success) {
        if (result.fromCache) {
            if (result.timedOut) {
                return '订阅更新超时(5秒)后已返回缓存，后台将在300秒内继续更新缓存';
            }
            return `订阅更新失败，已使用缓存: ${result.error || '未知错误'}`;
        }
        if (result.timedOut) {
            return '订阅更新成功（超过5秒后返回，并已刷新缓存）';
        }
        return '订阅更新成功';
    }
    return `订阅更新失败: ${result.error || '未知错误'}`;
};

export const buildUpdateLogLevel = (result: ResolveConfigResult): ConfigUpdateLogEntry['level'] => {
    if (result.success && !result.fromCache) {
        return 'success';
    }
    if (result.fromCache) {
        return 'cache';
    }
    return 'error';
};

export const appendUpdateLogs = (config: Config, now: Date, message: string, level: ConfigUpdateLogEntry['level']): ConfigUpdateLogEntry[] => {
    const cutoff = now.getTime() - UPDATE_LOG_RETENTION_MS;
    const currentLogs = Array.isArray(config.updateLogs) ? config.updateLogs : [];
    const filtered = currentLogs.filter((entry) => {
        if (!entry || typeof entry.time !== 'string') {
            return false;
        }
        const ts = new Date(entry.time).getTime();
        return Number.isFinite(ts) && ts >= cutoff;
    });

    return [
        { time: now.toISOString(), level, message },
        ...filtered,
    ].slice(0, UPDATE_LOG_MAX_ENTRIES);
};

export const applyConfigUpdateResult = (config: Config, result: ResolveConfigResult, now: Date): Config => {
    const message = buildUpdateLog(result);
    const next: Config = {
        ...config,
        status: result.success && !result.fromCache ? 'success' : 'error',
        lastFetch: now,
        updateLog: message,
        updateLogs: appendUpdateLogs(config, now, message, buildUpdateLogLevel(result)),
    };

    if (result.success && !result.fromCache) {
        delete next.error;
    } else {
        next.error = result.error || 'Unknown error';
    }

    return next;
};
