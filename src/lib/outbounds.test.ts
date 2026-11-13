import { describe, expect, it } from "vitest";
import {
  WARP_PUBLIC_KEY,
  createOutboundDraft,
  generateOutbounds,
  isValidTag,
  type OutboundDraft,
  type OutboundProtocol,
} from "./outbounds";

const baseDraft: OutboundDraft = {
  id: "draft",
  tag: "proxy",
  protocol: "socks",
  server: "proxy.example.com",
  port: "1080",
  username: "",
  password: "",
  method: "aes-256-gcm",
  uuid: "",
  alterId: "0",
  security: "auto",
  flow: "",
  privateKey: "",
  peerPublicKey: "",
  preSharedKey: "",
  localAddress: "",
  mtu: "",
  reserved: "",
  domainStrategy: "",
  proxyTag: "",
  extraSettings: "",
};

function draft(
  protocol: OutboundProtocol,
  overrides: Partial<OutboundDraft> = {},
): OutboundDraft {
  return {
    ...baseDraft,
    id: `${protocol}-draft`,
    tag: `${protocol}-out`,
    protocol,
    ...overrides,
  };
}

function wireGuardDraft(
  overrides: Partial<OutboundDraft> = {},
): OutboundDraft {
  return draft("wireguard", {
    tag: "warp",
    server: "engage.cloudflareclient.com",
    port: "2408",
    privateKey: "private-key",
    peerPublicKey: WARP_PUBLIC_KEY,
    localAddress: "172.16.0.2/32",
    mtu: "1280",
    domainStrategy: "ForceIP",
    ...overrides,
  });
}

