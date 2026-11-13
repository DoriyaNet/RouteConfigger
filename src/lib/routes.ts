import { categories, serviceById } from "../data/services";
import {
  DEFAULT_KERNEL,
  normalizeKernel,
  type KernelKind,
} from "./kernel";

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

export interface SingboxRouteRule {
  action: "route" | "reject" | "sniff";
  outbound?: string;
  domain?: string[];
  domain_suffix?: string[];
  domain_regex?: string[];
  ip_cidr?: string[];
  protocol?: string[];
  network?: Array<"tcp" | "udp">;
}

export type GeneratedRouteRule = XrayRouteRule | SingboxRouteRule;

export interface GenerationInput {
  kernel?: KernelKind;
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
  kernel: KernelKind;
  mode: RouteMode;
  rules: GeneratedRouteRule[];
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

function singboxRoute(
  outbound: string,
  fields: Omit<SingboxRouteRule, "action" | "outbound"> = {},
): SingboxRouteRule {
  return { action: "route", outbound, ...fields };
}

export function generateRoutes(input: GenerationInput): GenerationResult {
  const kernel = normalizeKernel(input.kernel ?? DEFAULT_KERNEL);
  const routeMode = normalizeRouteMode(input.routeMode);
  const globalTag = normalizeTag(input.globalTag);
  const errors: string[] = [];
  const warnings: string[] = [];
  const groupedDomains = new Map<string, string[]>();
  const selectedServiceCount = input.selectedIds.size;
  const globalTagValid = isValidTag(globalTag);
  const parsedCustom = parseCustomDomains(input.customDomains);
  const customTag = normalizeTag(input.customDomainsTag);
  const routeFieldName = kernel === "xray" ? "outboundTag" : "outbound";
  const requiresGlobalTag =
    routeMode === "global" ||
    routeMode === "bypass" ||
    (!input.perCategory && selectedServiceCount > 0) ||
    (parsedCustom.domains.length > 0 && !customTag);

  if (requiresGlobalTag && !globalTagValid) {
    errors.push(
      `请填写有效的全局 ${routeFieldName}（不能包含空格或 JSON 特殊字符）。`,
    );
  }
  if (kernel === "singbox" && routeMode === "bypass") {
    errors.push(
      "sing-box 原生自定义 Routes 不支持 geosite:cn / geoip:cn。请改用 Xray 内核，或使用 sing-box rule_set 配置规则集。",
    );
  }
  if (kernel === "singbox" && input.blockAds) {
    errors.push(
      "sing-box 原生自定义 Routes 不支持 geosite:category-ads-all。请改用 Xray 内核，或通过 sing-box rule_set 拦截广告。",
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
      errors.push(`「${category.name}」的 ${routeFieldName} 无效。`);
      continue;
    }

    const bucket = groupedDomains.get(tag) ?? [];
    for (const service of categoryServices) {
      addDomains(bucket, service.domains);
      if (
        kernel === "xray" &&
        input.includeGeosite &&
        service.geosite
      ) {
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
      errors.push(`自定义域名规则的 ${routeFieldName} 无效。`);
    } else {
      const bucket = groupedDomains.get(resolvedCustomTag) ?? [];
      addDomains(bucket, parsedCustom.domains);
      groupedDomains.set(resolvedCustomTag, bucket);
    }
  }

  const rules: GeneratedRouteRule[] = [];
  if (input.blockAds && kernel === "xray") {
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
    if (kernel === "singbox") {
      rules.push({ action: "sniff" });
    }
    rules.push(
      kernel === "xray"
        ? {
            type: "field",
            outboundTag: "block",
            protocol: ["bittorrent"],
          }
        : {
            action: "reject",
            protocol: ["bittorrent"],
          },
    );
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
    const kernelName = kernel === "xray" ? "Xray" : "sing-box";
    warnings.push(
      `${overlappingDomains.size} 个域名同时命中多个 ${routeFieldName}，${kernelName} 会按规则顺序优先匹配。`,
    );
  }

  let domainCount = 0;
  let skippedGeositeCount = 0;
  for (const [outboundTag, domains] of groupedDomains) {
    const unique = [...new Set(domains)].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    if (unique.length === 0) continue;

    if (kernel === "xray") {
      domainCount += unique.length;
      rules.push({
        type: "field",
        outboundTag,
        domain: unique,
      });
      continue;
    }

    const exact: string[] = [];
    const suffix: string[] = [];
    const regex: string[] = [];
    for (const domain of unique) {
      if (domain.startsWith("geosite:")) {
        skippedGeositeCount += 1;
      } else if (domain.startsWith("full:")) {
        exact.push(domain.slice(5));
      } else if (domain.startsWith("regexp:")) {
        regex.push(domain.slice(7));
      } else if (domain.startsWith("domain:")) {
        suffix.push(domain.slice(7));
      } else {
        suffix.push(domain);
      }
    }

    if (exact.length === 0 && suffix.length === 0 && regex.length === 0) {
      continue;
    }
    domainCount += exact.length + suffix.length + regex.length;
    rules.push(
      singboxRoute(outboundTag, {
        ...(exact.length > 0 ? { domain: exact } : {}),
        ...(suffix.length > 0 ? { domain_suffix: suffix } : {}),
        ...(regex.length > 0 ? { domain_regex: regex } : {}),
      }),
    );
  }

  if (skippedGeositeCount > 0) {
    warnings.push(
      `sing-box 原生规则不支持 geosite: 字段，已跳过 ${skippedGeositeCount} 条 geosite 规则。`,
    );
  }
  if (kernel === "singbox" && input.includeGeosite) {
    warnings.push(
      "sing-box 模式不会写入平台 geosite；请使用显式域名，或配置 sing-box rule_set。",
    );
  }

  if (
    (routeMode === "global" || routeMode === "bypass") &&
    globalTagValid
  ) {
    if (kernel === "xray") {
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
    } else if (routeMode === "global") {
      rules.push(
        singboxRoute("direct", {
          ip_cidr: [...PRIVATE_IP_RANGES],
        }),
        singboxRoute(globalTag, {
          network: ["tcp", "udp"],
        }),
      );
    }
  }
  if (routeMode === "direct") {
    rules.push(
      kernel === "xray"
        ? {
            type: "field",
            outboundTag: "direct",
            network: "tcp,udp",
          }
        : singboxRoute("direct", {
            network: ["tcp", "udp"],
          }),
    );
  }

  if (routeMode === "bypass" && kernel === "xray") {
    warnings.push(
      "绕过大陆模式使用 geosite:cn 与 geoip:cn，请确认节点已包含 geosite.dat 与 geoip.dat；Xboard Node 使用 AsIs 域名策略，IP 规则只匹配目标为 IP 的连接。",
    );
  }

  const json = JSON.stringify(rules, null, 2);
  const tags = rules
    .map((rule) =>
      "outboundTag" in rule ? rule.outboundTag : rule.outbound,
    )
    .filter((tag): tag is string => Boolean(tag));

  return {
    kernel,
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
    tags: [...new Set(tags)],
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
