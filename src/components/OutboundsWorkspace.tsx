import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  Info,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
  Waypoints,
} from "lucide-react";
import {
  createOutboundDraft,
  outboundProtocolMeta,
  type OutboundDraft,
  type OutboundGenerationResult,
  type OutboundProtocol,
} from "../lib/outbounds";
import { kernelMeta, type KernelKind } from "../lib/kernel";
import { formatBytes } from "../lib/routes";
import { JsonOutputPanel } from "./JsonOutputPanel";

const PROTOCOL_ORDER: OutboundProtocol[] = [
  "socks",
  "http",
  "shadowsocks",
  "trojan",
  "vmess",
  "vless",
  "wireguard",
];

const PROTOCOL_MARKS: Record<OutboundProtocol, string> = {
  socks: "S5",
  http: "H",
  shadowsocks: "SS",
  trojan: "T",
  vmess: "VM",
  vless: "VL",
  wireguard: "WG",
};

const PROTOCOL_COLORS: Record<OutboundProtocol, string> = {
  socks: "#60A5FA",
  http: "#34D399",
  shadowsocks: "#A78BFA",
  trojan: "#F472B6",
  vmess: "#FBBF24",
  vless: "#22D3EE",
  wireguard: "#F87171",
};

const SHADOWSOCKS_METHODS = [
  "aes-256-gcm",
  "aes-128-gcm",
  "chacha20-ietf-poly1305",
  "2022-blake3-aes-128-gcm",
  "2022-blake3-aes-256-gcm",
  "2022-blake3-chacha20-poly1305",
];

const WG_XRAY_DOMAIN_STRATEGIES = [
  "ForceIP",
  "ForceIPv4",
  "ForceIPv6",
  "AsIs",
];
const WG_SINGBOX_DOMAIN_STRATEGIES = [
  "prefer_ipv4",
  "prefer_ipv6",
  "ipv4_only",
  "ipv6_only",
];

interface OutboundsWorkspaceProps {
  drafts: OutboundDraft[];
  onChange: (drafts: OutboundDraft[]) => void;
  result: OutboundGenerationResult;
  kernel: KernelKind;
}

interface DraftErrors {
  errors: string[];
  warnings: string[];
}

function getDraftMessages(
  draft: OutboundDraft,
  index: number,
  result: OutboundGenerationResult,
): DraftErrors {
  const tag = draft.tag.trim();
  const label = tag ? `「${tag}」` : `第 ${index + 1} 个 Outbound`;
  return {
    errors: result.errors.filter((error) => error.startsWith(label)),
    warnings: result.warnings.filter((warning) => warning.startsWith(label)),
  };
}

function extraSettingsStatus(value: string): "empty" | "valid" | "invalid" {
  if (!value.trim()) return "empty";
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed &&
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? "valid"
      : "invalid";
  } catch {
    return "invalid";
  }
}

function ProtocolMark({
  protocol,
  size = "default",
}: {
  protocol: OutboundProtocol;
  size?: "default" | "small";
}) {
  return (
    <span
      className={`protocol-mark ${size === "small" ? "is-small" : ""}`}
      style={
        {
          "--protocol-color": PROTOCOL_COLORS[protocol],
        } as CSSProperties
      }
    >
      {PROTOCOL_MARKS[protocol]}
    </span>
  );
}

interface FormFieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

function FormField({ label, hint, className = "", children }: FormFieldProps) {
  return (
    <label className={`ob-field ${className}`.trim()}>
      <span className="ob-label">{label}</span>
      {children}
      {hint ? <small className="ob-hint">{hint}</small> : null}
    </label>
  );
}

interface OutboundCardProps {
  kernel: KernelKind;
  draft: OutboundDraft;
  index: number;
  drafts: OutboundDraft[];
  open: boolean;
  messages: DraftErrors;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<OutboundDraft>) => void;
  onProtocolChange: (protocol: OutboundProtocol) => void;
}

