import { Info } from "lucide-react";
import { kernelMeta, type KernelKind } from "../lib/kernel";
import type { GenerationResult } from "../lib/routes";
import { formatBytes } from "../lib/routes";
import { JsonOutputPanel } from "./JsonOutputPanel";

interface OutputPanelProps {
  result: GenerationResult;
  kernel: KernelKind;
  onLoadPopular: () => void;
}

const MODE_LABELS: Record<GenerationResult["mode"], string> = {
  media: "流媒体分流",
  global: "全局代理",
  bypass: "绕过大陆",
  direct: "全局直连",
};

export function OutputPanel({
  result,
  kernel,
  onLoadPopular,
}: OutputPanelProps) {
  const hasErrors = result.errors.length > 0;
  const isEmpty = result.ruleCount === 0;
  const canExport = !hasErrors && !isEmpty;
  const status = hasErrors ? "error" : isEmpty ? "idle" : "valid";
  const statusLabel = hasErrors ? "配置有误" : isEmpty ? "等待选择" : "JSON 有效";

  return (
    <JsonOutputPanel
      panelLabel="生成的 Routes 配置"
      kicker="GENERATED OUTPUT"
      title="自定义 Routes"
      targetLabel={`Xboard Node / ${kernelMeta[kernel].label}`}
      status={status}
      statusLabel={statusLabel}
      stats={[
        { value: result.ruleCount, label: "条规则" },
        { value: result.domainCount, label: "个域名" },
        { value: formatBytes(result.byteSize), label: "文件大小" },
      ]}
      errors={result.errors}
      warnings={result.warnings}
      json={result.json}
      isEmpty={isEmpty}
      canExport={canExport}
      emptyState={{
        title: "还没有路由规则",
        description: "从左侧选择需要的平台，或载入一组热门预设。",
        actionLabel: "载入热门预设",
        onAction: onLoadPopular,
      }}
      downloadName={`xboard-custom-routes-${kernel}.json`}
      note={
        <>
          <Info size={14} />
          <p>
            {kernel === "xray" ? (
              <>
                粘贴到{" "}
                <strong>Xboard → 节点 → 高级协议配置 → 自定义 Routes</strong>
                ，并确保 <code>outboundTag</code> 与自定义 Outbounds 的 tag
                一致。
              </>
            ) : (
              <>
                粘贴到{" "}
                <strong>Xboard → 节点 → 高级协议配置 → 自定义 Routes</strong>
                。输出为 sing-box <code>route.rules</code>，使用{" "}
                <code>action</code> / <code>outbound</code> /{" "}
                <code>domain_suffix</code> / <code>ip_cidr</code>；{" "}
                <code>outbound</code> 必须与自定义 Outbounds 的 tag 一致。
              </>
            )}
            {result.mode !== "media"
              ? ` 当前「${MODE_LABELS[result.mode]}」模式已添加接管剩余 TCP/UDP 流量的兜底规则。`
              : ""}
          </p>
        </>
      }
    />
  );
}
