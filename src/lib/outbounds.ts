import { isValidTag } from "./routes";
import {
  DEFAULT_KERNEL,
  normalizeKernel,
  type KernelKind,
} from "./kernel";

export { isValidTag };

export type OutboundProtocol =
  | "socks"
  | "http"
  | "shadowsocks"
  | "trojan"
  | "vmess"
  | "vless"
  | "wireguard";

export interface OutboundDraft {
  id: string;
  tag: string;
  protocol: OutboundProtocol;
  server: string;
  port: string;
  username: string;
  password: string;
  method: string;
  uuid: string;
  alterId: string;
  security: string;
  flow: string;
  privateKey: string;
  peerPublicKey: string;
  preSharedKey: string;
  localAddress: string;
  mtu: string;
  reserved: string;
  domainStrategy: string;
  proxyTag: string;
  extraSettings: string;
}

export interface XboardOutbound {
  tag: string;
  protocol: OutboundProtocol;
  settings: Record<string, unknown>;
  proxy_tag?: string;
}

export interface OutboundGenerationResult {
  kernel: KernelKind;
  outbounds: XboardOutbound[];
  json: string;
  outboundCount: number;
  protocolCount: number;
  byteSize: number;
  errors: string[];
  warnings: string[];
  tags: string[];
}

export const outboundProtocolMeta: Record<
  OutboundProtocol,
  { label: string; description: string }
> = {
  socks: {
    label: "SOCKS5",
    description: "通用 SOCKS5 代理出口。",
  },
  http: {
    label: "HTTP",
    description: "HTTP/HTTPS 代理出口，可配置基础认证。",
  },
  shadowsocks: {
    label: "Shadowsocks",
    description: "Shadowsocks 原生出口，默认使用 aes-256-gcm。",
  },
  trojan: {
    label: "Trojan",
    description:
      "Trojan 密码出口；TLS 可由 sing-box 额外 Settings 或 Xray 原生配置提供。",
  },
  vmess: {
    label: "VMess",
    description:
      "VMess 出口；TLS / transport 可由 sing-box 额外 Settings 或 Xray 原生配置提供。",
  },
  vless: {
    label: "VLESS",
    description:
      "VLESS 出口；TLS / transport 可由 sing-box 额外 Settings 或 Xray 原生配置提供。",
  },
  wireguard: {
    label: "WireGuard",
    description: "WireGuard 出口，预置 Cloudflare WARP 参数。",
  },
};

export const WARP_PUBLIC_KEY =
  "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=";

const WARP_SERVER = "engage.cloudflareclient.com";
const WARP_PORT = "2408";
const RESERVED_TAGS = new Set(["direct", "block"]);
const RESERVED_SETTINGS_KEYS = ["tag", "protocol", "proxy_tag", "proxyTag"];
const NON_BLANK_SETTINGS_KEYS = [
  "server",
  "uuid",
  "password",
  "method",
  "cipher",
  "private_key",
  "secret_key",
  "privateKey",
  "secretKey",
];
const DEFAULT_SS_METHOD = "aes-256-gcm";
const DEFAULT_WG_MTU = 1420;
const MIN_WG_MTU = 1;
const MAX_WG_MTU = 65535;

let draftSequence = 0;

function uniqueTag(base: string, existingTags: readonly string[]): string {
  const used = new Set(
    existingTags
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  );

  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase()) || RESERVED_TAGS.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function createOutboundDraft(
  protocol: OutboundProtocol,
  existingTags: string[] = [],
): OutboundDraft {
  const isWireGuard = protocol === "wireguard";
  const defaultTags: Record<OutboundProtocol, string> = {
    socks: "proxy",
    http: "http-out",
    shadowsocks: "ss-out",
    trojan: "trojan-out",
    vmess: "vmess-out",
    vless: "vless-out",
    wireguard: "warp",
  };
  const baseTag = defaultTags[protocol];
  const defaultServer =
    protocol === "socks" || protocol === "http" ? "127.0.0.1" : "example.com";
  const defaultPort =
    protocol === "socks"
      ? "1080"
      : protocol === "http"
        ? "8080"
        : protocol === "shadowsocks"
          ? "8388"
          : "443";

  draftSequence += 1;
  return {
    id: `outbound-${Date.now().toString(36)}-${draftSequence}`,
    tag: uniqueTag(baseTag, existingTags),
    protocol,
    server: isWireGuard ? WARP_SERVER : defaultServer,
    port: isWireGuard ? WARP_PORT : defaultPort,
    username: "",
    password: "",
    method: DEFAULT_SS_METHOD,
    uuid: "",
    alterId: "0",
    security: "auto",
    flow: "",
    privateKey: "",
    peerPublicKey: isWireGuard ? WARP_PUBLIC_KEY : "",
    preSharedKey: "",
    localAddress: isWireGuard ? "172.16.0.2/32" : "",
    mtu: isWireGuard ? "1280" : "",
    reserved: "",
    domainStrategy: isWireGuard ? "ForceIP" : "",
    proxyTag: "",
    extraSettings: "",
  };
}

