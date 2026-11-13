import { describe, expect, it } from "vitest";
import { allServices, categories, serviceById } from "../data/services";
import {
  generateRoutes,
  parseCustomDomains,
  type GenerationInput,
} from "./routes";

const baseInput: GenerationInput = {
  selectedIds: new Set(),
  globalTag: "proxy",
  perCategory: false,
  categoryTags: {},
  includeGeosite: false,
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
