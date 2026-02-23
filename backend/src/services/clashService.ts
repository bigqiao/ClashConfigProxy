import axios from 'axios';
import yaml from 'js-yaml';
import path from 'path';
import { promises as fs } from 'fs';
import type { ClashConfig, ClashProxy, Scheme, AppRouteRule, Config } from '../../../shared/dist/types';
import { logger } from '../utils/logger';
import { AppRuleService, APP_GROUPS, appRuleService } from './appRuleService';

const REGION_PATTERNS: { name: string; emoji: string; pattern: RegExp }[] = [
    { name: '香港', emoji: '🇭🇰', pattern: /香港|HK|Hong\s*Kong/i },
    { name: '台湾', emoji: '🇹🇼', pattern: /台湾|TW|Taiwan/i },
    { name: '日本', emoji: '🇯🇵', pattern: /日本|JP|Japan/i },
    { name: '新加坡', emoji: '🇸🇬', pattern: /新加坡|SG|Singapore/i },
    { name: '美国', emoji: '🇺🇸', pattern: /美国|US|United\s*States/i },
    { name: '韩国', emoji: '🇰🇷', pattern: /韩国|KR|Korea/i },
    { name: '英国', emoji: '🇬🇧', pattern: /英国|UK|United\s*Kingdom/i },
    { name: '德国', emoji: '🇩🇪', pattern: /德国|DE|Germany/i },
    { name: '法国', emoji: '🇫🇷', pattern: /法国|FR|France/i },
    { name: '加拿大', emoji: '🇨🇦', pattern: /加拿大|CA|Canada/i },
    { name: '澳大利亚', emoji: '🇦🇺', pattern: /澳大利亚|澳洲|AU|Australia/i },
    { name: '印度', emoji: '🇮🇳', pattern: /印度|IN|India/i },
    { name: '俄罗斯', emoji: '🇷🇺', pattern: /俄罗斯|RU|Russia/i },
    { name: '土耳其', emoji: '🇹🇷', pattern: /土耳其|TR|Turkey|Türkiye/i },
    { name: '阿根廷', emoji: '🇦🇷', pattern: /阿根廷|AR|Argentina/i },
    { name: '巴西', emoji: '🇧🇷', pattern: /巴西|BR|Brazil/i },
    { name: '泰国', emoji: '🇹🇭', pattern: /泰国|TH|Thailand/i },
    { name: '印尼', emoji: '🇮🇩', pattern: /印尼|印度尼西亚|ID|Indonesia/i },
    { name: '菲律宾', emoji: '🇵🇭', pattern: /菲律宾|PH|Philippines/i },
    { name: '马来西亚', emoji: '🇲🇾', pattern: /马来西亚|MY|Malaysia/i },
];
const UNCATEGORIZED_GROUP_LABEL = '📦 未分类';
const UNCATEGORIZED_GROUP_KEY = '__uncategorized__';
const USER_DATA_ROOT = path.join(process.cwd(), 'data', 'users');

export class ClashService {
    private normalizePolicyTarget(group: string): string {
        if (group === '🎯 全球直连') return 'DIRECT';
        if (group === '🛑 全球拦截') return 'REJECT';
        return group;
    }