function parsePort(value: string): number | null {
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const port = Number(raw);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function parseAlterId(value: string): number | null {
  const raw = value.trim();
  if (!raw) return 0;
  if (!/^\d+$/.test(raw)) return null;
  const alterId = Number(raw);
  return Number.isInteger(alterId) && alterId <= 65535 ? alterId : null;
}

function parseReserved(value: string): {
  values: number[];
  valid: boolean;
} {
  const raw = value.trim();
  if (!raw) return { values: [], valid: true };

  const parts = raw.split(",").map((part) => part.trim());
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return { values: [], valid: false };
  }

  const values = parts.map(Number);
  const valid = values.every(
    (part) => Number.isInteger(part) && part >= 0 && part <= 255,
  );
  return { values: valid ? values : [], valid };
}

function parseMtu(value: string): number | null {
  const raw = value.trim();
  if (!raw) return DEFAULT_WG_MTU;
  if (!/^\d+$/.test(raw)) return null;
  const mtu = Number(raw);
  return Number.isInteger(mtu) && mtu >= MIN_WG_MTU && mtu <= MAX_WG_MTU
    ? mtu
    : null;
}

function localAddresses(value: string): string[] {
  return value
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]),
    );
  }
  return value;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const merged = cloneValue(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(override)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      continue;
    }
    const current = merged[key];
    merged[key] =
      isPlainObject(current) && isPlainObject(value)
        ? deepMerge(current, value)
        : cloneValue(value);
  }
  return merged;
}

function endpointFor(server: string, port: number): string {
  const host =
    server.includes(":") && !server.startsWith("[") ? `[${server}]` : server;
  return `${host}:${port}`;
}

function validateNodeSettings(
  settings: Record<string, unknown>,
): string | null {
  for (const key of RESERVED_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      return `settings.${key} 是保留字段，不能出现在额外 Settings 中。`;
    }
  }

  for (const key of NON_BLANK_SETTINGS_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(settings, key)) continue;
    const value = settings[key];
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && !value.trim())
    ) {
      return `settings.${key} 不能为空。`;
    }
  }

  for (const key of ["server_port", "serverPort"]) {
    if (!Object.prototype.hasOwnProperty.call(settings, key)) continue;
    const value = settings[key];
    const port =
      typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+$/.test(value.trim())
          ? Number(value)
          : NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return `settings.${key} 必须是 1-65535 的整数。`;
    }
  }

  return null;
}