describe("generateOutbounds protocol settings", () => {
  it("builds Xray settings for all seven protocols", () => {
    const result = generateOutbounds([
      draft("socks"),
      draft("http", {
        username: "http-user",
        password: "http-pass",
      }),
      draft("shadowsocks", {
        method: "chacha20-ietf-poly1305",
        password: "ss-pass",
      }),
      draft("trojan", {
        password: "trojan-pass",
      }),
      draft("vmess", {
        uuid: "vmess-uuid",
        alterId: "0",
        security: "auto",
      }),
      draft("vless", {
        uuid: "vless-uuid",
        flow: "xtls-rprx-vision",
      }),
      wireGuardDraft(),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.outboundCount).toBe(7);
    expect(result.protocolCount).toBe(7);
    expect(result.tags).toEqual([
      "socks-out",
      "http-out",
      "shadowsocks-out",
      "trojan-out",
      "vmess-out",
      "vless-out",
      "warp",
    ]);

    expect(result.outbounds[0].settings).toEqual({
      servers: [
        {
          address: "proxy.example.com",
          port: 1080,
        },
      ],
    });
    expect(result.outbounds[1]).toMatchObject({
      protocol: "http",
      settings: {
        servers: [
          {
            address: "proxy.example.com",
            port: 1080,
            users: [{ user: "http-user", pass: "http-pass" }],
          },
        ],
      },
    });
    expect(result.outbounds[2].settings).toEqual({
      servers: [
        {
          address: "proxy.example.com",
          port: 1080,
          method: "chacha20-ietf-poly1305",
          password: "ss-pass",
        },
      ],
    });
    expect(result.outbounds[3].settings).toEqual({
      servers: [
        {
          address: "proxy.example.com",
          port: 1080,
          password: "trojan-pass",
        },
      ],
    });
    expect(result.outbounds[4].settings).toEqual({
      vnext: [
        {
          address: "proxy.example.com",
          port: 1080,
          users: [
            {
              id: "vmess-uuid",
              alterId: 0,
              security: "auto",
            },
          ],
        },
      ],
    });
    expect(result.outbounds[5].settings).toEqual({
      vnext: [
        {
          address: "proxy.example.com",
          port: 1080,
          users: [
            {
              id: "vless-uuid",
              encryption: "none",
              flow: "xtls-rprx-vision",
            },
          ],
        },
      ],
    });
    expect(result.outbounds[6].settings).toEqual({
      secretKey: "private-key",
      address: ["172.16.0.2/32"],
      peers: [
        {
          endpoint: "engage.cloudflareclient.com:2408",
          publicKey: WARP_PUBLIC_KEY,
          keepAlive: 0,
          allowedIPs: ["0.0.0.0/0", "::/0"],
        },
      ],
      mtu: 1280,
      domainStrategy: "ForceIP",
    });
  });

  it("adds users when either SOCKS credential is present", () => {
    const result = generateOutbounds([
      draft("socks", {
        username: "user-only",
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.outbounds[0].settings).toEqual({
      servers: [
        {
          address: "proxy.example.com",
          port: 1080,
          users: [{ user: "user-only", pass: "" }],
        },
      ],
    });
  });

  it("includes optional WireGuard fields and parses numeric values", () => {
    const result = generateOutbounds([
      wireGuardDraft({
        preSharedKey: "pre-shared",
        reserved: "1, 2, 3",
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.outbounds[0].settings).toMatchObject({
      peers: [
        {
          preSharedKey: "pre-shared",
        },
      ],
      mtu: 1280,
      reserved: [1, 2, 3],
    });
  });
});

describe("sing-box outbounds", () => {
  it("uses flat settings for every supported protocol", () => {
    const result = generateOutbounds(
      [
        draft("socks", {
          username: "socks-user",
          password: "{{SECRET_x3v8m2qk}}",
        }),
        draft("http", {
          username: "http-user",
          password: "http-pass",
        }),
        draft("shadowsocks", {
          method: "chacha20-ietf-poly1305",
          password: "ss-pass",
        }),
        draft("trojan", {
          password: "trojan-pass",
        }),
        draft("vmess", {
          uuid: "vmess-uuid",
          alterId: "0",
          security: "auto",
        }),
        draft("vless", {
          uuid: "vless-uuid",
          flow: "xtls-rprx-vision",
        }),
        wireGuardDraft({
          preSharedKey: "pre-shared",
          reserved: "1, 2, 3",
          domainStrategy: "ForceIPv4",
        }),
      ],
      "singbox",
    );

    expect(result.errors).toEqual([]);
    expect(result.kernel).toBe("singbox");
    expect(result.outbounds[0].settings).toEqual({
      server: "proxy.example.com",
      server_port: 1080,
      version: "5",
      username: "socks-user",
      password: "{{SECRET_x3v8m2qk}}",
    });
    expect(result.outbounds[1].settings).toEqual({
      server: "proxy.example.com",
      server_port: 1080,
      username: "http-user",
      password: "http-pass",
    });
    expect(result.outbounds[2].settings).toEqual({
      server: "proxy.example.com",
      server_port: 1080,
      method: "chacha20-ietf-poly1305",
      password: "ss-pass",
    });
    expect(result.outbounds[3].settings).toEqual({
      server: "proxy.example.com",
      server_port: 1080,
      password: "trojan-pass",
    });
    expect(result.outbounds[4].settings).toEqual({
      server: "proxy.example.com",
      server_port: 1080,
      uuid: "vmess-uuid",
      security: "auto",
      alter_id: 0,
    });
    expect(result.outbounds[5].settings).toEqual({
      server: "proxy.example.com",
      server_port: 1080,
      uuid: "vless-uuid",
      flow: "xtls-rprx-vision",
    });
    expect(result.outbounds[6].settings).toMatchObject({
      private_key: "private-key",
      local_address: ["172.16.0.2/32"],
      peers: [
        {
          address: "engage.cloudflareclient.com",
          port: 2408,
          public_key: WARP_PUBLIC_KEY,
          pre_shared_key: "pre-shared",
          allowed_ips: ["0.0.0.0/0", "::/0"],
        },
      ],
      reserved: [1, 2, 3],
      domain_strategy: "ipv4_only",
    });
    expect(result.outbounds[0].settings).not.toHaveProperty("servers");
  });

  it("maps chains to the sing-box detour dial field", () => {
    const result = generateOutbounds(
      [
        draft("socks", { tag: "front", proxyTag: "back" }),
        draft("http", { tag: "back" }),
      ],
      "singbox",
    );

    expect(result.errors).toEqual([]);
    expect(result.outbounds[0].settings).toMatchObject({ detour: "back" });
    expect(result.outbounds[0]).not.toHaveProperty("proxy_tag");
  });

  it("allows extra settings to add sing-box TLS and transport fields", () => {
    const result = generateOutbounds(
      [
        draft("vless", {
          uuid: "vless-uuid",
          extraSettings: JSON.stringify({
            tls: { enabled: true, server_name: "example.com" },
            transport: { type: "ws", path: "/ws" },
          }),
        }),
      ],
      "singbox",
    );

    expect(result.errors).toEqual([]);
    expect(result.outbounds[0].settings).toMatchObject({
      tls: { enabled: true, server_name: "example.com" },
      transport: { type: "ws", path: "/ws" },
    });
  });
});

describe("createOutboundDraft", () => {
  it("creates Cloudflare WARP defaults for WireGuard", () => {
    const created = createOutboundDraft("wireguard");

    expect(created).toMatchObject({
      tag: "warp",
      protocol: "wireguard",
      server: "engage.cloudflareclient.com",
      port: "2408",
      privateKey: "",
      peerPublicKey: WARP_PUBLIC_KEY,
      localAddress: "172.16.0.2/32",
      mtu: "1280",
      reserved: "",
      domainStrategy: "ForceIP",
    });
  });

  it("creates unique, case-insensitive tags and avoids reserved tags", () => {
    expect(createOutboundDraft("socks").tag).toBe("proxy");
    expect(createOutboundDraft("socks", ["PROXY"]).tag).toBe("proxy-2");
    expect(createOutboundDraft("socks", ["proxy", "proxy-2"]).tag).toBe(
      "proxy-3",
    );
    expect(createOutboundDraft("http", ["direct"]).tag).toBe("http-out");
    expect(createOutboundDraft("wireguard", ["warp"]).tag).toBe("warp-2");
  });
});

describe("tag validation", () => {
  it("rejects duplicate tags case-insensitively and keeps the first entry", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "Proxy" }),
      draft("http", { tag: "proxy" }),
    ]);

    expect(result.outboundCount).toBe(1);
    expect(result.outbounds[0].tag).toBe("Proxy");
    expect(result.errors.join(" ")).toContain("重复");
  });

  it("rejects reserved direct and block tags", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "direct" }),
      draft("http", { tag: "BLOCK" }),
    ]);

    expect(result.outboundCount).toBe(0);
    expect(result.json).toBe("[]");
    expect(result.errors.join(" ")).toContain("保留 tag");
  });

  it("reuses the routes tag rules", () => {
    expect(isValidTag("proxy-out")).toBe(true);
    expect(isValidTag("not valid")).toBe(false);
    expect(isValidTag("")).toBe(false);
  });
});

