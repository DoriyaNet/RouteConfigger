import { describe, expect, it } from "vitest";
import { normalizeStoredDrafts } from "./useOutboundsBuilder";

describe("normalizeStoredDrafts", () => {
  it("migrates partial legacy drafts with protocol defaults", () => {
    const drafts = normalizeStoredDrafts([
      {
        id: "legacy-1",
        tag: "proxy",
        protocol: "socks",
      },
    ]);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id: "legacy-1",
      tag: "proxy",
      protocol: "socks",
      server: "127.0.0.1",
      port: "1080",
      username: "",
      password: "",
      extraSettings: "",
    });
  });

  it("drops invalid entries and replaces malformed fields with defaults", () => {
    const drafts = normalizeStoredDrafts([
      null,
      { id: "bad", tag: "bad", protocol: "unsupported" },
      {
        id: "good",
        tag: 123,
        protocol: "http",
        port: 8080,
        extraSettings: { unsafe: true },
      },
    ]);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id: "good",
      tag: "http-out",
      protocol: "http",
      port: "8080",
      extraSettings: "",
    });
  });

  it("makes duplicate persisted ids unique", () => {
    const drafts = normalizeStoredDrafts([
      { id: "same", tag: "one", protocol: "socks" },
      { id: "same", tag: "two", protocol: "http" },
    ]);

    expect(drafts).toHaveLength(2);
    expect(new Set(drafts.map((draft) => draft.id)).size).toBe(2);
  });

  it("returns an empty list for non-array payloads", () => {
    expect(normalizeStoredDrafts(null)).toEqual([]);
    expect(normalizeStoredDrafts({})).toEqual([]);
  });
});
