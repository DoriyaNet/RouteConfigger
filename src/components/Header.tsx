import { ArrowUpRight, Moon, Sun } from "lucide-react";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      viewBox="0 0 36 36"
      fill="none"
    >
      <rect width="36" height="36" rx="9" fill="currentColor" />
      <path
        d="M9.5 10.5h5.1c4.2 0 5.1 3.1 5.1 7.5s1 7.5 5.2 7.5h1.6"
        stroke="var(--brand-contrast)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M9.5 25.5h5.1c2.2 0 3.7-.8 4.8-2.3"
        stroke="var(--brand-contrast)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".46"
      />
      <circle cx="9.5" cy="10.5" r="2.2" fill="var(--brand-contrast)" />
      <circle cx="9.5" cy="25.5" r="2.2" fill="var(--brand-contrast)" />
      <circle cx="26.6" cy="25.5" r="2.2" fill="var(--brand-contrast)" />
    </svg>
  );
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="#top" aria-label="XRoute 首页">
          <BrandMark />
          <span className="brand-word">XRoute</span>
          <span className="brand-pill">for Xboard</span>
        </a>

        <nav className="main-nav" aria-label="主导航">
          <a href="#generator">生成器</a>
          <a href="#how-it-works">使用说明</a>
          <a
            href="https://github.com/cedar2025/Xboard-Node/tree/dev"
            target="_blank"
            rel="noreferrer"
          >
            开发文档
            <ArrowUpRight size={13} strokeWidth={1.8} />
          </a>
        </nav>

        <div className="header-actions">
          <span className="runtime-badge">
            <span className="runtime-dot" />
            Dual kernel
          </span>
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {theme === "dark" ? (
              <Sun size={16} strokeWidth={1.8} />
            ) : (
              <Moon size={16} strokeWidth={1.8} />
            )}
          </button>
          <a className="button button-secondary button-header" href="#generator">
            开始配置
          </a>
        </div>
      </div>
    </header>
  );
}