function buildXraySettings(
  draft: OutboundDraft,
  server: string,
  port: number,
): Record<string, unknown> {
  switch (draft.protocol) {
    case "socks":
    case "http": {
      const proxyServer: Record<string, unknown> = {
        address: server,
        port,
      };
      if (draft.username.trim() || draft.password.trim()) {
        proxyServer.users = [
          {
            user: draft.username,
            pass: draft.password,
          },
        ];
      }
      return { servers: [proxyServer] };
    }
    case "shadowsocks":
      return {
        servers: [
          {
            address: server,
            port,
            method: draft.method.trim() || DEFAULT_SS_METHOD,
            password: draft.password,
          },
        ],
      };
    case "trojan":
      return {
        servers: [
          {
            address: server,
            port,
            password: draft.password,
          },
        ],
      };
    case "vmess":
      return {
        vnext: [
          {
            address: server,
            port,
            users: [
              {
                id: draft.uuid.trim(),
                alterId: parseAlterId(draft.alterId) ?? 0,
                security: draft.security.trim() || "auto",
              },
            ],
          },
        ],
      };
    case "vless": {
      const user: Record<string, unknown> = {
        id: draft.uuid.trim(),
        encryption: "none",
      };
      const flow = draft.flow.trim();
      if (flow) user.flow = flow;
      return {
        vnext: [
          {
            address: server,
            port,
            users: [user],
          },
        ],
      };
    }
    case "wireguard": {
      const peer: Record<string, unknown> = {
        endpoint: endpointFor(server, port),
        publicKey: draft.peerPublicKey.trim(),
      };
      const preSharedKey = draft.preSharedKey.trim();
      if (preSharedKey) peer.preSharedKey = preSharedKey;
      peer.keepAlive = 0;
      peer.allowedIPs = ["0.0.0.0/0", "::/0"];

      const settings: Record<string, unknown> = {
        secretKey: draft.privateKey.trim(),
        address: localAddresses(draft.localAddress),
        peers: [peer],
        mtu: parseMtu(draft.mtu) ?? DEFAULT_WG_MTU,
      };
      const reserved = parseReserved(draft.reserved).values;
      if (reserved.length > 0) settings.reserved = reserved;
      settings.domainStrategy = draft.domainStrategy.trim() || "ForceIP";
      return settings;
    }
  }
}

function buildSingboxSettings(
  draft: OutboundDraft,
  server: string,
  port: number,
): Record<string, unknown> {
  switch (draft.protocol) {
    case "socks": {
      const settings: Record<string, unknown> = {
        server,
        server_port: port,
        version: "5",
      };
      if (draft.username.trim() || draft.password.trim()) {
        settings.username = draft.username;
        settings.password = draft.password;
      }
      return settings;
    }
    case "http": {
      const settings: Record<string, unknown> = {
        server,
        server_port: port,
      };
      if (draft.username.trim() || draft.password.trim()) {
        settings.username = draft.username;
        settings.password = draft.password;
      }
      return settings;
    }
    case "shadowsocks":
      return {
        server,
        server_port: port,
        method: draft.method.trim() || DEFAULT_SS_METHOD,
        password: draft.password,
      };
    case "trojan":
      return {
        server,
        server_port: port,
        password: draft.password,
      };
    case "vmess":
      return {
        server,
        server_port: port,
        uuid: draft.uuid.trim(),
        security: draft.security.trim() || "auto",
        alter_id: parseAlterId(draft.alterId) ?? 0,
      };
    case "vless": {
      const settings: Record<string, unknown> = {
        server,
        server_port: port,
        uuid: draft.uuid.trim(),
      };
      const flow = draft.flow.trim();
      if (flow) settings.flow = flow;
      return settings;
    }
    case "wireguard": {
      const peer: Record<string, unknown> = {
        address: server,
        port,
        public_key: draft.peerPublicKey.trim(),
        allowed_ips: ["0.0.0.0/0", "::/0"],
      };
      const preSharedKey = draft.preSharedKey.trim();
      if (preSharedKey) peer.pre_shared_key = preSharedKey;

      const settings: Record<string, unknown> = {
        private_key: draft.privateKey.trim(),
        local_address: localAddresses(draft.localAddress),
        peers: [peer],
        mtu: parseMtu(draft.mtu) ?? DEFAULT_WG_MTU,
      };
      const reserved = parseReserved(draft.reserved).values;
      if (reserved.length > 0) settings.reserved = reserved;
      const domainStrategy = draft.domainStrategy.trim();
      const singboxStrategy: Record<string, string> = {
        ForceIPv4: "ipv4_only",
        ForceIPv6: "ipv6_only",
        ipv4_only: "ipv4_only",
        ipv6_only: "ipv6_only",
        prefer_ipv4: "prefer_ipv4",
        prefer_ipv6: "prefer_ipv6",
      };
      if (singboxStrategy[domainStrategy]) {
        settings.domain_strategy = singboxStrategy[domainStrategy];
      }
      return settings;
    }
  }
}

function buildSettings(
  draft: OutboundDraft,
  server: string,
  port: number,
  kernel: KernelKind,
): Record<string, unknown> {
  return kernel === "xray"
    ? buildXraySettings(draft, server, port)
    : buildSingboxSettings(draft, server, port);
}

