import { useEffect, useMemo, useState } from "react";
import {
  createOutboundDraft,
  generateOutbounds,
  outboundProtocolMeta,
  type OutboundDraft,
  type OutboundProtocol,
} from "../lib/outbounds";
import {
  DEFAULT_KERNEL,
  type KernelKind,
} from "../lib/kernel";

const STORAGE_KEY = ["xroute", "outbounds", "state", "v1"].join("-");
const protocols = new Set(Object.keys(outboundProtocolMeta));

export function normalizeStoredDrafts(value: unknown): OutboundDraft[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const normalized: OutboundDraft[] = [];

  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (
      typeof record.protocol !== "string" ||
      !protocols.has(record.protocol as OutboundProtocol)
    ) {
      continue;
    }

    const protocol = record.protocol as OutboundProtocol;
    const draft = createOutboundDraft(protocol);
    const mutableDraft = draft as unknown as Record<string, unknown>;
    for (const key of Object.keys(draft) as Array<keyof OutboundDraft>) {
      const stored = record[key];
      if (typeof stored === "string") {
        mutableDraft[key] = stored;
      }
    }
    draft.protocol = protocol;

    if (typeof record.id !== "string" || !record.id.trim()) {
      draft.id = `outbound-loaded-${index}-${Date.now()}`;
    }
    if (seenIds.has(draft.id)) {
      draft.id = `outbound-loaded-${index}-${Date.now()}`;
    }
    seenIds.add(draft.id);
    normalized.push(draft);
  }

  return normalized;
}

function loadDrafts(): OutboundDraft[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as { drafts?: unknown };
    return normalizeStoredDrafts(parsed.drafts);
  } catch {
    return [];
  }
}

export function useOutboundsBuilder(kernel: KernelKind = DEFAULT_KERNEL) {
  const [drafts, setDrafts] = useState<OutboundDraft[]>(loadDrafts);
  const result = useMemo(
    () => generateOutbounds(drafts, kernel),
    [drafts, kernel],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ drafts }));
    } catch {
      // Local persistence is optional.
    }
  }, [drafts]);

  return { drafts, setDrafts, result };
}
