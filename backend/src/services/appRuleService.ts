import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import type { AvailableApp } from '../../../shared/dist/types';
import { logger } from '../utils/logger';

const DATA_ROOT_DIR = path.resolve(__dirname, '../../../data/users');
const GITHUB_API_BASE = 'https://api.github.com/repos/blackmatrix7/ios_rule_script/contents/rule/Clash';
const RULE_URL_BASE = 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash';

// 每日更新间隔（毫秒）
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

// 从翻墙需求角度划分的代理组
export const APP_GROUPS = [
    '🤖 AI 服务',
    '📋 Google',
    '💬 社交媒体',
    '🎬 国际流媒体',
    '📰 国际媒体',
    '🛠 开发者工具',
    '🎮 游戏平台',
    '🍎 Apple',
    'Ⓜ️ Microsoft',
    '🖧 本地局域网',
    '🏠 国内直连',
] as const;

// 默认分类映射：从「翻墙需求性」角度组织
// 分类逻辑：该服务是否被墙、是否需要代理、适合走什么路由
const DEFAULT_GROUP_MAP: Record<string, string> = {
    // ── 🤖 AI 服务 ── 全部被墙，必须代理
    OpenAI: '🤖 AI 服务',
    Claude: '🤖 AI 服务',
    Anthropic: '🤖 AI 服务',
    Gemini: '🤖 AI 服务',
    BardAI: '🤖 AI 服务',
    Copilot: '🤖 AI 服务',
    Perplexity: '🤖 AI 服务',
    Midjourney: '🤖 AI 服务',
    Civitai: '🤖 AI 服务',
    HuggingFace: '🤖 AI 服务',
    Replicate: '🤖 AI 服务',
    Runway: '🤖 AI 服务',
    StabilityAI: '🤖 AI 服务',
    Poe: '🤖 AI 服务',
    Character: '🤖 AI 服务',
    Suno: '🤖 AI 服务',

    // ── 📋 Google ── 全线被墙
    Google: '📋 Google',
    Gmail: '📋 Google',
    GoogleDrive: '📋 Google',
    GooglePlay: '📋 Google',
    GoogleTranslate: '📋 Google',
    GoogleScholar: '📋 Google',
    GoogleAnalytics: '📋 Google',
    YouTube: '📋 Google',
    YouTubeMusic: '📋 Google',
    Firebase: '📋 Google',
    Android: '📋 Google',
    Chromecast: '📋 Google',
    GoogleVoice: '📋 Google',
    GoogleEarth: '📋 Google',
    GoogleSearch: '📋 Google',
    Blogger: '📋 Google',
    FeedBurner: '📋 Google',

    // ── 💬 社交媒体 ── 大部分被墙
    Telegram: '💬 社交媒体',
    Discord: '💬 社交媒体',
    Twitter: '💬 社交媒体',
    Facebook: '💬 社交媒体',
    Instagram: '💬 社交媒体',
    WhatsApp: '💬 社交媒体',
    Line: '💬 社交媒体',
    Signal: '💬 社交媒体',
    Snapchat: '💬 社交媒体',
    Reddit: '💬 社交媒体',
    Tumblr: '💬 社交媒体',
    Pinterest: '💬 社交媒体',
    LinkedIn: '💬 社交媒体',
    Mastodon: '💬 社交媒体',
    Threads: '💬 社交媒体',
    Messenger: '💬 社交媒体',
    Skype: '💬 社交媒体',
    Clubhouse: '💬 社交媒体',
    ClubhouseIP: '💬 社交媒体',
    Disqus: '💬 社交媒体',
    Flickr: '💬 社交媒体',
    Quora: '💬 社交媒体',
    Medium: '💬 社交媒体',
    Substack: '💬 社交媒体',
    Gravatar: '💬 社交媒体',
    Kakao: '💬 社交媒体',
    Viber: '💬 社交媒体',
    Zalo: '💬 社交媒体',
    '4chan': '💬 社交媒体',
    Gettr: '💬 社交媒体',
    Truth: '💬 社交媒体',
    Parler: '💬 社交媒体',
    Gab: '💬 社交媒体',

    // ── 🎬 国际流媒体 ── 需要代理 + 可能需要特定地区
    Netflix: '🎬 国际流媒体',
    Disney: '🎬 国际流媒体',
    DisneyPlus: '🎬 国际流媒体',
    Spotify: '🎬 国际流媒体',
    TikTok: '🎬 国际流媒体',
    Twitch: '🎬 国际流媒体',
    Hulu: '🎬 国际流媒体',
    HBO: '🎬 国际流媒体',
    HBOMax: '🎬 国际流媒体',
    AmazonPrimeVideo: '🎬 国际流媒体',
    AppleTV: '🎬 国际流媒体',
    AppleMusic: '🎬 国际流媒体',
    Peacock: '🎬 国际流媒体',
    Vimeo: '🎬 国际流媒体',
    DAZN: '🎬 国际流媒体',
    Pandora: '🎬 国际流媒体',
    SoundCloud: '🎬 国际流媒体',
    Deezer: '🎬 国际流媒体',
    Tidal: '🎬 国际流媒体',
    Niconico: '🎬 国际流媒体',
    AbemaTV: '🎬 国际流媒体',
    Abema: '🎬 国际流媒体',
    Bahamut: '🎬 国际流媒体',
    BritboxUK: '🎬 国际流媒体',
    All4: '🎬 国际流媒体',
    ATTWatchTV: '🎬 国际流媒体',
    CWSeed: '🎬 国际流媒体',
    Crunchyroll: '🎬 国际流媒体',
    DMM: '🎬 国际流媒体',
    Dailymotion: '🎬 国际流媒体',
    DiscoveryPlus: '🎬 国际流媒体',
    Emby: '🎬 国际流媒体',
    Funimation: '🎬 国际流媒体',
    Plex: '🎬 国际流媒体',
    Roku: '🎬 国际流媒体',
    Vudu: '🎬 国际流媒体',
    Starz: '🎬 国际流媒体',
    CableTV: '🎬 国际流媒体',
    CBS: '🎬 国际流媒体',
    ParamountPlus: '🎬 国际流媒体',

    // ── 📰 国际媒体 ── 新闻类，很多被墙
    BBC: '📰 国际媒体',
    CNN: '📰 国际媒体',
    Bloomberg: '📰 国际媒体',
    Reuters: '📰 国际媒体',
    NYTimes: '📰 国际媒体',
    WashingtonPost: '📰 国际媒体',
    Guardian: '📰 国际媒体',
    TheGuardian: '📰 国际媒体',
    WSJ: '📰 国际媒体',
    Economist: '📰 国际媒体',
    ABC: '📰 国际媒体',
    AP: '📰 国际媒体',
    AFP: '📰 国际媒体',
    ALJazeera: '📰 国际媒体',
    AppleDaily: '📰 国际媒体',
    AppleNews: '📰 国际媒体',
    Wikipedia: '📰 国际媒体',
    WikiMedia: '📰 国际媒体',
    BoXun: '📰 国际媒体',
    DW: '📰 国际媒体',
    FT: '📰 国际媒体',
    Forbes: '📰 国际媒体',
    HuffPost: '📰 国际媒体',
    NHK: '📰 国际媒体',
    NPR: '📰 国际媒体',
    Asahi: '📰 国际媒体',
    Dailymail: '📰 国际媒体',
    Vice: '📰 国际媒体',
    Vox: '📰 国际媒体',
    '9News': '📰 国际媒体',
    '9to5': '📰 国际媒体',
    AnandTech: '📰 国际媒体',
    Cnet: '📰 国际媒体',
    TheVerge: '📰 国际媒体',
    TechCrunch: '📰 国际媒体',
    Wired: '📰 国际媒体',
    ArsTechnica: '📰 国际媒体',
    Engadget: '📰 国际媒体',
    Mashable: '📰 国际媒体',
    Americasvoice: '📰 国际媒体',

    // ── 🛠 开发者工具 ── 部分被墙或访问缓慢
    GitHub: '🛠 开发者工具',
    GitLab: '🛠 开发者工具',
    Docker: '🛠 开发者工具',
    StackOverflow: '🛠 开发者工具',
    NPM: '🛠 开发者工具',
    PyPI: '🛠 开发者工具',
    JetBrains: '🛠 开发者工具',
    DigitalOcean: '🛠 开发者工具',
    Cloudflare: '🛠 开发者工具',
    Vercel: '🛠 开发者工具',
    Heroku: '🛠 开发者工具',
    Netlify: '🛠 开发者工具',
    AWS: '🛠 开发者工具',
    Atlassian: '🛠 开发者工具',
    Anaconda: '🛠 开发者工具',
    Apifox: '🛠 开发者工具',
    Electron: '🛠 开发者工具',
    Developer: '🛠 开发者工具',
    Collabora: '🛠 开发者工具',
    Bootcss: '🛠 开发者工具',
    Duckduckgo: '🛠 开发者工具',
    Dropbox: '🛠 开发者工具',
    Notion: '🛠 开发者工具',
    Figma: '🛠 开发者工具',
    Canva: '🛠 开发者工具',
    Grammarly: '🛠 开发者工具',
    '1Password': '🛠 开发者工具',
    LastPass: '🛠 开发者工具',
    Bitwarden: '🛠 开发者工具',
    Postman: '🛠 开发者工具',

    // ── 🎮 游戏平台 ── 部分需要代理
    Steam: '🎮 游戏平台',
    Epic: '🎮 游戏平台',
    PlayStation: '🎮 游戏平台',
    Xbox: '🎮 游戏平台',
    Nintendo: '🎮 游戏平台',
    EA: '🎮 游戏平台',
    Blizzard: '🎮 游戏平台',
    Battle: '🎮 游戏平台',
    Riot: '🎮 游戏平台',
    Roblox: '🎮 游戏平台',
    Ubisoft: '🎮 游戏平台',
    Origin: '🎮 游戏平台',
    GOG: '🎮 游戏平台',
    Garena: '🎮 游戏平台',
    '2KGames': '🎮 游戏平台',
    Rockstar: '🎮 游戏平台',
    Supercell: '🎮 游戏平台',
    miHoYo: '🎮 游戏平台',
    HoYoverse: '🎮 游戏平台',
    Nexon: '🎮 游戏平台',
    Square: '🎮 游戏平台',
    Bethesda: '🎮 游戏平台',

    // ── 🍎 Apple ── 部分服务需要代理
    Apple: '🍎 Apple',
    iCloud: '🍎 Apple',
    AppStore: '🍎 Apple',
    AppleID: '🍎 Apple',
    AppleDev: '🍎 Apple',
    AppleMail: '🍎 Apple',
    AppleMedia: '🍎 Apple',
    AppleProxy: '🍎 Apple',
    AppleFirmware: '🍎 Apple',
    AppleHardware: '🍎 Apple',
    FaceTime: '🍎 Apple',
    TestFlight: '🍎 Apple',
    Beats: '🍎 Apple',

    // ── Ⓜ️ Microsoft ── 部分服务需要代理
    Microsoft: 'Ⓜ️ Microsoft',
    OneDrive: 'Ⓜ️ Microsoft',
    Bing: 'Ⓜ️ Microsoft',
    Teams: 'Ⓜ️ Microsoft',
    Office365: 'Ⓜ️ Microsoft',
    Outlook: 'Ⓜ️ Microsoft',
    Azure: 'Ⓜ️ Microsoft',

    // ── 🖧 本地局域网 ── 局域网地址与私有网段，建议直连
    Lan: '🖧 本地局域网',

    // ── 🏠 国内直连 ── 无需代理，走直连
    WeChat: '🏠 国内直连',
    QQ: '🏠 国内直连',
    AliPay: '🏠 国内直连',
    Alibaba: '🏠 国内直连',
    AmazonCN: '🏠 国内直连',
    Baidu: '🏠 国内直连',
    BaiDuTieBa: '🏠 国内直连',
    BiliBili: '🏠 国内直连',
    BiliBiliIntl: '🎬 国际流媒体', // 国际版需要代理
    ByteDance: '🏠 国内直连',
    DouYin: '🏠 国内直连',
    Douyu: '🏠 国内直连',
    iQIYI: '🏠 国内直连',
    Youku: '🏠 国内直连',
    AcFun: '🏠 国内直连',
    BesTV: '🏠 国内直连',
    BaoFengYingYin: '🏠 国内直连',
    CIBN: '🏠 国内直连',
    DingTalk: '🏠 国内直连',
    DouBan: '🏠 国内直连',
    Eleme: '🏠 国内直连',
    JD: '🏠 国内直连',
    MeiTuan: '🏠 国内直连',
    NetEase: '🏠 国内直连',
    NetEaseMusic: '🏠 国内直连',
    Sina: '🏠 国内直连',
    SinaWeibo: '🏠 国内直连',
    Weibo: '🏠 国内直连',
    Zhihu: '🏠 国内直连',
    XiaoHongShu: '🏠 国内直连',
    PinDuoDuo: '🏠 国内直连',
    Kuaishou: '🏠 国内直连',
    DiDi: '🏠 国内直连',
    Afdian: '🏠 国内直连',
    CaiXinChuanMei: '🏠 国内直连',
    CCTV: '🏠 国内直连',
    CNKI: '🏠 国内直连',
    CSDN: '🏠 国内直连',
    CaiNiao: '🏠 国内直连',
    Coolapk: '🏠 国内直连',
    DaMai: '🏠 国内直连',
    DangDang: '🏠 国内直连',
    Dedao: '🏠 国内直连',
    Deepin: '🏠 国内直连',
    DianCeWangKe: '🏠 国内直连',
    DingXiangYuan: '🏠 国内直连',
    DuoWan: '🏠 国内直连',
    EastMoney: '🏠 国内直连',
    '12306': '🏠 国内直连',
    '115': '🏠 国内直连',
    '360': '🏠 国内直连',
    '36kr': '🏠 国内直连',
    '4399': '🏠 国内直连',
    '51Job': '🏠 国内直连',
    '56': '🏠 国内直连',
    '58TongCheng': '🏠 国内直连',
    '17173': '🏠 国内直连',
    '178': '🏠 国内直连',
    Anjuke: '🏠 国内直连',
    BianFeng: '🏠 国内直连',
    Blued: '🏠 国内直连',
    Binance: '🏠 国内直连',
    Duolingo: '🏠 国内直连',
};

