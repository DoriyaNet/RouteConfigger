import { categories, serviceById } from "../data/services";

export const ROUTE_MODES = ["media", "global", "bypass", "direct"] as const;

export type RouteMode = (typeof ROUTE_MODES)[number];

export function normalizeRouteMode(value: unknown): RouteMode {
  return typeof value === "string" &&
    (ROUTE_MODES as readonly string[]).includes(value)
    ? (value as RouteMode)
    : "media";
}

export interface XrayRouteRule {
  type: "field";
  outboundTag: string;
  domain?: string[];
  ip?: string[];
  protocol?: string[];
  network?: string;
}

export interface GenerationInput {
  routeMode: RouteMode;
  selectedIds: ReadonlySet<string>;
  globalTag: string;
  perCategory: boolean;
  categoryTags: Readonly<Record<string, string>>;
  includeGeosite: boolean;
  blockAds: boolean;
  blockTorrent: boolean;
  customDomains: string;
  customDomainsTag: string;
}

export interface ParsedCustomDomains {
  domains: string[];
  invalid: string[];
}

export interface GenerationResult {
  mode: RouteMode;
  rules: XrayRouteRule[];
  json: string;
  ruleCount: number;
  domainCount: number;
  selectedServiceCount: number;
  customDomainCount: number;
  byteSize: number;
  errors: string[];
  warnings: string[];
  tags: string[];
}

const DOMAIN_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const DOMAIN_PATTERN = new RegExp(
  `^(?=.{1,253}$)(?:${DOMAIN_LABEL}\\.)+${DOMAIN_LABEL}\\.?$`,
  "i",
);

const PRIVATE_IP_RANGES = [
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "fc00::/7",
  "fe80::/10",
  "::1/128",
];

export const TAG_PATTERN = /^[^\s,{}[\]"'`]+$/;

export function normalizeTag(value: string): string {
  return value.trim();
}

export function isValidTag(value: string): boolean {
  const tag = normalizeTag(value);
  return tag.length > 0 && tag.length <= 64 && TAG_PATTERN.test(tag);
}

function normalizeDomain(prefix: string, value: string): string | null {
  const raw = value.trim().replace(/\.$/, "");
  if (!raw) return null;

  if (prefix === "regexp:") {
    return raw ? `regexp:${raw}` : null;
  }

  const lowered = raw.toLowerCase();
  if (!DOMAIN_PATTERN.test(lowered)) return null;
  return `${prefix}${lowered}`;
}

function domainFromLine(line: string): string | null {
  let value = line.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const hostname = new URL(value).hostname;
      return normalizeDomain("domain:", hostname);
    } catch {
      return null;
    }
  }

  value = value.replace(/^https?:\/\//i, "");
  if (value.startsWith("*.")) return normalizeDomain("domain:", value.slice(2));

  const prefixed = value.match(/^(domain|full|regexp):(.*)$/i);
  if (prefixed) {
    return normalizeDomain(`${prefixed[1].toLowerCase()}:`, prefixed[2]);
  }

  return normalizeDomain("domain:", value);
}

export function parseCustomDomains(input: string): ParsedCustomDomains {
  const domains: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    for (const token of line.split(/[\s,;]+/).filter(Boolean)) {
      const parsed = domainFromLine(token);
      if (!parsed) {
        if (invalid.length < 8) invalid.push(token);
        continue;
      }
      if (!seen.has(parsed)) {
        seen.add(parsed);
        domains.push(parsed);
      }
    }
  }

  return { domains, invalid };
}

function addDomains(target: string[], domains: readonly string[]) {
  for (const domain of domains) {
    const normalized =
      domain.startsWith("regexp:") ? domain : domain.toLowerCase();
    target.push(normalized);
  }
}