interface GeneratedEntry {
  outbound: XboardOutbound;
  tagKey: string;
  proxyTag: string;
}

function canonicalCycle(tags: string[]): string[] {
  let best = 0;
  for (let index = 1; index < tags.length; index += 1) {
    if (tags[index].toLowerCase() < tags[best].toLowerCase()) {
      best = index;
    }
  }
  return [...tags.slice(best), ...tags.slice(0, best)];
}

function detectChainCycles(
  entries: GeneratedEntry[],
  errors: string[],
): void {
  const byTag = new Map(entries.map((entry) => [entry.tagKey, entry]));
  const finished = new Set<string>();
  const reported = new Set<string>();

  for (const start of entries) {
    if (finished.has(start.tagKey)) continue;

    const path: GeneratedEntry[] = [];
    const positions = new Map<string, number>();
    let current: GeneratedEntry | undefined = start;

    while (current && !finished.has(current.tagKey)) {
      const cycleStart = positions.get(current.tagKey);
      if (cycleStart !== undefined) {
        const cycle = canonicalCycle(
          path.slice(cycleStart).map((entry) => entry.outbound.tag),
        );
        const key = cycle.map((tag) => tag.toLowerCase()).join("\0");
        if (!reported.has(key)) {
          reported.add(key);
          errors.push(
            `检测到链式代理循环：${[...cycle, cycle[0]].join(" → ")}。`,
          );
        }
        break;
      }

      positions.set(current.tagKey, path.length);
      path.push(current);
      current = current.proxyTag
        ? byTag.get(current.proxyTag.toLowerCase())
        : undefined;
    }

    for (const entry of path) finished.add(entry.tagKey);
  }
}

