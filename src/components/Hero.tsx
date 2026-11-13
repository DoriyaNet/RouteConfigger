import {
  ArrowRight,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { JsonCode } from "./JsonCode";

const previewJson = `[
  {
    "type": "field",
    "outboundTag": "proxy",
    "domain": [
      "domain:netflix.com",
      "domain:disneyplus.com",
      "domain:openai.com",
      "domain:bilibili.com",
      "…"
    ]
  }
]`;

function HeroPreview() {
  return (
    <div className="hero-preview-wrap" aria-label="Xboard 自定义 Routes 配置预览">
      <div className="hero-preview-glow" />
      <div className="hero-orbit hero-orbit-one" />
      <div className="hero-orbit hero-orbit-two" />

      <div className="config-window">
        <div className="config-window-bar">
          <div className="window-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="window-url">xboard / node / advanced</span>
          <span className="window-secure">
            <ShieldCheck size={12} />
            secure
          </span>
        </div>

        <div className="config-modal">
          <div className="config-modal-head">
            <div>
              <span className="modal-eyebrow">NODE CONFIGURATION</span>
              <h3>高级协议配置</h3>
            </div>
            <X className="modal-close" size={17} />
          </div>

          <div className="config-tabs" aria-hidden="true">
            <span>TLS</span>
            <span>多路复用</span>
            <span>自定义 Outbounds</span>
            <span className="is-active">自定义 Routes</span>
          </div>

          <div className="config-field-label">
            <span>自定义 Routes (JSON)</span>
            <span className="config-format">Xboard Node</span>
          </div>

          <div className="hero-code-shell">
            <JsonCode code={previewJson} />
            <span className="paste-float">
              <Check size={12} strokeWidth={2.4} />
              可直接粘贴
            </span>
          </div>

          <div className="config-modal-footer" aria-hidden="true">
            <span className="modal-valid">
              <span className="runtime-dot" />
              JSON 校验通过
            </span>
            <div className="modal-buttons">
              <span>取消</span>
              <span className="modal-save">保存</span>
            </div>
          </div>
        </div>
      </div>

      <div className="float-card float-card-top">
        <span className="float-icon">
          <Waypoints size={14} />
        </span>
        <div>
          <strong>7 protocols</strong>
          <span>出口协议模板</span>
        </div>
      </div>

      <div className="float-card float-card-bottom">
        <span className="float-check">
          <Check size={13} strokeWidth={2.5} />
        </span>
        <div>
          <strong>Local only</strong>
          <span>配置不离开浏览器</span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-grid-bg" aria-hidden="true" />
      <div className="hero-spotlight" aria-hidden="true" />

      <div className="hero-inner">
        <div className="hero-copy">
          <a className="hero-kicker" href="#generator">
            <span className="kicker-new">NEW</span>
            <span>Xboard · Routes + Outbounds</span>
            <ArrowRight size={13} />
          </a>

          <h1>
            路由与出口，
            <br />
            <span className="hero-gradient">一次生成。</span>
          </h1>

          <p className="hero-subtitle">
            勾选流媒体平台、编排代理出口，一次生成可直接粘贴到 Xboard
            高级协议配置的 Routes 与 Outbounds JSON，不用再手写长串域名和协议参数。
          </p>

          <div className="hero-actions">
            <a className="button button-primary button-large" href="#generator">
              开始生成配置
              <ArrowRight size={16} strokeWidth={2} />
            </a>
            <a
              className="button button-ghost button-large"
              href="#how-it-works"
            >
              查看接入说明
              <ExternalLink size={14} strokeWidth={1.8} />
            </a>
          </div>

          <div className="hero-notes">
            <span>
              <ShieldCheck size={14} />
              数据仅留在本地
            </span>
            <span className="note-separator" />
            <span>
              <Sparkles size={14} />
              零依赖，复制即用
            </span>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <strong>55</strong>
              <span>平台预设</span>
            </div>
            <div className="hero-stat-separator" />
            <div className="hero-stat">
              <strong>7</strong>
              <span>地区分组</span>
            </div>
            <div className="hero-stat-separator" />
            <div className="hero-stat">
              <strong>Xray</strong>
              <span>原生 JSON</span>
            </div>
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}