describe("draft validation", () => {
  it("rejects invalid ports", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "zero", port: "0" }),
      draft("socks", { tag: "high", port: "65536" }),
      draft("socks", { tag: "decimal", port: "80.5" }),
      draft("socks", { tag: "text", port: "http" }),
    ]);

    expect(result.outboundCount).toBe(0);
    expect(result.errors).toHaveLength(4);
    expect(result.errors.join(" ")).toContain("1-65535");
  });

  it("rejects missing protocol credentials", () => {
    const result = generateOutbounds([
      draft("shadowsocks", { tag: "ss-method", method: "" }),
      draft("shadowsocks", { tag: "ss-password" }),
      draft("trojan", { tag: "trojan" }),
      draft("vmess", { tag: "vmess" }),
      draft("vless", { tag: "vless" }),
      wireGuardDraft({
        tag: "wg",
        privateKey: "",
        peerPublicKey: "",
        localAddress: "",
      }),
    ]);

    const text = result.errors.join(" ");
    expect(result.outboundCount).toBe(0);
    expect(text).toContain("Shadowsocks method");
    expect(text).toContain("Shadowsocks 密码");
    expect(text).toContain("Trojan 密码");
    expect(text).toContain("VMess UUID");
    expect(text).toContain("VLESS UUID");
    expect(text).toContain("privateKey");
    expect(text).toContain("peerPublicKey");
    expect(text).toContain("localAddress");
  });

  it("validates WireGuard reserved values and MTU", () => {
    const result = generateOutbounds([
      wireGuardDraft({ tag: "too-many", reserved: "1,2,3,4" }),
      wireGuardDraft({ tag: "too-large", reserved: "256" }),
      wireGuardDraft({ tag: "fraction", reserved: "1.5" }),
      wireGuardDraft({ tag: "low-mtu", mtu: "0" }),
      wireGuardDraft({ tag: "bad-mtu", mtu: "large" }),
    ]);

    expect(result.outboundCount).toBe(0);
    expect(result.errors.filter((error) => error.includes("reserved"))).toHaveLength(
      3,
    );
    expect(result.errors.filter((error) => error.includes("mtu"))).toHaveLength(
      2,
    );
  });

  it("uses settings defaults for optional protocol values", () => {
    const result = generateOutbounds([
      draft("shadowsocks", {
        tag: "ss",
        method: "aes-256-gcm",
        password: "password",
      }),
      draft("vmess", {
        tag: "vmess",
        uuid: "uuid",
        alterId: "",
        security: "",
      }),
      draft("vless", {
        tag: "vless",
        uuid: "uuid",
        flow: "",
      }),
      wireGuardDraft({
        tag: "wg",
        mtu: "",
        domainStrategy: "",
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.outbounds[1].settings).toMatchObject({
      vnext: [{ users: [{ alterId: 0, security: "auto" }] }],
    });
    expect(result.outbounds[2].settings).toMatchObject({
      vnext: [
        {
          users: [{ id: "uuid", encryption: "none" }],
        },
      ],
    });
    expect(result.outbounds[2].settings).not.toHaveProperty(
      "vnext.0.users.0.flow",
    );
    expect(result.outbounds[3].settings).toMatchObject({
      mtu: 1420,
      domainStrategy: "ForceIP",
    });
  });
});

describe("chain proxy", () => {
  it("emits snake_case proxy_tag for generated chains", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "front", proxyTag: "back" }),
      draft("http", { tag: "back" }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.outbounds[0].proxy_tag).toBe("back");
    expect(result.outbounds[1]).not.toHaveProperty("proxy_tag");
  });

  it("warns for external proxy tags except direct and block", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "a", proxyTag: "node-static" }),
      draft("socks", { tag: "b", proxyTag: "direct" }),
      draft("socks", { tag: "c", proxyTag: "block" }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("node-static");
  });

  it("rejects self references", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "loop", proxyTag: "LOOP" }),
    ]);

    expect(result.errors.join(" ")).toContain("不能引用自身");
  });

  it("rejects references to a known outbound that failed validation", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "front", proxyTag: "broken" }),
      draft("trojan", { tag: "broken" }),
    ]);

    expect(result.outboundCount).toBe(1);
    expect(result.outbounds[0].tag).toBe("front");
    expect(result.errors.join(" ")).toContain(
      "未通过校验的 Outbound「broken」",
    );
  });

  it("detects cycles among generated outbounds", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "a", proxyTag: "b" }),
      draft("socks", { tag: "b", proxyTag: "c" }),
      draft("socks", { tag: "c", proxyTag: "a" }),
    ]);

    expect(result.outboundCount).toBe(3);
    expect(result.errors.join(" ")).toContain("链式代理循环");
    expect(result.errors.join(" ")).toContain("a → b → c → a");
  });
});

