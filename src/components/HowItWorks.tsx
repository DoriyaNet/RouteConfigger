import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  ListChecks,
  Route,
} from "lucide-react";

const steps = [
  {
    number: "01",
    icon: ListChecks,
    title: "编排 Routes 与 Outbounds",
    description:
      "Routes 里勾选解锁平台，Outbounds 里添加 SOCKS5、Shadowsocks 或 WARP。两者使用同一套 tag 协作。",
    detail: "55 个平台 · 7 种出口协议",
  },
  {
    number: "02",
    icon: Copy,
    title: "分别复制 JSON",
    description:
      "Routes 自动合并去重；Outbounds 校验 tag、链路与协议参数。两份配置都是可直接使用的裸数组。",
    detail: "自动校验 · 本地保存 · 可下载",
  },
  {
    number: "03",
    icon: ClipboardPaste,
    title: "粘贴到高级协议配置",
    description:
      "在 Xboard 节点的高级协议配置中，分别打开「自定义 Routes」与「自定义 Outbounds」粘贴并保存。",
    detail: "节点 → 高级协议配置 → Routes / Outbounds",
  },
];

export function HowItWorks() {
  return (
    <section className="how-section" id="how-it-works">
      <div className="container">
        <div className="section-heading how-heading">
          <div className="section-heading-copy">
            <span className="section-eyebrow">02 / HOW IT WORKS</span>
            <h2>三步完成节点配置</h2>
            <p>
              生成结果可直接作为 Xboard Node 的 <code>custom_routes</code> 与{" "}
              <code>custom_outbounds</code> 使用，不需要额外的外层包装。
            </p>
          </div>
        </div>

        <div className="steps-grid">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="step-card" key={step.number}>
                <div className="step-topline">
                  <span className="step-icon">
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                  <span className="step-number">{step.number}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <span className="step-detail">{step.detail}</span>
              </article>
            );
          })}
        </div>

        <div className="config-path">
          <span className="config-path-label">
            <Route size={14} />
            配置路径
          </span>
          <div className="config-path-items">
            <span>Xboard 面板</span>
            <ArrowRight size={13} />
            <span>节点编辑</span>
            <ArrowRight size={13} />
            <span>高级协议配置</span>
            <ArrowRight size={13} />
            <span className="is-active">自定义 Routes / Outbounds</span>
          </div>
        </div>

        <div className="fit-note">
          <span className="fit-note-icon">
            <CheckCircle2 size={20} strokeWidth={1.8} />
          </span>
          <div className="fit-note-copy">
            <h3>为 Xboard Node 的 Routes 与 Outbounds 而生成</h3>
            <p>
              Routes 包含 <code>type</code>、<code>outboundTag</code> 与{" "}
              <code>domain</code>；Outbounds 包含 <code>tag</code>、
              <code>protocol</code> 与 <code>settings</code>。请确认两边标签一致。
            </p>
          </div>
          <a
            className="button button-secondary button-small"
            href="https://github.com/cedar2025/Xboard-Node"
            target="_blank"
            rel="noreferrer"
          >
            查看官方文档
            <ArrowUpRight size={13} />
          </a>
        </div>

        <div className="faq-grid">
          <article className="faq-card">
            <span className="faq-label">FORMAT</span>
            <h3>为什么输出裸数组？</h3>
            <p>
              Routes 与 Outbounds 面板字段都直接接收数组，不需要{" "}
              <code>custom_routes</code> 或 <code>custom_outbounds</code>{" "}
              外层对象包装。
            </p>
          </article>
          <article className="faq-card">
            <span className="faq-label">OUTBOUND</span>
            <h3>tag 与 outboundTag 如何对应？</h3>
            <p>
              Routes 的 <code>outboundTag</code> 必须指向 Outbounds 的{" "}
              <code>tag</code>。链式代理则通过 <code>proxy_tag</code> 继续指向下一出口。
            </p>
          </article>
          <article className="faq-card">
            <span className="faq-label">GEOSITE</span>
            <h3>需要开启 geosite 吗？</h3>
            <p>
              通常不需要。默认已输出显式域名，即使节点没有 geosite.dat
              也能正常匹配。只有确认节点包含数据时才建议开启。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
