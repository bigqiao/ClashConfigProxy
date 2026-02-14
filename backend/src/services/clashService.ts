import axios from 'axios';
import yaml from 'js-yaml';
import type { ClashConfig, ClashProxy, Scheme } from '../../../shared/dist/types';
import { logger } from '../utils/logger';

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

export class ClashService {
    async fetchConfig(url: string): Promise<{ success: boolean; config?: ClashConfig; error?: string }> {
        try {
            const response = await axios.get(url, {
                timeout: 30000,
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

    async aggregateConfigs(scheme: Scheme): Promise<ClashConfig> {
        const enabledOnly = scheme.rules?.enabledOnly ?? true;
        const targetConfigs = enabledOnly ? scheme.configs.filter(c => c.enabled) : scheme.configs;
        const allProxies: ClashProxy[] = [];
        const allGroups: any[] = [];
        const allRules: string[] = [];

        for (const config of targetConfigs) {
            const result = await this.fetchConfig(config.url);
            if (result.success && result.config) {
                this.mergeProxies(allProxies, result.config.proxies, scheme.rules, config.name);
                this.mergeGroups(allGroups, result.config['proxy-groups'] || []);
                this.mergeRules(allRules, result.config.rules || []);
            }
        }

        return {
            'mixed-port': 7890,
            'allow-lan': false,
            'bind-address': '*',
            mode: 'rule',
            'log-level': 'info',
            'ipv6': false,
            'external-controller': '127.0.0.1:9090',
            proxies: allProxies,
            'proxy-groups': this.generateProxyGroups(allProxies, allGroups, scheme.rules),
            rules: [...allRules, 'MATCH,DIRECT']
        };
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

    private mergeGroups(allGroups: any[], newGroups: any[]): void {
        for (const group of newGroups) {
            const existingIndex = allGroups.findIndex(g => g.name === group.name);
            if (existingIndex === -1) {
                allGroups.push(group);
            }
        }
    }

    private mergeRules(allRules: string[], newRules: string[]): void {
        for (const rule of newRules) {
            if (!allRules.includes(rule) && !rule.includes('MATCH')) {
                allRules.push(rule);
            }
        }
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

    private generateProxyGroups(allProxies: ClashProxy[], existingGroups: any[], rules?: Scheme['rules']): any[] {
        const proxyNames = allProxies.map(p => p.name);
        const useRegionGrouping = rules?.regionGrouping ?? false;
        const regionGroupMode = rules?.regionGroupMode ?? 'select';

        let defaultGroups: any[];

        if (useRegionGrouping) {
            const { regionGroups, unmatched } = this.classifyProxiesByRegion(allProxies);

            // 创建地域代理组
            const regionProxyGroups: any[] = [];
            const regionGroupNames: string[] = [];

            for (const [groupName, members] of regionGroups) {
                regionGroupNames.push(groupName);
                const group: any = {
                    name: groupName,
                    type: regionGroupMode,
                    proxies: members,
                };
                if (regionGroupMode === 'url-test') {
                    group.url = 'http://www.gstatic.com/generate_204';
                    group.interval = 300;
                }
                regionProxyGroups.push(group);
            }

            // 未匹配节点归入「其他」组
            if (unmatched.length > 0) {
                const otherGroupName = '🌐 其他';
                regionGroupNames.push(otherGroupName);
                const group: any = {
                    name: otherGroupName,
                    type: regionGroupMode,
                    proxies: unmatched,
                };
                if (regionGroupMode === 'url-test') {
                    group.url = 'http://www.gstatic.com/generate_204';
                    group.interval = 300;
                }
                regionProxyGroups.push(group);
            }

            defaultGroups = [
                {
                    name: '🔰 节点选择',
                    type: 'select',
                    proxies: ['♻️ 自动选择', '🎯 全球直连', ...regionGroupNames]
                },
                {
                    name: '♻️ 自动选择',
                    type: 'url-test',
                    proxies: proxyNames,
                    url: 'http://www.gstatic.com/generate_204',
                    interval: 300
                },
                ...regionProxyGroups,
                {
                    name: '🎯 全球直连',
                    type: 'select',
                    proxies: ['DIRECT']
                },
                {
                    name: '🛑 全球拦截',
                    type: 'select',
                    proxies: ['REJECT']
                }
            ];
        } else {
            defaultGroups = [
                {
                    name: '🔰 节点选择',
                    type: 'select',
                    proxies: ['♻️ 自动选择', '🎯 全球直连', ...proxyNames]
                },
                {
                    name: '♻️ 自动选择',
                    type: 'url-test',
                    proxies: proxyNames,
                    url: 'http://www.gstatic.com/generate_204',
                    interval: 300
                },
                {
                    name: '🎯 全球直连',
                    type: 'select',
                    proxies: ['DIRECT']
                },
                {
                    name: '🛑 全球拦截',
                    type: 'select',
                    proxies: ['REJECT']
                }
            ];
        }

        const defaultGroupNames = new Set(defaultGroups.map(group => group.name));
        const allGroupNames = new Set([
            ...defaultGroups.map(group => group.name),
            ...existingGroups.map(group => group.name)
        ]);

        const updatedGroups = existingGroups
            .filter(group => !defaultGroupNames.has(group.name))
            .map(group => {
                if (!Array.isArray(group.proxies)) {
                    return group;
                }

                return {
                    ...group,
                    proxies: group.proxies.filter((proxy: string) =>
                        proxyNames.includes(proxy)
                        || ['DIRECT', 'REJECT'].includes(proxy)
                        || allGroupNames.has(proxy)
                    )
                };
            });

        return [...defaultGroups, ...updatedGroups];
    }
}

export const clashService = new ClashService();