export function generateOutbounds(
  drafts: OutboundDraft[],
  targetKernel: KernelKind = DEFAULT_KERNEL,
): OutboundGenerationResult {
  const kernel = normalizeKernel(targetKernel);
  const chainField = kernel === "xray" ? "proxy_tag" : "detour";
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: GeneratedEntry[] = [];
  const knownTags = new Set(
    drafts
      .map((draft) => draft.tag.trim().toLowerCase())
      .filter(Boolean),
  );
  const seenTags = new Set<string>();

  for (const [index, draft] of drafts.entries()) {
    const tag = draft.tag.trim();
    const tagKey = tag.toLowerCase();
    const label = tag ? `「${tag}」` : `第 ${index + 1} 个 Outbound`;
    let valid = true;

    if (!tag) {
      errors.push(`${label} 缺少 tag。`);
      valid = false;
    } else {
      if (!isValidTag(tag)) {
        errors.push(
          `${label} 的 tag 无效：不能包含空格或 JSON 特殊字符，且最长 64 个字符。`,
        );
        valid = false;
      }
      if (RESERVED_TAGS.has(tagKey)) {
        errors.push(`${label} 不能使用保留 tag「direct」或「block」。`);
        valid = false;
      }
      if (seenTags.has(tagKey)) {
        errors.push(`${label} 的 tag 与之前的 Outbound 重复（不区分大小写）。`);
        valid = false;
      }
      seenTags.add(tagKey);
    }

    const server = draft.server.trim();
    if (!server) {
      errors.push(`${label} 缺少服务器地址。`);
      valid = false;
    }

    const port = parsePort(draft.port);
    if (port === null) {
      errors.push(`${label} 的端口必须是 1-65535 的整数。`);
      valid = false;
    }

    const proxyTag = draft.proxyTag.trim();
    if (proxyTag) {
      if (tag && proxyTag.toLowerCase() === tagKey) {
        errors.push(`${label} 的 ${chainField} 不能引用自身。`);
        valid = false;
      }

      const proxyKey = proxyTag.toLowerCase();
      if (
        valid &&
        !knownTags.has(proxyKey) &&
        !RESERVED_TAGS.has(proxyKey)
      ) {
        warnings.push(
          `${label} 的 ${chainField}「${proxyTag}」不在当前 Outbounds 列表中，将按节点已有的静态 outbound 处理；请确认 tag 拼写。`,
        );
      }
    }

    switch (draft.protocol) {
      case "socks":
      case "http":
        break;
      case "shadowsocks":
        if (!draft.method.trim()) {
          errors.push(`${label} 的 Shadowsocks method 不能为空。`);
          valid = false;
        }
        if (!draft.password.trim()) {
          errors.push(`${label} 的 Shadowsocks 密码不能为空。`);
          valid = false;
        }
        break;
      case "trojan":
        if (!draft.password.trim()) {
          errors.push(`${label} 的 Trojan 密码不能为空。`);
          valid = false;
        }
        break;
      case "vmess": {
        if (!draft.uuid.trim()) {
          errors.push(`${label} 的 VMess UUID 不能为空。`);
          valid = false;
        }
        if (parseAlterId(draft.alterId) === null) {
          errors.push(`${label} 的 alterId 必须是 0-65535 的整数。`);
          valid = false;
        }
        break;
      }
      case "vless":
        if (!draft.uuid.trim()) {
          errors.push(`${label} 的 VLESS UUID 不能为空。`);
          valid = false;
        }
        break;
      case "wireguard":
        if (!draft.privateKey.trim()) {
          errors.push(`${label} 的 WireGuard privateKey 不能为空。`);
          valid = false;
        }
        if (!draft.peerPublicKey.trim()) {
          errors.push(`${label} 的 WireGuard peerPublicKey 不能为空。`);
          valid = false;
        }
        if (localAddresses(draft.localAddress).length === 0) {
          errors.push(`${label} 的 WireGuard localAddress 不能为空。`);
          valid = false;
        }
        if (!parseReserved(draft.reserved).valid) {
          errors.push(
            `${label} 的 WireGuard reserved 必须是最多 3 个 0-255 的整数，用逗号分隔。`,
          );
          valid = false;
        }
        if (parseMtu(draft.mtu) === null) {
          errors.push(
            `${label} 的 WireGuard mtu 必须是 ${MIN_WG_MTU}-${MAX_WG_MTU} 的整数。`,
          );
          valid = false;
        }
        break;
      default:
        errors.push(`${label} 使用了不支持的协议。`);
        valid = false;
    }

    let extraSettings: Record<string, unknown> | undefined;
    if (draft.extraSettings.trim()) {
      try {
        const parsed: unknown = JSON.parse(draft.extraSettings);
        if (!isPlainObject(parsed)) {
          errors.push(`${label} 的 extraSettings 必须是 JSON 对象。`);
          valid = false;
        } else {
          extraSettings = parsed;
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "无法解析";
        errors.push(`${label} 的 extraSettings 不是有效 JSON：${detail}`);
        valid = false;
      }
    }

    if (!valid || port === null) continue;

    const generated = buildSettings(draft, server, port, kernel);
    let settings = extraSettings
      ? deepMerge(generated, extraSettings)
      : generated;
    if (kernel === "singbox" && proxyTag) {
      settings = { ...settings, detour: proxyTag };
    }
    const settingsError = validateNodeSettings(settings);
    if (settingsError) {
      errors.push(`${label} 的 ${settingsError}`);
      continue;
    }
    const outbound: XboardOutbound = {
      tag,
      protocol: draft.protocol,
      settings,
    };
    if (proxyTag && kernel === "xray") outbound.proxy_tag = proxyTag;
    entries.push({ outbound, tagKey, proxyTag });
  }

  const emittedTags = new Set(entries.map((entry) => entry.tagKey));
  for (const entry of entries) {
    if (!entry.proxyTag || RESERVED_TAGS.has(entry.proxyTag.toLowerCase())) {
      continue;
    }
    const proxyKey = entry.proxyTag.toLowerCase();
    if (knownTags.has(proxyKey) && !emittedTags.has(proxyKey)) {
      errors.push(
        `「${entry.outbound.tag}」的 ${chainField} 指向了未通过校验的 Outbound「${entry.proxyTag}」。`,
      );
    }
  }

  detectChainCycles(entries, errors);

  const outbounds = entries.map((entry) => entry.outbound);
  const json = JSON.stringify(outbounds, null, 2);
  return {
    kernel,
    outbounds,
    json,
    outboundCount: outbounds.length,
    protocolCount: new Set(outbounds.map((outbound) => outbound.protocol))
      .size,
    byteSize: new TextEncoder().encode(json).length,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    tags: outbounds.map((outbound) => outbound.tag),
  };
}