export function generateRoutes(input: GenerationInput): GenerationResult {
  const routeMode = normalizeRouteMode(input.routeMode);
  const globalTag = normalizeTag(input.globalTag);
  const errors: string[] = [];
  const warnings: string[] = [];
  const groupedDomains = new Map<string, string[]>();
  const selectedServiceCount = input.selectedIds.size;
  const globalTagValid = isValidTag(globalTag);
  const parsedCustom = parseCustomDomains(input.customDomains);
  const customTag = normalizeTag(input.customDomainsTag);
  const requiresGlobalTag =
    routeMode === "global" ||
    routeMode === "bypass" ||
    (!input.perCategory && selectedServiceCount > 0) ||
    (parsedCustom.domains.length > 0 && !customTag);

  if (requiresGlobalTag && !globalTagValid) {
    errors.push(
      "请填写有效的全局 outboundTag（不能包含空格或 JSON 特殊字符）。",
    );
  }

  for (const category of categories) {
    const categoryServices = category.services.filter((service) =>
      input.selectedIds.has(service.id),
    );
    if (categoryServices.length === 0) continue;
    if (!input.perCategory && !globalTagValid) continue;

    const tag = input.perCategory
      ? normalizeTag(input.categoryTags[category.id] ?? "")
      : globalTag;

    if (!isValidTag(tag)) {
      errors.push(`「${category.name}」的 outboundTag 无效。`);
      continue;
    }

    const bucket = groupedDomains.get(tag) ?? [];
    for (const service of categoryServices) {
      addDomains(bucket, service.domains);
      if (input.includeGeosite && service.geosite) {
        addDomains(bucket, service.geosite);
      }
    }
    groupedDomains.set(tag, bucket);
  }

  if (parsedCustom.invalid.length > 0) {
    warnings.push(
      `${parsedCustom.invalid.length} 条自定义域名格式无法识别，已跳过：${parsedCustom.invalid.join("、")}`,
    );
  }
  if (parsedCustom.domains.length > 0) {
    const resolvedCustomTag = customTag || globalTag;
    if (!isValidTag(resolvedCustomTag)) {
      errors.push("自定义域名规则的 outboundTag 无效。");
    } else {
      const bucket = groupedDomains.get(resolvedCustomTag) ?? [];
      addDomains(bucket, parsedCustom.domains);
      groupedDomains.set(resolvedCustomTag, bucket);
    }
  }

  const rules: XrayRouteRule[] = [];
  if (input.blockAds) {
    rules.push({
      type: "field",
      outboundTag: "block",
      domain: ["geosite:category-ads-all"],
    });
    warnings.push(
      "广告拦截使用 geosite:category-ads-all，请确认节点已包含 geosite.dat。",
    );
  }
  if (input.blockTorrent) {
    rules.push({
      type: "field",
      outboundTag: "block",
      protocol: ["bittorrent"],
    });
  }

  const domainOwners = new Map<string, string>();
  const overlappingDomains = new Set<string>();
  for (const [tag, domains] of groupedDomains) {
    for (const domain of new Set(domains)) {
      const existingTag = domainOwners.get(domain);
      if (existingTag && existingTag !== tag) {
        overlappingDomains.add(domain);
      } else {
        domainOwners.set(domain, tag);
      }
    }
  }
  if (overlappingDomains.size > 0) {
    warnings.push(
      `${overlappingDomains.size} 个域名同时命中多个 outboundTag，Xray 会按规则顺序优先匹配。`,
    );
  }

  let domainCount = 0;
  for (const [outboundTag, domains] of groupedDomains) {
    const unique = [...new Set(domains)].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    if (unique.length === 0) continue;
    domainCount += unique.length;
    rules.push({
      type: "field",
      outboundTag,
      domain: unique,
    });
  }

  if (
    (routeMode === "global" || routeMode === "bypass") &&
    globalTagValid
  ) {
    if (routeMode === "bypass") {
      rules.push({
        type: "field",
        outboundTag: "direct",
        domain: ["geosite:cn"],
      });
      rules.push({
        type: "field",
        outboundTag: "direct",
        ip: [...PRIVATE_IP_RANGES, "geoip:cn"],
      });
    } else {
      rules.push({
        type: "field",
        outboundTag: "direct",
        ip: PRIVATE_IP_RANGES,
      });
    }
    rules.push({
      type: "field",
      outboundTag: globalTag,
      network: "tcp,udp",
    });
  }
  if (routeMode === "direct") {
    rules.push({
      type: "field",
      outboundTag: "direct",
      network: "tcp,udp",
    });
  }

  if (routeMode === "bypass") {
    warnings.push(
      "绕过大陆模式使用 geosite:cn 与 geoip:cn，请确认节点已包含 geosite.dat 与 geoip.dat；Xboard Node 使用 AsIs 域名策略，IP 规则只匹配目标为 IP 的连接。",
    );
  }

  const json = JSON.stringify(rules, null, 2);
  return {
    mode: routeMode,
    rules,
    json,
    ruleCount: rules.length,
    domainCount,
    selectedServiceCount,
    customDomainCount: parsedCustom.domains.length,
    byteSize: new TextEncoder().encode(json).length,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    tags: [...new Set(rules.map((rule) => rule.outboundTag))],
  };
}

export function getServiceDomainCount(serviceIds: Iterable<string>, includeGeosite = false): number {
  const domains = new Set<string>();
  for (const id of serviceIds) {
    const service = serviceById.get(id);
    if (!service) continue;
    for (const domain of service.domains) domains.add(domain.toLowerCase());
    if (includeGeosite && service.geosite) {
      for (const domain of service.geosite) domains.add(domain);
    }
  }
  return domains.size;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
