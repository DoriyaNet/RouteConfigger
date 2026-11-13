import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { BrandMark } from "./Header";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand-block">
          <a className="brand footer-brand" href="#top" aria-label="XRoute 首页">
            <BrandMark />
            <span className="brand-word">XRoute</span>
          </a>
          <p>为 Xboard Node 生成清晰、可维护的路由与代理出口配置。</p>
          <span className="footer-local">
            <ShieldCheck size={13} />
            所有配置在浏览器本地生成
          </span>
        </div>

        <div className="footer-links">
          <div className="footer-link-group">
            <span>产品</span>
            <a href="#generator">路由生成器</a>
            <a href="#how-it-works">使用说明</a>
          </div>
          <div className="footer-link-group">
            <span>资源</span>
            <a
              href="https://github.com/cedar2025/Xboard-Node"
              target="_blank"
              rel="noreferrer"
            >
              Xboard Node
              <ArrowUpRight size={12} />
            </a>
            <a
              href="https://github.com/cedar2025/Xboard-Node/blob/dev/docs-custom-routes.md"
              target="_blank"
              rel="noreferrer"
            >
              自定义 Routes 文档
              <ArrowUpRight size={12} />
            </a>
            <a
              href="https://github.com/cedar2025/Xboard-Node/blob/dev/docs-custom-outbounds.md"
              target="_blank"
              rel="noreferrer"
            >
              自定义 Outbounds 文档
              <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© {year} XRoute. 仅供技术交流与学习使用。</span>
        <span>请遵守当地法律法规与平台服务条款。</span>
      </div>
    </footer>
  );
}
