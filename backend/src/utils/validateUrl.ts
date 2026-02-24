import dns from 'dns';
import net from 'net';

// 私有/保留 IPv4 CIDR 列表
const BLOCKED_IPV4_RANGES: Array<{ base: number; mask: number }> = [
    // 回环
    { base: ipv4ToInt('127.0.0.0'), mask: 0xff000000 },
    // A 类私有
    { base: ipv4ToInt('10.0.0.0'), mask: 0xff000000 },
    // B 类私有
    { base: ipv4ToInt('172.16.0.0'), mask: 0xfff00000 },
    // C 类私有
    { base: ipv4ToInt('192.168.0.0'), mask: 0xffff0000 },
    // 链路本地（云元数据服务 169.254.169.254）
    { base: ipv4ToInt('169.254.0.0'), mask: 0xffff0000 },
    // 未指定
    { base: ipv4ToInt('0.0.0.0'), mask: 0xff000000 },
];

function ipv4ToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
    if (!net.isIPv4(ip)) {
        return false;
    }
    const n = ipv4ToInt(ip);
    return BLOCKED_IPV4_RANGES.some(({ base, mask }) => (n & mask) === (base & mask));
}

function isPrivateIpv6(ip: string): boolean {
    if (!net.isIPv6(ip)) {
        return false;
    }
    const normalized = ip.toLowerCase();
    // 回环
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
        return true;
    }
    // 未指定
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
        return true;
    }
    // ULA fc00::/7
    if (/^f[cd]/i.test(normalized)) {
        return true;
    }
    // 链路本地 fe80::/10
    if (/^fe[89ab]/i.test(normalized)) {
        return true;
    }
    return false;
}

function isPrivateIp(ip: string): boolean {
    return isPrivateIpv4(ip) || isPrivateIpv6(ip);
}

async function resolveHostname(hostname: string): Promise<string[]> {
    return new Promise((resolve) => {
        dns.lookup(hostname, { all: true, family: 0 }, (err, addresses) => {
            if (err || !addresses) {
                resolve([]);
            } else {
                resolve(addresses.map(a => a.address));
            }
        });
    });
}

/**
 * 校验订阅 URL 是否安全（防 SSRF）。
 * 会进行 DNS 解析，确保 hostname 不解析到私有/保留 IP。
 */
export async function validateSubscriptionUrl(rawUrl: string): Promise<{ valid: true } | { valid: false; error: string }> {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { valid: false, error: 'URL 格式无效' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: 'URL 协议必须为 http 或 https' };
    }

    const hostname = parsed.hostname;

    // 如果 hostname 本身就是 IP，直接判断
    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
            return { valid: false, error: `不允许访问内网地址: ${hostname}` };
        }
        return { valid: true };
    }

    // localhost 直接拒绝
    if (hostname === 'localhost') {
        return { valid: false, error: '不允许访问 localhost' };
    }

    // DNS 解析，校验所有解析结果
    const resolvedIps = await resolveHostname(hostname);
    if (resolvedIps.length === 0) {
        return { valid: false, error: `无法解析域名: ${hostname}` };
    }

    for (const ip of resolvedIps) {
        if (isPrivateIp(ip)) {
            return { valid: false, error: `域名 ${hostname} 解析到内网地址 ${ip}，已拒绝` };
        }
    }

    return { valid: true };
}