    async fetchConfig(url: string): Promise<{ success: boolean; config?: ClashConfig; error?: string }> {
        try {
            const response = await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'clash-config-proxy/1.0.0'
                }
            });

            let config: ClashConfig;
            const contentType = response.headers['content-type'] || '';

            if (contentType.includes('application/json')) {
                config = response.data;
            } else {
                config = yaml.load(response.data) as ClashConfig;
            }

            if (!config.proxies || !Array.isArray(config.proxies)) {
                throw new Error('Invalid Clash config: missing or invalid proxies');
            }

            return { success: true, config };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to fetch config from ${url}:`, error as Error);
            return { success: false, error: errorMessage };
        }
    }

    async fetchConfigWithCache(userId: string, config: Config): Promise<{ success: boolean; config?: ClashConfig; error?: string; fromCache?: boolean }> {
        const url = (config.url || '').trim();
        if (!url) {
            return { success: false, error: '配置URL为空' };
        }

        const liveResult = await this.fetchConfig(url);
        if (liveResult.success && liveResult.config) {
            await this.saveConfigCache(userId, config.id, liveResult.config);
            return { ...liveResult, fromCache: false };
        }

        const cachedConfig = await this.loadConfigCache(userId, config.id);
        if (cachedConfig) {
            logger.warn(`Using cached config for ${config.name} (${config.id}) due to fetch failure: ${liveResult.error}`);
            return { success: true, config: cachedConfig, fromCache: true, error: liveResult.error };
        }

        return liveResult;
    }

    async resolveConfig(userId: string, config: Config): Promise<{ success: boolean; config?: ClashConfig; error?: string; fromCache?: boolean }> {
        if (config.sourceType === 'custom') {
            if (!config.customProxy) {
                return { success: false, error: '自定义节点为空' };
            }
            return {
                success: true,
                config: {
                    proxies: [config.customProxy],
                    'proxy-groups': [],
                    rules: [],
                }
            };
        }

        return this.fetchConfigWithCache(userId, config);
    }

    async aggregateConfigs(userId: string, scheme: Scheme): Promise<ClashConfig> {
        const enabledOnly = scheme.rules?.enabledOnly ?? true;
        const targetConfigs = enabledOnly ? scheme.configs.filter(c => c.enabled) : scheme.configs;
        const allProxies: ClashProxy[] = [];

        const results = await Promise.all(
            targetConfigs.map(async (config) => ({
                config,
                result: await this.resolveConfig(userId, config)
            }))
        );

        for (const { config, result } of results) {
            if (result.success && result.config) {
                this.mergeProxies(allProxies, result.config.proxies, scheme.rules, config.name);
            }
        }

        const appRules = scheme.rules?.appRules || [];
        const { ruleProviders, appRuleEntries, appGroupNames } = await this.buildAppRules(userId, appRules);

        const config: ClashConfig = {
            'mixed-port': 7890,
            'allow-lan': false,
            'bind-address': '*',
            mode: 'rule',
            'log-level': 'info',
            'ipv6': false,
            'external-controller': '127.0.0.1:9090',
            proxies: allProxies,
            'proxy-groups': this.generateProxyGroups(allProxies, scheme.rules, appGroupNames),
            rules: [...appRuleEntries, 'MATCH,DIRECT'],
        };

        if (Object.keys(ruleProviders).length > 0) {
            config['rule-providers'] = ruleProviders;
        }

        return config;
    }

    private mergeProxies(
        allProxies: ClashProxy[],
        newProxies: ClashProxy[],
        rules: Scheme['rules'],
        sourceName: string
    ): void {
        for (const proxy of newProxies) {
            const existingIndex = this.findExistingProxy(allProxies, proxy, rules.deduplication);
            const hasNameConflict = allProxies.some(existing => existing.name === proxy.name);

            if (existingIndex !== -1) {
                if (rules.nameConflictResolve === 'skip') {
                    continue;
                } else if (rules.nameConflictResolve === 'override') {
                    allProxies[existingIndex] = proxy;
                    continue;
                }
            }

            let finalName = proxy.name;
            if (rules.nameConflictResolve === 'rename' && (existingIndex !== -1 || hasNameConflict)) {
                finalName = this.generateUniqueName(allProxies, proxy.name, sourceName);
            }

            allProxies.push({
                ...proxy,
                name: finalName
            });
        }
    }

    private findExistingProxy(
        allProxies: ClashProxy[],
        proxy: ClashProxy,
        deduplication: 'by_name' | 'by_server' | 'none'
    ): number {
        if (deduplication === 'none') {
            return -1;
        }

        return allProxies.findIndex(existing => {
            if (deduplication === 'by_name') {
                return existing.name === proxy.name;
            } else if (deduplication === 'by_server') {
                return existing.server === proxy.server && existing.port === proxy.port;
            }
            return false;
        });
    }

    private generateUniqueName(allProxies: ClashProxy[], originalName: string, sourceName: string): string {
        const baseName = `${originalName}[${sourceName}]`;
        let counter = 1;
        let uniqueName = baseName;

        while (allProxies.some(p => p.name === uniqueName)) {
            uniqueName = `${baseName}_${counter}`;
            counter++;
        }

        return uniqueName;
    }

    private async saveConfigCache(userId: string, configId: string, config: ClashConfig): Promise<void> {
        try {
            const cachePath = this.getCachePath(userId, configId);
            await fs.mkdir(path.dirname(cachePath), { recursive: true });
            await fs.writeFile(cachePath, JSON.stringify(config), 'utf8');
        } catch (error) {
            logger.warn(`Failed to save cache for config ${configId}: ${(error as Error).message}`);
        }
    }

    private async loadConfigCache(userId: string, configId: string): Promise<ClashConfig | null> {
        try {
            const cachePath = this.getCachePath(userId, configId);
            const content = await fs.readFile(cachePath, 'utf8');
            const parsed = JSON.parse(content) as ClashConfig;
            if (!parsed.proxies || !Array.isArray(parsed.proxies)) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    private getCachePath(userId: string, configId: string): string {
        return path.join(USER_DATA_ROOT, userId, 'cache', `${configId}.json`);
    }

    private classifyProxiesByRegion(proxies: ClashProxy[]): { regionGroups: Map<string, string[]>; unmatched: string[] } {
        const regionGroups = new Map<string, string[]>();
        const unmatched: string[] = [];

        for (const proxy of proxies) {
            const region = REGION_PATTERNS.find(r => r.pattern.test(proxy.name));
            if (region) {
                const groupName = `${region.emoji} ${region.name}`;
                if (!regionGroups.has(groupName)) {
                    regionGroups.set(groupName, []);
                }
                regionGroups.get(groupName)!.push(proxy.name);
            } else {
                unmatched.push(proxy.name);
            }
        }

        return { regionGroups, unmatched };
    }

    private async buildAppRules(userId: string, appRules: AppRouteRule[]): Promise<{
        ruleProviders: Record<string, any>;
        appRuleEntries: string[];
        appGroupNames: string[];
    }> {
        const ruleProviders: Record<string, any> = {};
        const appRuleEntries: string[] = [];
        // 收集实际使用的代理组名称（去重、保序）
        const groupSet = new Set<string>();

        // 先收集所有应用级规则的 appName，用于分类展开时跳过
        const appLevelNames = new Set<string>();
        for (const rule of appRules) {
            if (rule.type !== 'category') {
                appLevelNames.add(rule.appName);
            }
        }

        // 获取可用应用列表，用于展开分类规则
        const availableApps = await appRuleService.getAvailableApps(userId);

        for (const rule of appRules) {
            if (rule.type === 'category') {
                const ruleTarget = this.normalizePolicyTarget(rule.group);
                // 分类规则：展开为该分类下所有应用
                const isUncategorizedRule = rule.appName === UNCATEGORIZED_GROUP_LABEL || rule.appName === UNCATEGORIZED_GROUP_KEY;
                const appsInCategory = availableApps.filter(a => {
                    if (isUncategorizedRule) return !a.defaultGroup;
                    return a.defaultGroup === rule.appName;
                });
                for (const app of appsInCategory) {
                    // 应用级规则优先：跳过已有应用级规则的 app
                    if (appLevelNames.has(app.name)) continue;
                    ruleProviders[app.name] = {
                        type: 'http',
                        behavior: 'classical',
                        url: AppRuleService.getRuleUrl(app.name),
                        path: `./ruleset/${app.name}.yaml`,
                        interval: 86400,
                    };
                    appRuleEntries.push(`RULE-SET,${app.name},${ruleTarget}`);
                }
                groupSet.add(ruleTarget);
            } else {
                // 应用级规则：保持原有逻辑
                const ruleTarget = this.normalizePolicyTarget(rule.appName);
                ruleProviders[rule.appName] = {
                    type: 'http',
                    behavior: 'classical',
                    url: AppRuleService.getRuleUrl(rule.appName),
                    path: `./ruleset/${rule.appName}.yaml`,
                    interval: 86400,
                };
                appRuleEntries.push(`RULE-SET,${rule.appName},${ruleTarget}`);
                groupSet.add(ruleTarget);
            }
        }

        return {
            ruleProviders,
            appRuleEntries,
            appGroupNames: [...groupSet],
        };
    }

    private generateProxyGroups(allProxies: ClashProxy[], rules?: Scheme['rules'], appGroupNames?: string[]): any[] {
        const proxyNames = allProxies.map(p => p.name);
        const useRegionGrouping = rules?.regionGrouping ?? false;
        const regionGroupMode = rules?.regionGroupMode ?? 'select';
        let regionProxyGroups: any[] = [];

        let defaultGroups: any[];

        if (useRegionGrouping) {
            const { regionGroups, unmatched } = this.classifyProxiesByRegion(allProxies);

            // 创建地域代理组
            const regionGroupNames: string[] = [];

            for (const [groupName, members] of regionGroups) {
                regionGroupNames.push(groupName);
                const urlTestGroupName = `${groupName} · URLTest`;
                const fallbackGroupName = `${groupName} · Failover`;
                const parentProxies = regionGroupMode === 'url-test'
                    ? [urlTestGroupName, fallbackGroupName, ...members]
                    : regionGroupMode === 'fallback'
                        ? [fallbackGroupName, urlTestGroupName, ...members]
                        : [...members, urlTestGroupName, fallbackGroupName];

                const group: any = {
                    name: groupName,
                    type: 'select',
                    proxies: parentProxies,
                };
                regionProxyGroups.push(
                    {
                        name: urlTestGroupName,
                        type: 'url-test',
                        proxies: members,
                        url: 'http://www.gstatic.com/generate_204',
                        interval: 300,
                        hidden: true
                    },
                    {
                        name: fallbackGroupName,
                        type: 'fallback',
                        proxies: members,
                        url: 'http://www.gstatic.com/generate_204',
                        interval: 300,
                        hidden: true
                    },
                    group
                );
            }

            // 未匹配节点归入「其他」组
            if (unmatched.length > 0) {
                const otherGroupName = '🌐 其他';
                regionGroupNames.push(otherGroupName);
                const urlTestGroupName = `${otherGroupName} · URLTest`;
                const fallbackGroupName = `${otherGroupName} · Failover`;
                const parentProxies = regionGroupMode === 'url-test'
                    ? [urlTestGroupName, fallbackGroupName, ...unmatched]
                    : regionGroupMode === 'fallback'
                        ? [fallbackGroupName, urlTestGroupName, ...unmatched]
                        : [...unmatched, urlTestGroupName, fallbackGroupName];

                const group: any = {
                    name: otherGroupName,
                    type: 'select',
                    proxies: parentProxies,
                };
                regionProxyGroups.push(
                    {
                        name: urlTestGroupName,
                        type: 'url-test',
                        proxies: unmatched,
                        url: 'http://www.gstatic.com/generate_204',
                        interval: 300,
                        hidden: true
                    },
                    {
                        name: fallbackGroupName,
                        type: 'fallback',
                        proxies: unmatched,
                        url: 'http://www.gstatic.com/generate_204',
                        interval: 300,
                        hidden: true
                    },
                    group
                );
            }

            defaultGroups = [
                {
                    name: '🔰 节点选择',
                    type: 'select',
                    proxies: ['♻️ 自动选择', 'DIRECT', ...regionGroupNames]
                },
                {
                    name: '♻️ 自动选择',
                    type: 'url-test',
                    proxies: proxyNames,
                    url: 'http://www.gstatic.com/generate_204',
                    interval: 300
                },
            ];
        } else {
            defaultGroups = [
                {
                    name: '🔰 节点选择',
                    type: 'select',
                    proxies: ['♻️ 自动选择', 'DIRECT', ...proxyNames]
                },
                {
                    name: '♻️ 自动选择',
                    type: 'url-test',
                    proxies: proxyNames,
                    url: 'http://www.gstatic.com/generate_204',
                    interval: 300
                },
            ];
        }

        // 生成应用路由代理组
        if (appGroupNames && appGroupNames.length > 0) {
            const appGroupNamesToCreate = appGroupNames.filter(name => name !== 'DIRECT' && name !== 'REJECT');
            if (appGroupNamesToCreate.length === 0) {
                if (useRegionGrouping) {
                    defaultGroups.push(...regionProxyGroups);
                }
                return defaultGroups;
            }

            // 构建应用代理组的可选项
            const appGroupProxies = ['🔰 节点选择', 'DIRECT', 'REJECT', '♻️ 自动选择'];
            if (useRegionGrouping) {
                const { regionGroups, unmatched } = this.classifyProxiesByRegion(allProxies);
                for (const [groupName] of regionGroups) {
                    appGroupProxies.push(groupName);
                }
                if (unmatched.length > 0) {
                    appGroupProxies.push('🌐 其他');
                }
            }

            const appProxyGroups = appGroupNamesToCreate.map(groupName => {
                if (groupName === '🖧 本地局域网') {
                    return {
                        name: groupName,
                        type: 'select',
                        // 局域网分组可直接选择所有具体节点
                        proxies: ['DIRECT', 'REJECT', '♻️ 自动选择', ...proxyNames],
                    };
                }

                return {
                    name: groupName,
                    type: 'select',
                    proxies: appGroupProxies,
                };
            });

            defaultGroups.push(...appProxyGroups);
        }

        if (useRegionGrouping) {
            defaultGroups.push(...regionProxyGroups);
        }

        return defaultGroups;
    }
}

export const clashService = new ClashService();
