import { describe, expect, it } from "vitest";
import { allServices, categories, serviceById } from "../data/services";
import {
  generateRoutes,
  normalizeRouteMode,
  parseCustomDomains,
  type GenerationInput,
} from "./routes";

const baseInput: GenerationInput = {
  routeMode: "media",
  selectedIds: new Set(),
  globalTag: "proxy",
  perCategory: false,
  categoryTags: {},
  includeGeosite: false,
  blockAds: false,
  blockTorrent: false,
  customDomains: "",
  customDomainsTag: "",
};

function uniqueExplicitDomainCount(ids: string[]): number {
  return new Set(
    ids.flatMap((id) => serviceById.get(id)?.domains ?? []),
  ).size;
}

describe("generateRoutes", () => {
  it("ships unique, prefixed domain data for every service", () => {
    expect(categories).toHaveLength(7);
    expect(allServices).toHaveLength(55);
    expect(new Set(allServices.map((service) => service.id)).size).toBe(
      allServices.length,
    );

    for (const service of allServices) {
      expect(service.domains.length).toBeGreaterThan(0);
      expect(new Set(service.domains).size).toBe(service.domains.length);
      for (const domain of service.domains) {
        expect(domain).toMatch(/^(domain|full|regexp):.+/);
      }
    }
  });

  it("combines selected platforms into one rule for a shared tag", () => {
    const ids = ["netflix", "disney"];
    const result = generateRoutes({
      ...baseInput,
      selectedIds: new Set(ids),
    });

    expect(result.errors).toEqual([]);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toMatchObject({
      type: "field",
      outboundTag: "proxy",
    });
    expect(result.domainCount).toBe(uniqueExplicitDomainCount(ids));
    expect(JSON.parse(result.json)).toEqual(result.rules);
    expect(result.rules[0].domain?.every((domain) =>
      /^(domain|full|regexp):/.test(domain),
    )).toBe(true);
  });

  it("groups platforms by category tags when per-category routing is on", () => {
    const result = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["netflix", "bilibili"]),
      perCategory: true,
      categoryTags: {
        global: "unlock-global",
        "greater-china": "unlock-hk",
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.rules.map((rule) => rule.outboundTag)).toEqual([
      "unlock-global",
      "unlock-hk",
    ]);
    expect(result.ruleCount).toBe(2);
  });

  it("merges categories that resolve to the same tag", () => {
    const result = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["netflix", "bilibili"]),
      perCategory: true,
      categoryTags: {
        global: "proxy",
        "greater-china": "proxy",
      },
    });

    expect(result.rules).toHaveLength(1);
  });

  it("warns when a domain is routed to more than one outbound", () => {
    const result = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["hbogo", "hbomax"]),
      perCategory: true,
      categoryTags: {
        "greater-china": "unlock-hk",
        "north-america": "unlock-us",
      },
    });

    expect(result.rules).toHaveLength(2);
    expect(result.warnings.join(" ")).toContain("同时命中多个 outboundTag");
  });

  it("adds geosite entries only when requested", () => {
    const withoutGeosite = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["netflix"]),
    });
    const withGeosite = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["netflix"]),
      includeGeosite: true,
    });

    expect(withoutGeosite.rules[0].domain).not.toContain("geosite:netflix");
    expect(withGeosite.rules[0].domain).toContain("geosite:netflix");
    expect(withGeosite.domainCount).toBe(withoutGeosite.domainCount + 1);
  });

  it("prepends an optional bittorrent block rule", () => {
    const result = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["netflix"]),
      blockTorrent: true,
    });

    expect(result.rules[0]).toEqual({
      type: "field",
      outboundTag: "block",
      protocol: ["bittorrent"],
    });
  });

  it("directs private networks before the full-traffic proxy rule", () => {
    const result = generateRoutes({
      ...baseInput,
      routeMode: "global",
    });

    expect(result.errors).toEqual([]);
    expect(result.mode).toBe("global");
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0]).toMatchObject({
      type: "field",
      outboundTag: "direct",
      ip: expect.arrayContaining([
        "10.0.0.0/8",
        "192.168.0.0/16",
        "::1/128",
      ]),
    });
    expect(result.rules[1]).toEqual({
      type: "field",
      outboundTag: "proxy",
      network: "tcp,udp",
    });
  });

  it("routes mainland and private traffic direct before the global fallback", () => {
    const result = generateRoutes({
      ...baseInput,
      routeMode: "bypass",
      selectedIds: new Set(["netflix"]),
    });

    expect(result.errors).toEqual([]);
    expect(result.rules).toHaveLength(4);
    expect(result.rules[0]).toMatchObject({
      outboundTag: "proxy",
      domain: expect.arrayContaining(["domain:netflix.com"]),
    });
    expect(result.rules[1]).toEqual({
      type: "field",
      outboundTag: "direct",
      domain: ["geosite:cn"],
    });
    expect(result.rules[2]).toMatchObject({
      type: "field",
      outboundTag: "direct",
      ip: expect.arrayContaining([
        "10.0.0.0/8",
        "192.168.0.0/16",
        "geoip:cn",
      ]),
    });
    expect(result.rules[3]).toEqual({
      type: "field",
      outboundTag: "proxy",
      network: "tcp,udp",
    });
    expect(result.warnings.join(" ")).toContain("geosite.dat");
  });

  it("adds a full-traffic direct rule in direct mode", () => {
    const result = generateRoutes({
      ...baseInput,
      routeMode: "direct",
    });

    expect(result.errors).toEqual([]);
    expect(result.rules).toEqual([
      {
        type: "field",
        outboundTag: "direct",
        network: "tcp,udp",
      },
    ]);
  });

  it("prepends an optional ad block rule", () => {
    const result = generateRoutes({
      ...baseInput,
      routeMode: "global",
      blockAds: true,
    });

    expect(result.rules[0]).toEqual({
      type: "field",
      outboundTag: "block",
      domain: ["geosite:category-ads-all"],
    });
    expect(result.rules).toHaveLength(3);
    expect(result.rules.at(-1)).toEqual({
      type: "field",
      outboundTag: "proxy",
      network: "tcp,udp",
    });
    expect(result.warnings.join(" ")).toContain("category-ads-all");
  });

  it("requires a valid fallback tag for takeover modes", () => {
    const result = generateRoutes({
      ...baseInput,
      routeMode: "global",
      globalTag: "not valid",
    });

    expect(result.errors.join(" ")).toContain("全局 outboundTag");
    expect(result.rules).toEqual([]);
    expect(result.json).toBe("[]");
  });

  it("reports invalid outbound tags and does not emit broken rules", () => {
    const result = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["netflix"]),
      globalTag: "not valid",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.rules).toHaveLength(0);
    expect(result.json).toBe("[]");
  });

  it("accepts custom domains and groups them under their own tag", () => {
    const result = generateRoutes({
      ...baseInput,
      selectedIds: new Set(["netflix"]),
      customDomains:
        "# comment\nexample.com\n*.example.net\nhttps://video.example.org/watch",
      customDomainsTag: "custom-out",
    });

    expect(result.errors).toEqual([]);
    const customRule = result.rules.find(
      (rule) => rule.outboundTag === "custom-out",
    );
    expect(customRule?.domain).toEqual([
      "domain:example.com",
      "domain:example.net",
      "domain:video.example.org",
    ]);
  });
});

describe("normalizeRouteMode", () => {
  it("keeps supported modes and falls back to media for legacy values", () => {
    expect(normalizeRouteMode("global")).toBe("global");
    expect(normalizeRouteMode("bypass")).toBe("bypass");
    expect(normalizeRouteMode("direct")).toBe("direct");
    expect(normalizeRouteMode("unknown")).toBe("media");
    expect(normalizeRouteMode(undefined)).toBe("media");
  });
});

describe("parseCustomDomains", () => {
  it("normalizes URLs and wildcards and reports invalid input", () => {
    const parsed = parseCustomDomains(`
      https://WWW.Example.com/path
      *.example.net
      full:assets.example.org
      not_a_domain
    `);

    expect(parsed.domains).toEqual([
      "domain:www.example.com",
      "domain:example.net",
      "full:assets.example.org",
    ]);
    expect(parsed.invalid).toHaveLength(1);
  });
});
