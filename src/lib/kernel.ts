export const KERNEL_KINDS = ["xray", "singbox"] as const;

export type KernelKind = (typeof KERNEL_KINDS)[number];

export const DEFAULT_KERNEL: KernelKind = "xray";

export const kernelMeta: Record<
  KernelKind,
  {
    label: string;
    badge: string;
    description: string;
    routeFormat: string;
    outboundFormat: string;
  }
> = {
  xray: {
    label: "Xray",
    badge: "XRAY",
    description: "field / outboundTag，支持 geosite 与 geoip",
    routeFormat: "field / outboundTag",
    outboundFormat: "Xray settings",
  },
  singbox: {
    label: "sing-box",
    badge: "SING-BOX",
    description: "action / outbound；geosite 需 rule_set",
    routeFormat: "action / outbound",
    outboundFormat: "平铺 settings",
  },
};

export function normalizeKernel(value: unknown): KernelKind {
  return value === "singbox" ? "singbox" : DEFAULT_KERNEL;
}