interface CacheData {
    apps: string[];
    updatedAt: string;
}

interface CategoryOverridesData {
    overrides: Record<string, string>;
    customGroups?: string[];
    updatedAt: string;
}

export class AppRuleService {
    private cachedAppsByUser = new Map<string, AvailableApp[]>();
    private updateTimer: NodeJS.Timeout | null = null;
    private knownUsers = new Set<string>();
    private categoryOverridesByUser = new Map<string, Record<string, string>>();
    private customGroupsByUser = new Map<string, string[]>();

    private getUserDataDir(userId: string): string {
        return path.join(DATA_ROOT_DIR, userId);
    }

    private getCacheFilePath(userId: string): string {
        return path.join(this.getUserDataDir(userId), 'available-apps.json');
    }

    private getCategoryOverridesFilePath(userId: string): string {
        return path.join(this.getUserDataDir(userId), 'app-categories.json');
    }

    private registerUser(userId: string): void {
        this.knownUsers.add(userId);
    }

    /** 获取规则集 URL */
    static getRuleUrl(appName: string): string {
        return `${RULE_URL_BASE}/${appName}/${appName}.yaml`;
    }

    /** 启动定时更新 */
    start(): void {
        // 每日定时更新
        this.updateTimer = setInterval(() => {
            const users = [...this.knownUsers];
            Promise.all(users.map(userId => this.fetchFromGitHub(userId).catch(err => {
                logger.error(`定时更新应用列表失败(${userId}):`, err as Error);
            }))).catch(() => undefined);
        }, UPDATE_INTERVAL);
    }

