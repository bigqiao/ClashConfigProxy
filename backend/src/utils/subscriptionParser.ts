import yaml from 'js-yaml';
import type { ClashConfig, ClashProxy } from '../../../shared/dist/types';

export function tryBase64Decode(content: string): string | null {
    const cleaned = content.trim().replace(/\s+/g, '');
    if (cleaned.length < 8 || !/^[A-Za-z0-9+/]+=*$/.test(cleaned)) {
        return null;
    }
    try {
        const padded = cleaned.length % 4 !== 0
            ? cleaned + '='.repeat((4 - cleaned.length % 4) % 4)
            : cleaned;
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        // Must contain printable text
        if (!decoded || !/[\x20-\x7E\n\r\t]/.test(decoded)) return null;
        return decoded;
    } catch {
        return null;
    }
}

export function tryParseClashConfig(content: string, contentType: string): ClashConfig | null {
    try {
        let parsed: any;
        if (contentType.includes('application/json')) {
            parsed = JSON.parse(content);
        } else {
            parsed = yaml.load(content);
            if (!parsed || typeof parsed !== 'object') {
                try { parsed = JSON.parse(content); } catch { /* ignore */ }
            }
        }
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.proxies) && parsed.proxies.length > 0) {
            return parsed as ClashConfig;
        }
        return null;
    } catch {
        return null;
    }
}

function parseVmess(uri: string): ClashProxy | null {
    try {
        const base64 = uri.slice('vmess://'.length).trim();
        const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        const proxy: ClashProxy = {
            name: json.ps || json.add || 'VMess',
            type: 'vmess',
            server: json.add,
            port: parseInt(json.port, 10),
            uuid: json.id,
            alterId: parseInt(json.aid, 10) || 0,
            cipher: json.scy || 'auto',
        };
        if (!proxy.server || !proxy.port || !proxy.uuid) return null;

        const net = json.net;
        if (net === 'ws') {
            proxy.network = 'ws';
            const wsOpts: Record<string, any> = {};
            if (json.path) wsOpts['path'] = json.path;
            if (json.host) wsOpts['headers'] = { Host: json.host };
            if (Object.keys(wsOpts).length > 0) proxy['ws-opts'] = wsOpts;
        } else if (net === 'grpc') {
            proxy.network = 'grpc';
            if (json.path) proxy['grpc-opts'] = { 'grpc-service-name': json.path };
        } else if (net === 'h2') {
            proxy.network = 'h2';
            const h2Opts: Record<string, any> = {};
            if (json.path) h2Opts['path'] = json.path;
            if (json.host) h2Opts['host'] = [json.host];
            if (Object.keys(h2Opts).length > 0) proxy['h2-opts'] = h2Opts;
        } else if (net === 'httpupgrade') {
            proxy.network = 'httpupgrade';
            const opts: Record<string, any> = {};
            if (json.host) opts['host'] = json.host;
            if (json.path) opts['path'] = json.path;
            if (Object.keys(opts).length > 0) proxy['httpupgrade-opts'] = opts;
        }

        if (json.tls === 'tls') {
            proxy.tls = true;
            if (json.sni) proxy.servername = json.sni;
            if (json.alpn) proxy.alpn = String(json.alpn).split(',');
            if (json.fp) proxy['client-fingerprint'] = json.fp;
        }
        return proxy;
    } catch {
        return null;
    }
}

function parseShadowsocks(uri: string): ClashProxy | null {
    try {
        const withoutScheme = uri.slice('ss://'.length);
        const hashIdx = withoutScheme.indexOf('#');
        const name = hashIdx !== -1 ? decodeURIComponent(withoutScheme.slice(hashIdx + 1)) : '';
        const main = hashIdx !== -1 ? withoutScheme.slice(0, hashIdx) : withoutScheme;
        const noQuery = main.includes('?') ? main.slice(0, main.indexOf('?')) : main;

        const atIdx = noQuery.indexOf('@');
        let method: string, password: string, server: string, port: number;

        if (atIdx !== -1) {
            const userinfo = noQuery.slice(0, atIdx);
            const hostPart = noQuery.slice(atIdx + 1);

            let decoded: string;
            try {
                const attempt = Buffer.from(userinfo, 'base64').toString('utf8');
                decoded = attempt.includes(':') ? attempt : decodeURIComponent(userinfo);
            } catch {
                decoded = decodeURIComponent(userinfo);
            }

            const colonIdx = decoded.indexOf(':');
            method = decoded.slice(0, colonIdx);
            password = decoded.slice(colonIdx + 1);

            const lastColon = hostPart.lastIndexOf(':');
            server = hostPart.slice(0, lastColon);
            port = parseInt(hostPart.slice(lastColon + 1), 10);
        } else {
            const decoded = Buffer.from(noQuery, 'base64').toString('utf8');
            const lastAt = decoded.lastIndexOf('@');
            const userinfo = decoded.slice(0, lastAt);
            const hostPart = decoded.slice(lastAt + 1);

            const colonIdx = userinfo.indexOf(':');
            method = userinfo.slice(0, colonIdx);
            password = userinfo.slice(colonIdx + 1);

            const lastColon = hostPart.lastIndexOf(':');
            server = hostPart.slice(0, lastColon);
            port = parseInt(hostPart.slice(lastColon + 1), 10);
        }

        if (!server || !port || !method) return null;
        return { name: name || server, type: 'ss', server, port, cipher: method, password };
    } catch {
        return null;
    }
}