function OutboundCard({
  kernel,
  draft,
  index,
  drafts,
  open,
  messages,
  onToggle,
  onRemove,
  onUpdate,
  onProtocolChange,
}: OutboundCardProps) {
  const meta = outboundProtocolMeta[draft.protocol];
  const singbox = kernel === "singbox";
  const extraStatus = extraSettingsStatus(draft.extraSettings);
  const proxyTagOptions = useMemo(
    () => [
      ...new Set(
        drafts
          .filter((item) => item.id !== draft.id)
          .map((item) => item.tag.trim())
          .filter(Boolean),
      ),
      "direct",
      "block",
    ],
    [drafts, draft.id],
  );
  const chainListId = `xroute-outbound-chain-tags-${draft.id}`;
  const connectionLabel =
    draft.server.trim() && draft.port.trim()
      ? `${draft.server.trim()}:${draft.port.trim()}`
      : "待填写服务器";
  const hasMessages = messages.errors.length > 0;

  return (
    <article
      className={`outbound-card ${open ? "is-open" : ""} ${
        hasMessages ? "has-errors" : ""
      }`}
      id={`outbound-card-${draft.id}`}
    >
      <div className="outbound-card-head">
        <button
          type="button"
          className="outbound-card-toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <ProtocolMark protocol={draft.protocol} />
          <span className="outbound-card-title">
            <span className="outbound-card-title-row">
              <strong>{draft.tag.trim() || "未命名 Outbound"}</strong>
              <span className="outbound-protocol-pill">
                {meta.label}
              </span>
              {hasMessages ? (
                <span className="outbound-error-dot" title="配置有误" />
              ) : null}
            </span>
            <span className="outbound-card-meta">
              {connectionLabel}
              {draft.proxyTag.trim() ? (
                <>
                  <span className="meta-divider">/</span>
                  链路至 {draft.proxyTag.trim()}
                </>
              ) : null}
            </span>
          </span>
          <ChevronDown className="outbound-chevron" size={16} />
        </button>
        <button
          type="button"
          className="icon-button outbound-remove"
          onClick={onRemove}
          aria-label={`删除 ${draft.tag.trim() || `第 ${index + 1} 个 Outbound`}`}
          title="删除此 Outbound"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {open ? (
        <div className="outbound-card-body">
          {hasMessages ? (
            <div className="outbound-inline-errors">
              <AlertCircle size={13} />
              <span>{messages.errors[0]}</span>
              {messages.errors.length > 1 ? (
                <small>+{messages.errors.length - 1}</small>
              ) : null}
            </div>
          ) : null}

          <div className="ob-section-label">
            <span>基础信息</span>
            <small>{meta.description}</small>
          </div>
          <div className="ob-form-grid">
            <FormField label="tag" hint="在 Routes 中通过该标签引用">
              <input
                className="ob-input"
                type="text"
                value={draft.tag}
                onChange={(event) => onUpdate({ tag: event.target.value })}
                placeholder="proxy"
                spellCheck={false}
                autoComplete="off"
                maxLength={64}
              />
            </FormField>
            <FormField label="protocol">
              <select
                className="ob-input ob-select"
                value={draft.protocol}
                onChange={(event) =>
                  onProtocolChange(event.target.value as OutboundProtocol)
                }
              >
                {PROTOCOL_ORDER.map((protocol) => (
                  <option value={protocol} key={protocol}>
                    {outboundProtocolMeta[protocol].label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="server">
              <input
                className="ob-input"
                type="text"
                value={draft.server}
                onChange={(event) => onUpdate({ server: event.target.value })}
                placeholder="1.2.3.4 或 example.com"
                spellCheck={false}
                autoComplete="off"
              />
            </FormField>
            <FormField label="port">
              <input
                className="ob-input"
                type="number"
                min="1"
                max="65535"
                value={draft.port}
                onChange={(event) => onUpdate({ port: event.target.value })}
                placeholder="1080"
                inputMode="numeric"
              />
            </FormField>
          </div>

          <div className="ob-section-label ob-section-spaced">
            <span>协议参数</span>
            <small>
              按 {kernelMeta[kernel].outboundFormat} 生成
            </small>
          </div>

          {draft.protocol === "socks" || draft.protocol === "http" ? (
            <div className="ob-form-grid">
              <FormField label="username" hint="可选">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.username}
                  onChange={(event) =>
                    onUpdate({ username: event.target.value })
                  }
                  placeholder="留空则不启用认证"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField label="password" hint="可选">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.password}
                  onChange={(event) =>
                    onUpdate({ password: event.target.value })
                  }
                  placeholder="留空则不启用认证"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
            </div>
          ) : null}

          {draft.protocol === "shadowsocks" ? (
            <div className="ob-form-grid">
              <FormField label="method">
                <input
                  className="ob-input"
                  type="text"
                  list="xroute-ss-methods"
                  value={draft.method}
                  onChange={(event) => onUpdate({ method: event.target.value })}
                  placeholder="aes-256-gcm"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField label="password">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.password}
                  onChange={(event) =>
                    onUpdate({ password: event.target.value })
                  }
                  placeholder="Shadowsocks 密码"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
            </div>
          ) : null}

          {draft.protocol === "trojan" ? (
            <div className="ob-form-grid">
              <FormField
                label="password"
                className="ob-span-2"
                hint={
                  singbox
                    ? "可在额外 Settings 中加入 tls / transport"
                    : "面板 settings 不包含 Xray TLS / transport"
                }
              >
                <input
                  className="ob-input"
                  type="text"
                  value={draft.password}
                  onChange={(event) =>
                    onUpdate({ password: event.target.value })
                  }
                  placeholder="Trojan 密码"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
            </div>
          ) : null}

          {draft.protocol === "vmess" ? (
            <div className="ob-form-grid">
              <FormField label="uuid" className="ob-span-2">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.uuid}
                  onChange={(event) => onUpdate({ uuid: event.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField label="alterId">
                <input
                  className="ob-input"
                  type="number"
                  min="0"
                  max="65535"
                  value={draft.alterId}
                  onChange={(event) =>
                    onUpdate({ alterId: event.target.value })
                  }
                  placeholder="0"
                  inputMode="numeric"
                />
              </FormField>
              <FormField label="security">
                <select
                  className="ob-input ob-select"
                  value={draft.security}
                  onChange={(event) =>
                    onUpdate({ security: event.target.value })
                  }
                >
                  <option value="auto">auto</option>
                  <option value="aes-128-gcm">aes-128-gcm</option>
                  <option value="chacha20-poly1305">chacha20-poly1305</option>
                  <option value="none">none</option>
                  <option value="zero">zero</option>
                </select>
              </FormField>
            </div>
          ) : null}

          {draft.protocol === "vless" ? (
            <div className="ob-form-grid">
              <FormField label="uuid" className="ob-span-2">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.uuid}
                  onChange={(event) => onUpdate({ uuid: event.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField label="flow" hint="可选；不使用请留空">
                <input
                  className="ob-input"
                  type="text"
                  list="xroute-vless-flows"
                  value={draft.flow}
                  onChange={(event) => onUpdate({ flow: event.target.value })}
                  placeholder="xtls-rprx-vision"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
            </div>
          ) : null}

          {draft.protocol === "wireguard" ? (
            <div className="ob-form-grid">
              <FormField
                label="privateKey"
                className="ob-span-2"
                hint="WARP 私钥需在客户端生成后填入"
              >
                <input
                  className="ob-input"
                  type="text"
                  value={draft.privateKey}
                  onChange={(event) =>
                    onUpdate({ privateKey: event.target.value })
                  }
                  placeholder="Base64 / hex private key"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField label="peerPublicKey" className="ob-span-2">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.peerPublicKey}
                  onChange={(event) =>
                    onUpdate({ peerPublicKey: event.target.value })
                  }
                  placeholder="Peer public key"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField
                label="localAddress"
                className="ob-span-2"
                hint="多个地址用逗号分隔"
              >
                <input
                  className="ob-input"
                  type="text"
                  value={draft.localAddress}
                  onChange={(event) =>
                    onUpdate({ localAddress: event.target.value })
                  }
                  placeholder="172.16.0.2/32"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField label="preSharedKey" hint="可选">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.preSharedKey}
                  onChange={(event) =>
                    onUpdate({ preSharedKey: event.target.value })
                  }
                  placeholder="留空则不使用"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField label="mtu">
                <input
                  className="ob-input"
                  type="number"
                  min="576"
                  value={draft.mtu}
                  onChange={(event) => onUpdate({ mtu: event.target.value })}
                  placeholder="1420"
                  inputMode="numeric"
                />
              </FormField>
              <FormField label="reserved" hint="最多 3 个字节，逗号分隔">
                <input
                  className="ob-input"
                  type="text"
                  value={draft.reserved}
                  onChange={(event) =>
                    onUpdate({ reserved: event.target.value })
                  }
                  placeholder="0, 0, 0"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
              <FormField
                label="domainStrategy"
                hint={
                  singbox
                    ? "ForceIPv4/ForceIPv6 会自动映射"
                    : undefined
                }
              >
                <input
                  className="ob-input"
                  type="text"
                  list="xroute-wg-domain-strategies"
                  value={draft.domainStrategy}
                  onChange={(event) =>
                    onUpdate({ domainStrategy: event.target.value })
                  }
                  placeholder="ForceIP"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>
            </div>
          ) : null}

          <div className="outbound-chain-block">
            <div className="ob-section-label">
              <span>
                <Link2 size={13} />
                链式代理
              </span>
              <small>可选</small>
            </div>
            <div className="outbound-chain-input-row">
              <span className="chain-prefix">
                {singbox ? "detour" : "proxy_tag"}
              </span>
              <input
                className="ob-input"
                type="text"
                list={chainListId}
                value={draft.proxyTag}
                onChange={(event) =>
                  onUpdate({ proxyTag: event.target.value })
                }
                aria-label={`${
                  draft.tag.trim() || `第 ${index + 1} 个 Outbound`
                } 的 ${singbox ? "detour" : "proxy_tag"}`}
                placeholder="例如：warp、direct；留空则直接出站"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <datalist id={chainListId}>
              {proxyTagOptions.map((tag) => (
                <option value={tag} key={tag} />
              ))}
            </datalist>
            <p className="outbound-chain-hint">
              当前出口的流量会继续交给{" "}
              <code>{singbox ? "detour" : "proxy_tag"}</code>{" "}
              指向的出口。
            </p>
          </div>

          <details
            className={`extra-settings ${
              extraStatus === "invalid" ? "has-invalid-json" : ""
            }`}
          >
            <summary>
              <span>
                <Braces size={14} />
                额外 Settings JSON
              </span>
              <span className="extra-settings-status">
                {extraStatus === "valid" ? (
                  <>
                    <Check size={11} />
                    JSON 有效
                  </>
                ) : extraStatus === "invalid" ? (
                  "JSON 格式错误"
                ) : (
                  "可选"
                )}
              </span>
              <ChevronDown size={14} />
            </summary>
            <div className="extra-settings-body">
              <textarea
                value={draft.extraSettings}
                onChange={(event) =>
                  onUpdate({ extraSettings: event.target.value })
                }
                spellCheck={false}
                aria-label={`${draft.tag || `第 ${index + 1} 个 Outbound`}的额外 Settings JSON`}
                placeholder={`{\n  "customField": "value"\n}`}
              />
              <p>
                必须是 JSON 对象，会深合并到自动生成的 <code>settings</code>{" "}
                中并覆盖同名字段。
                {singbox
                  ? " sing-box 可直接加入 tls、transport、detour 等平铺字段。"
                  : ""}
              </p>
            </div>
          </details>

          {messages.warnings.length > 0 ? (
            <div className="outbound-inline-warning">
              <Info size={13} />
              <span>{messages.warnings[0]}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function OutboundOutputPanel({
  result,
  draftsCount,
  onAddSocks,
  kernel,
}: {
  result: OutboundGenerationResult;
  draftsCount: number;
  onAddSocks: () => void;
  kernel: KernelKind;
}) {
  const hasErrors = result.errors.length > 0;
  const isEmpty = draftsCount === 0;
  const canExport = !hasErrors && result.outboundCount > 0;
  const status = hasErrors ? "error" : isEmpty ? "idle" : "valid";
  const statusLabel = hasErrors ? "配置有误" : isEmpty ? "等待添加" : "JSON 有效";

  return (
    <JsonOutputPanel
      panelLabel="生成的 Outbounds 配置"
      kicker="GENERATED OUTBOUNDS"
      title="自定义 Outbounds"
      targetLabel={`Xboard / ${kernelMeta[kernel].label}`}
      status={status}
      statusLabel={statusLabel}
      stats={[
        { value: result.outboundCount, label: "个出口" },
        { value: result.protocolCount, label: "种协议" },
        { value: formatBytes(result.byteSize), label: "文件大小" },
      ]}
      errors={result.errors}
      warnings={result.warnings}
      json={result.json}
      isEmpty={isEmpty}
      canExport={canExport}
      emptyState={{
        title: "还没有自定义出口",
        description: "选择一种协议模板，开始配置第一个代理出口。",
        actionLabel: "添加 SOCKS5",
        onAction: onAddSocks,
      }}
      downloadName={`xboard-custom-outbounds-${kernel}.json`}
      note={
        <>
          <Info size={14} />
          <p>
            粘贴到{" "}
            <strong>Xboard → 节点 → 高级协议配置 → 自定义 Outbounds</strong>
            。输出为裸数组；
            {kernel === "xray" ? (
              <>
                <code>proxy_tag</code> 必须指向已存在的出口，生成的 tag
                可直接用于 Routes 的 <code>outboundTag</code>。
              </>
            ) : (
              <>
                sing-box 链路使用 <code>settings.detour</code>，生成的 tag
                可直接用于 Routes 的 <code>outbound</code>。
              </>
            )}
          </p>
        </>
      }
    />
  );
}

export function OutboundsWorkspace({
  drafts,
  onChange,
  result,
  kernel,
}: OutboundsWorkspaceProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(drafts.slice(0, 1).map((draft) => draft.id)),
  );

  function existingTags() {
    return drafts.map((draft) => draft.tag.trim()).filter(Boolean);
  }

  function addOutbound(protocol: OutboundProtocol) {
    const draft = createOutboundDraft(protocol, existingTags());
    onChange([...drafts, draft]);
    setExpandedIds(new Set([draft.id]));
    window.setTimeout(() => {
      document
        .getElementById(`outbound-card-${draft.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  }

  function updateOutbound(id: string, patch: Partial<OutboundDraft>) {
    onChange(
      drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  }

  function changeProtocol(id: string, protocol: OutboundProtocol) {
    const current = drafts.find((draft) => draft.id === id);
    if (!current) return;
    const base = createOutboundDraft(
      protocol,
      drafts.filter((draft) => draft.id !== id).map((draft) => draft.tag),
    );
    updateOutbound(id, {
      ...base,
      id: current.id,
      tag: current.tag,
      proxyTag: current.proxyTag,
      extraSettings: current.extraSettings,
    });
  }

  function removeOutbound(id: string) {
    onChange(drafts.filter((draft) => draft.id !== id));
    setExpandedIds((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  function toggleCard(id: string) {
    setExpandedIds((previous) =>
      previous.has(id) ? new Set() : new Set([id]),
    );
  }

  return (
    <>
      <datalist id="xroute-ss-methods">
        {SHADOWSOCKS_METHODS.map((method) => (
          <option value={method} key={method} />
        ))}
      </datalist>
      <datalist id="xroute-vless-flows">
        <option value="xtls-rprx-vision" />
      </datalist>
      <datalist id="xroute-wg-domain-strategies">
        {(kernel === "singbox"
          ? WG_SINGBOX_DOMAIN_STRATEGIES
          : WG_XRAY_DOMAIN_STRATEGIES
        ).map((strategy) => (
          <option value={strategy} key={strategy} />
        ))}
      </datalist>

      <div className="section-heading">
        <div className="section-heading-copy">
          <span className="section-eyebrow">01 / OUTBOUND BUILDER</span>
          <h2>编排自定义出口</h2>
          <p>
            配置 SOCKS5、Shadowsocks、VMess、WireGuard WARP
            等外部出口，按所选内核生成可直接粘贴到 Xboard 的 Outbounds
            数组。
          </p>
        </div>
        <div className="selection-summary">
          <span className="selection-summary-value">
            {String(drafts.length).padStart(2, "0")}
          </span>
          <span className="selection-summary-label">
            已添加
            <small>/ {PROTOCOL_ORDER.length} 种协议模板</small>
          </span>
        </div>
      </div>

      <div className="preset-row outbound-template-row">
        <span className="preset-label">协议模板</span>
        <div className="preset-list">
          {PROTOCOL_ORDER.map((protocol) => {
            const meta = outboundProtocolMeta[protocol];
            return (
              <button
                key={protocol}
                type="button"
                className="preset-button outbound-template-button"
                onClick={() => addOutbound(protocol)}
                title={meta.description}
                aria-label={`添加 ${meta.label} Outbound`}
              >
                <ProtocolMark protocol={protocol} size="small" />
                <span>{meta.label}</span>
                <Plus size={12} strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="generator-grid outbound-generator-grid">
        <div className="generator-column">
          <div className="outbound-schema-note">
            <span className="outbound-schema-icon">
              <Waypoints size={18} strokeWidth={1.7} />
            </span>
            <div className="outbound-schema-copy">
              <div>
                <span className="card-eyebrow">XBOARD SCHEMA</span>
                <strong>
                  结构化 Outbounds · {kernelMeta[kernel].outboundFormat}
                </strong>
              </div>
              <p>
                <code>tag</code> + <code>protocol</code> +{" "}
                <code>settings</code> + 可选{" "}
                <code>{kernel === "xray" ? "proxy_tag" : "detour"}</code>。
                {kernel === "xray"
                  ? " 面板不暴露 Xray 的 TLS / transport，需要时请使用节点原生配置。"
                  : " TLS、transport 等字段可直接写入 settings。"}
              </p>
            </div>
            <a
              className="schema-doc-link"
              href="https://github.com/cedar2025/Xboard-Node/blob/dev/docs-custom-outbounds.md"
              target="_blank"
              rel="noreferrer"
            >
              文档
              <ArrowUpRight size={12} />
            </a>
          </div>

          <div className="library-heading-row outbound-list-heading">
            <div>
              <span className="card-eyebrow">OUTBOUND LIST</span>
              <h3>出口列表</h3>
            </div>
            <span className="library-result-count">
              {drafts.length > 0 ? `${drafts.length} 个 Outbound` : "等待添加"}
            </span>
          </div>

          {drafts.length > 0 ? (
            <div className="outbound-list">
              {drafts.map((draft, index) => (
                <OutboundCard
                  key={draft.id}
                  kernel={kernel}
                  draft={draft}
                  index={index}
                  drafts={drafts}
                  open={expandedIds.has(draft.id)}
                  messages={getDraftMessages(draft, index, result)}
                  onToggle={() => toggleCard(draft.id)}
                  onRemove={() => removeOutbound(draft.id)}
                  onUpdate={(patch) => updateOutbound(draft.id, patch)}
                  onProtocolChange={(protocol) =>
                    changeProtocol(draft.id, protocol)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="outbound-empty-list">
              <span className="outbound-empty-icon">
                <Waypoints size={22} strokeWidth={1.5} />
              </span>
              <div>
                <h3>还没有自定义出口</h3>
                <p>从上方选择协议模板，或使用右侧的 SOCKS5 快捷入口。</p>
              </div>
            </div>
          )}

          <div className="outbound-safety-note">
            <ShieldCheck size={14} />
            <p>
              Tag 不区分大小写且必须唯一。链式出口会在写入前检查引用与循环，
              但静态 outbound 的 tag 仍需在节点上确认存在。
            </p>
          </div>
        </div>

        <div className="output-column">
          <OutboundOutputPanel
            result={result}
            draftsCount={drafts.length}
            onAddSocks={() => addOutbound("socks")}
            kernel={kernel}
          />
        </div>
      </div>
    </>
  );
}