    stop(): void {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /** 获取可用应用列表（合并用户自定义分类覆盖） */
    async getAvailableApps(userId: string): Promise<AvailableApp[]> {
        this.registerUser(userId);
        const cachedApps = this.cachedAppsByUser.get(userId);
        if (cachedApps) {
            return this.applyCategoryOverrides(userId, cachedApps);
        }
        const apps = await this.loadOrFetch(userId);
        return this.applyCategoryOverrides(userId, apps);
    }

    /** 手动刷新 */
    async refresh(userId: string): Promise<AvailableApp[]> {
        this.registerUser(userId);
        const apps = await this.fetchFromGitHub(userId);
        return this.applyCategoryOverrides(userId, apps);
    }

    /** 获取用户自定义分类覆盖 */
    async getCategoryOverrides(userId: string): Promise<Record<string, string>> {
        this.registerUser(userId);
        const overrides = this.categoryOverridesByUser.get(userId);
        if (overrides) {
            return overrides;
        }
        await this.loadCategoryData(userId);
        return this.categoryOverridesByUser.get(userId) || {};
    }

    /** 获取用户自定义分类组 */
    async getCustomGroups(userId: string): Promise<string[]> {
        this.registerUser(userId);
        const customGroups = this.customGroupsByUser.get(userId);
        if (customGroups) {
            return customGroups;
        }
        await this.loadCategoryData(userId);
        return this.customGroupsByUser.get(userId) || [];
    }

    /** 从文件加载分类数据（overrides + customGroups） */
    private async loadCategoryData(userId: string): Promise<void> {
        const filePath = this.getCategoryOverridesFilePath(userId);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const parsed: CategoryOverridesData = JSON.parse(data);
            this.categoryOverridesByUser.set(userId, parsed.overrides || {});
            this.customGroupsByUser.set(userId, parsed.customGroups || []);
        } catch {
            this.categoryOverridesByUser.set(userId, {});
            this.customGroupsByUser.set(userId, []);
        }
    }

