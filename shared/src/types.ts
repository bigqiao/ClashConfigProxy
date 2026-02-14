export interface Config {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    lastFetch?: Date;
    status: 'success' | 'error' | 'pending';
    error?: string;
}

export interface AggregateRule {
    deduplication: 'by_name' | 'by_server' | 'none';
    nameConflictResolve: 'rename' | 'skip' | 'override';
    enabledOnly: boolean;
    regionGrouping?: boolean;
    regionGroupMode?: 'select' | 'url-test';
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