describe("extraSettings", () => {
  it("deep merges JSON objects into generated settings", () => {
    const result = generateOutbounds([
      draft("socks", {
        tag: "custom",
        extraSettings: JSON.stringify({
          servers: [{ address: "extra.example.com", port: 9000 }],
          mux: {
            enabled: true,
          },
        }),
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.outbounds[0].settings).toEqual({
      servers: [{ address: "extra.example.com", port: 9000 }],
      mux: {
        enabled: true,
      },
    });
  });

  it("allows extra settings to override nested generated fields", () => {
    const result = generateOutbounds([
      wireGuardDraft({
        extraSettings: JSON.stringify({
          address: ["10.0.0.2/32"],
          peers: [
            {
              endpoint: "override.example.com:51820",
              publicKey: "override-key",
              keepAlive: 25,
              allowedIPs: ["10.0.0.0/8"],
            },
          ],
          reserved: [0, 0, 0],
        }),
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.outbounds[0].settings).toMatchObject({
      address: ["10.0.0.2/32"],
      peers: [
        {
          endpoint: "override.example.com:51820",
          publicKey: "override-key",
          keepAlive: 25,
          allowedIPs: ["10.0.0.0/8"],
        },
      ],
      reserved: [0, 0, 0],
    });
  });

  it("reports malformed JSON and non-object JSON", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "broken", extraSettings: "{bad" }),
      draft("socks", { tag: "array", extraSettings: "[]" }),
      draft("socks", { tag: "null", extraSettings: "null" }),
    ]);

    expect(result.outboundCount).toBe(0);
    expect(result.json).toBe("[]");
    expect(result.errors).toHaveLength(3);
    expect(result.errors.join(" ")).toContain("不是有效 JSON");
    expect(result.errors.filter((error) => error.includes("JSON 对象"))).toHaveLength(
      2,
    );
  });

  it("rejects reserved top-level settings keys", () => {
    const result = generateOutbounds([
      draft("socks", {
        extraSettings: JSON.stringify({ proxyTag: "other" }),
      }),
    ]);

    expect(result.outboundCount).toBe(0);
    expect(result.errors.join(" ")).toContain("settings.proxyTag 是保留字段");
  });
});

describe("result metadata", () => {
  it("returns an empty JSON array and zeroed metadata for no drafts", () => {
    const result = generateOutbounds([]);

    expect(result.outbounds).toEqual([]);
    expect(result.json).toBe("[]");
    expect(result.outboundCount).toBe(0);
    expect(result.protocolCount).toBe(0);
    expect(result.byteSize).toBe(2);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it("serializes pretty JSON and reports UTF-8 byte size", () => {
    const result = generateOutbounds([
      draft("socks", { tag: "代理" }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.json).toContain('\n  {\n    "tag": "代理"');
    expect(JSON.parse(result.json)).toEqual(result.outbounds);
    expect(result.byteSize).toBe(
      new TextEncoder().encode(result.json).length,
    );
  });
});
