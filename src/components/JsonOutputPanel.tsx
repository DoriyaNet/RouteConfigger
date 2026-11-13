import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Plus,
  Route,
  TriangleAlert,
} from "lucide-react";
import { JsonCode } from "./JsonCode";

export type OutputStatus = "valid" | "error" | "idle";

export interface OutputStat {
  value: string | number;
  label: string;
}

export interface OutputEmptyState {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export interface JsonOutputPanelProps {
  kicker: string;
  title: string;
  formatLabel?: string;
  targetLabel: string;
  status: OutputStatus;
  statusLabel: string;
  stats: OutputStat[];
  errors: string[];
  warnings: string[];
  json: string;
  isEmpty: boolean;
  canExport: boolean;
  emptyState?: OutputEmptyState;
  note: ReactNode;
  downloadName: string;
  panelLabel: string;
}

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const successful = document.execCommand("copy");
  textarea.remove();
  if (!successful) throw new Error("Copy failed");
}

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function JsonOutputPanel({
  kicker,
  title,
  formatLabel = "JSON",
  targetLabel,
  status,
  statusLabel,
  stats,
  errors,
  warnings,
  json,
  isEmpty,
  canExport,
  emptyState,
  note,
  downloadName,
  panelLabel,
}: JsonOutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const hasErrors = errors.length > 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await copyText(json);
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <aside className="output-panel" aria-label={panelLabel}>
      <div className="output-panel-head">
        <div>
          <div className="panel-kicker">
            <span className="panel-kicker-dot" />
            {kicker}
          </div>
          <h2>{title}</h2>
        </div>
        <span className="json-pill">{formatLabel}</span>
      </div>

      <div className="output-status-row">
        <span className={`output-status is-${status}`}>
          {hasErrors ? (
            <AlertCircle size={13} />
          ) : isEmpty ? (
            <span className="status-ring" />
          ) : (
            <CheckCircle2 size={13} />
          )}
          {statusLabel}
        </span>
        <span className="output-target">
          <Route size={13} />
          {targetLabel}
        </span>
      </div>

      <div className="output-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      {errors.length > 0 ? (
        <div className="output-message output-message-error">
          <AlertCircle size={15} />
          <div>
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="output-message output-message-warning">
          <TriangleAlert size={15} />
          <div>
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      ) : null}

      {isEmpty && !hasErrors && emptyState ? (
        <div className="output-empty">
          <span className="output-empty-icon">
            <Route size={24} strokeWidth={1.5} />
          </span>
          <h3>{emptyState.title}</h3>
          <p>{emptyState.description}</p>
          <button
            className="button button-secondary button-small"
            type="button"
            onClick={emptyState.onAction}
          >
            <Plus size={14} />
            {emptyState.actionLabel}
          </button>
        </div>
      ) : (
        <div className="output-code-shell">
          <JsonCode code={json} showLineNumbers />
        </div>
      )}

      <div className="output-actions">
        <button
          className="button button-primary output-copy"
          type="button"
          onClick={handleCopy}
          disabled={!canExport}
        >
          {copied ? (
            <Check size={16} strokeWidth={2.2} />
          ) : (
            <Copy size={15} strokeWidth={1.9} />
          )}
          {copied ? "已复制" : "复制 JSON"}
        </button>
        <button
          className="icon-button download-button"
          type="button"
          aria-label="下载 JSON 文件"
          title="下载 JSON 文件"
          onClick={() => downloadJson(json, downloadName)}
          disabled={!canExport}
        >
          <Download size={17} />
        </button>
      </div>

      <div className="output-note">{note}</div>

      <span className="sr-only" aria-live="polite">
        {copied ? "JSON 已复制到剪贴板" : ""}
      </span>
    </aside>
  );
}