    /** 保存用户自定义分类覆盖 */
    async updateCategoryOverrides(userId: string, overrides: Record<string, string>, customGroups?: string[]): Promise<void> {
        this.registerUser(userId);
        const filePath = this.getCategoryOverridesFilePath(userId);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const existing = await this.getCustomGroups(userId);
        const data: CategoryOverridesData = {
            overrides,
            customGroups: customGroups ?? existing,
            updatedAt: new Date().toISOString(),
        };
        await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
        this.categoryOverridesByUser.set(userId, overrides);
        this.customGroupsByUser.set(userId, data.customGroups ?? []);
    }

    /** 将用户覆盖合并到应用列表 */
    private async applyCategoryOverrides(userId: string, apps: AvailableApp[]): Promise<AvailableApp[]> {
        const overrides = await this.getCategoryOverrides(userId);
        if (Object.keys(overrides).length === 0) return apps;
        return apps.map(app => ({
            ...app,
            defaultGroup: overrides[app.name] ?? app.defaultGroup,
        }));
    }

    private async loadOrFetch(userId: string): Promise<AvailableApp[]> {
        this.registerUser(userId);
        const cacheFile = this.getCacheFilePath(userId);
        // 尝试从缓存文件加载
        try {
            const data = await fs.readFile(cacheFile, 'utf8');
            const cache: CacheData = JSON.parse(data);
            const age = Date.now() - new Date(cache.updatedAt).getTime();
            if (age < UPDATE_INTERVAL) {
                const apps = cache.apps.map(name => ({
                    name,
                    defaultGroup: DEFAULT_GROUP_MAP[name],
                }));
                this.cachedAppsByUser.set(userId, apps);
                logger.info(`从缓存加载了 ${apps.length} 个应用规则 (userId=${userId})`);
                return apps;
            }
        } catch {
            // 缓存不存在或无效，继续从 GitHub 拉取
        }
        return this.fetchFromGitHub(userId);
    }