function parseTrojan(uri: string): ClashProxy | null {
    try {
        const url = new URL(uri);
        const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname;
        const params = url.searchParams;
        const proxy: ClashProxy = {
            name,
            type: 'trojan',
            server: url.hostname,
            port: parseInt(url.port, 10),
            password: decodeURIComponent(url.username),
            tls: true,
        };
        if (!proxy.server || !proxy.port || !proxy.password) return null;

        if (params.get('sni')) proxy.sni = params.get('sni')!;
        if (params.get('alpn')) proxy.alpn = params.get('alpn')!.split(',');
        if (params.get('fp')) proxy['client-fingerprint'] = params.get('fp')!;
        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        const network = params.get('type');
        if (network === 'ws') {
            proxy.network = 'ws';
            const wsOpts: Record<string, any> = {};
            if (params.get('path')) wsOpts['path'] = params.get('path')!;
            if (params.get('host')) wsOpts['headers'] = { Host: params.get('host')! };
            if (Object.keys(wsOpts).length > 0) proxy['ws-opts'] = wsOpts;
        } else if (network === 'grpc') {
            proxy.network = 'grpc';
            const svcName = params.get('serviceName') || params.get('grpcServiceName') || '';
            if (svcName) proxy['grpc-opts'] = { 'grpc-service-name': svcName };
        }
        return proxy;
    } catch {
        return null;
    }
}

function parseVless(uri: string): ClashProxy | null {
    try {
        const url = new URL(uri);
        const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname;
        const params = url.searchParams;
        const proxy: ClashProxy = {
            name,
            type: 'vless',
            server: url.hostname,
            port: parseInt(url.port, 10),
            uuid: url.username,
            udp: true,
        };
        if (!proxy.server || !proxy.port || !proxy.uuid) return null;

        const security = params.get('security');
        if (security === 'tls' || security === 'xtls') {
            proxy.tls = true;
            if (params.get('sni')) proxy.servername = params.get('sni')!;
            if (params.get('fp')) proxy['client-fingerprint'] = params.get('fp')!;
            if (params.get('alpn')) proxy.alpn = params.get('alpn')!.split(',');
        } else if (security === 'reality') {
            proxy.tls = true;
            const realityOpts: Record<string, any> = {};
            if (params.get('pbk')) realityOpts['public-key'] = params.get('pbk')!;
            if (params.get('sid')) realityOpts['short-id'] = params.get('sid')!;
            proxy['reality-opts'] = realityOpts;
            if (params.get('sni')) proxy.servername = params.get('sni')!;
            if (params.get('fp')) proxy['client-fingerprint'] = params.get('fp')!;
        }

        const flow = params.get('flow');
        if (flow) proxy.flow = flow;

        const network = params.get('type');
        if (network === 'ws') {
            proxy.network = 'ws';
            const wsOpts: Record<string, any> = {};
            if (params.get('path')) wsOpts['path'] = params.get('path')!;
            if (params.get('host')) wsOpts['headers'] = { Host: params.get('host')! };
            if (Object.keys(wsOpts).length > 0) proxy['ws-opts'] = wsOpts;
        } else if (network === 'grpc') {
            proxy.network = 'grpc';
            const svcName = params.get('serviceName') || params.get('grpcServiceName') || '';
            if (svcName) proxy['grpc-opts'] = { 'grpc-service-name': svcName };
        } else if (network === 'h2') {
            proxy.network = 'h2';
            const h2Opts: Record<string, any> = {};
            if (params.get('path')) h2Opts['path'] = params.get('path')!;
            if (params.get('host')) h2Opts['host'] = [params.get('host')!];
            if (Object.keys(h2Opts).length > 0) proxy['h2-opts'] = h2Opts;
        } else if (network === 'httpupgrade') {
            proxy.network = 'httpupgrade';
            const opts: Record<string, any> = {};
            if (params.get('host')) opts['host'] = params.get('host')!;
            if (params.get('path')) opts['path'] = params.get('path')!;
            if (Object.keys(opts).length > 0) proxy['httpupgrade-opts'] = opts;
        }
        return proxy;
    } catch {
        return null;
    }
}

function parseHysteria2(uri: string): ClashProxy | null {
    try {
        const url = new URL(uri);
        const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname;
        const params = url.searchParams;
        const proxy: ClashProxy = {
            name,
            type: 'hysteria2',
            server: url.hostname,
            port: parseInt(url.port, 10),
            password: decodeURIComponent(url.username),
        };
        if (!proxy.server || !proxy.port) return null;

        if (params.get('sni')) proxy.sni = params.get('sni')!;
        if (params.get('insecure') === '1') proxy['skip-cert-verify'] = true;
        if (params.get('obfs')) {
            proxy.obfs = params.get('obfs')!;
            if (params.get('obfs-password')) proxy['obfs-password'] = params.get('obfs-password')!;
        }
        return proxy;
    } catch {
        return null;
    }
}

function parseProxyUri(uri: string): ClashProxy | null {
    const trimmed = uri.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    if (trimmed.startsWith('vmess://')) return parseVmess(trimmed);
    if (trimmed.startsWith('ss://')) return parseShadowsocks(trimmed);
    if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed);
    if (trimmed.startsWith('vless://')) return parseVless(trimmed);
    if (trimmed.startsWith('hy2://') || trimmed.startsWith('hysteria2://')) return parseHysteria2(trimmed);
    return null;
}

export function parseProxyUriList(content: string): ClashProxy[] {
    return content
        .split('\n')
        .map(parseProxyUri)
        .filter((p): p is ClashProxy => p !== null);
}
