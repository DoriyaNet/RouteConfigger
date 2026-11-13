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
      "Routes 里选择全局代理、绕过大陆，或勾选解锁平台；Outbounds 里添加 SOCKS5、Shadowsocks 或 WARP。两者使用同一套 tag 协作。",
    detail: "4 种接管模式 · 7 种出口协议",
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
      "先选择与节点一致的 Xray 或 sing-box 内核，再分别打开「自定义 Routes」与「自定义 Outbounds」粘贴保存。",
    detail: "先选内核 · 再粘贴 Routes / Outbounds",
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
              <code>custom_outbounds</code> 使用。输出会跟随所选内核切换为
              Xray 或 sing-box 原生字段。
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
            <h3>为 Xboard Node 双内核而生成</h3>
            <p>
              Xray 输出 <code>outboundTag</code> 与嵌套 settings；sing-box
              输出 <code>action</code>、<code>outbound</code> 与平铺 settings。
              请确认节点实际内核、两边的 tag 保持一致。
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
            <h3>tag 与路由出口如何对应？</h3>
            <p>
              Xray 使用 <code>outboundTag</code> 与 <code>proxy_tag</code>；
              sing-box 使用 <code>outbound</code> 与{" "}
              <code>detour</code>。两者都必须指向 Outbounds 的最终{" "}
              <code>tag</code>。
            </p>
          </article>
          <article className="faq-card">
            <span className="faq-label">KERNEL</span>
            <h3>内核应该怎么选？</h3>
            <p>
              与 <code>/etc/xboard-node/config.yml</code> 中的{" "}
              <code>kernel.type</code> 保持一致。绕过大陆和广告拦截依赖{" "}
              <code>geosite</code> / <code>geoip</code>，目前仅提供 Xray 输出。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