    private async fetchFromGitHub(userId: string): Promise<AvailableApp[]> {
        this.registerUser(userId);
        logger.info('开始从 GitHub 拉取应用规则列表...');
        const nameSet = new Set<string>();

        try {
            // GitHub Contents API 单次返回所有条目，无需分页
            const response = await axios.get(GITHUB_API_BASE, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'clash-config-proxy/1.0.0',
                },
            });

            const entries = response.data as { name: string; type: string }[];
            if (Array.isArray(entries)) {
                for (const entry of entries) {
                    if (entry.type === 'dir') {
                        nameSet.add(entry.name);
                    }
                }
            }
        } catch (error) {
            throw error;
        }

        const allNames = [...nameSet].sort();
        logger.info(`从 GitHub 拉取了 ${allNames.length} 个应用规则`);

        // 保存缓存
        try {
            const cacheFile = this.getCacheFilePath(userId);
            await fs.mkdir(path.dirname(cacheFile), { recursive: true });
            const cache: CacheData = {
                apps: allNames,
                updatedAt: new Date().toISOString(),
            };
            await fs.writeFile(cacheFile, JSON.stringify(cache, null, 4), 'utf8');
        } catch (error) {
            logger.error('保存应用列表缓存失败:', error as Error);
        }

        const apps = allNames.map(name => ({
            name,
            defaultGroup: DEFAULT_GROUP_MAP[name],
        }));
        this.cachedAppsByUser.set(userId, apps);

        return apps;
    }
}

export const appRuleService = new AppRuleService();
