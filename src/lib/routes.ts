import { categories, serviceById } from "../data/services";

export interface XrayRouteRule {
  type: "field";
  outboundTag: string;
  domain?: string[];
  protocol?: string[];
}

export interface GenerationInput {
  selectedIds: ReadonlySet<string>;
  globalTag: string;
  perCategory: boolean;
  categoryTags: Readonly<Record<string, string>>;
  includeGeosite: boolean;
  blockTorrent: boolean;
  customDomains: string;
  customDomainsTag: string;
}

export interface ParsedCustomDomains {
  domains: string[];
  invalid: string[];
}

export interface GenerationResult {
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
  const globalTag = normalizeTag(input.globalTag);
  const errors: string[] = [];
  const warnings: string[] = [];
  const groupedDomains = new Map<string, string[]>();
  const selectedServiceCount = input.selectedIds.size;
  const globalTagValid = isValidTag(globalTag);

  if (!input.perCategory && selectedServiceCount > 0 && !globalTagValid) {
    errors.push("请填写有效的全局 outboundTag（不能包含空格或 JSON 特殊字符）。");
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

  const parsedCustom = parseCustomDomains(input.customDomains);
  if (parsedCustom.invalid.length > 0) {
    warnings.push(
      `${parsedCustom.invalid.length} 条自定义域名格式无法识别，已跳过：${parsedCustom.invalid.join("、")}`,
    );
  }
  if (parsedCustom.domains.length > 0) {
    const customTag =
      normalizeTag(input.customDomainsTag) || globalTag;
    if (!isValidTag(customTag)) {
      errors.push("自定义域名规则的 outboundTag 无效。");
    } else {
      const bucket = groupedDomains.get(customTag) ?? [];
      addDomains(bucket, parsedCustom.domains);
      groupedDomains.set(customTag, bucket);
    }
  }

  const rules: XrayRouteRule[] = [];
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

  const json = JSON.stringify(rules, null, 2);
  return {
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
