export interface Config {
    id: string;
    name: string;
    sourceType?: 'url' | 'custom';
    url?: string;
    customProxy?: ClashProxy;
    enabled: boolean;
    lastFetch?: Date;
    status: 'success' | 'error' | 'pending';
    error?: string;
}

export interface AppRouteRule {
    appName: string;              // 应用名或分类名
    group: string;                // 代理组
    type?: 'app' | 'category';   // 默认 'app'（向后兼容）
}

export interface AvailableApp {
    name: string;
    defaultGroup?: string;
}

export interface AggregateRule {
    deduplication: 'by_name' | 'by_server' | 'none';
    nameConflictResolve: 'rename' | 'skip' | 'override';
    enabledOnly: boolean;
    regionGrouping?: boolean;
    regionGroupMode?: 'select' | 'url-test' | 'fallback';
    appRules?: AppRouteRule[];
}

export interface Scheme {
    name: string;
    description: string;
    enabled: boolean;
    configs: Config[];
    rules: AggregateRule;
    createdAt: Date;
    updatedAt: Date;
}

export interface ClashProxy {
    name: string;
    type: string;
    server: string;
    port: number;
    [key: string]: any;
}

export interface ClashProxyGroup {
    name: string;
    type: string;
    proxies: string[];
    [key: string]: any;
}

export interface ClashRule {
    type: string;
    payload: string;
    proxy: string;
}

export interface ClashConfig {
    proxies: ClashProxy[];
    'proxy-groups': ClashProxyGroup[];
    rules: string[];
    [key: string]: any;
}

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface AuthUser {
    id: string;
    username: string;
    createdAt: Date;
}
