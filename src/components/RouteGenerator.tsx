import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  Bot,
  Braces,
  Check,
  ChevronDown,
  Clapperboard,
  Globe2,
  Info,
  Landmark,
  Languages,
  LayoutGrid,
  Minus,
  Plus,
  Popcorn,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Tv,
  Waypoints,
  X,
} from "lucide-react";
import {
  allServices,
  categories,
  defaultSelection,
  popularServiceIds,
  type Category,
  type Service,
  type ServiceIcon,
} from "../data/services";
import {
  generateRoutes,
  isValidTag,
  parseCustomDomains,
} from "../lib/routes";
import { useOutboundsBuilder } from "../hooks/useOutboundsBuilder";
import { OutboundsWorkspace } from "./OutboundsWorkspace";
import { OutputPanel } from "./OutputPanel";

const STORAGE_KEY = ["xroute", "generator", "state", "v1"].join("-");

type BuilderTool = "routes" | "outbounds";

interface GeneratorState {
  selectedIds: string[];
  globalTag: string;
  perCategory: boolean;
  categoryTags: Record<string, string>;
  includeGeosite: boolean;
  blockTorrent: boolean;
  customDomains: string;
  customDomainsTag: string;
}

const DEFAULT_CATEGORY_TAGS = Object.fromEntries(
  categories.map((category) => [category.id, "proxy"]),
);

const ALL_SERVICE_IDS = allServices.map((service) => service.id);
const JP_KR_SERVICE_IDS = categories
  .filter((category) => category.id === "japan" || category.id === "korea")
  .flatMap((category) => category.services.map((service) => service.id));

const CATEGORY_ICONS: Record<ServiceIcon, ReactNode> = {
  globe: <Globe2 size={18} strokeWidth={1.7} />,
  languages: <Languages size={18} strokeWidth={1.7} />,
  clapperboard: <Clapperboard size={18} strokeWidth={1.7} />,
  tv: <Tv size={18} strokeWidth={1.7} />,
  popcorn: <Popcorn size={18} strokeWidth={1.7} />,
  landmark: <Landmark size={18} strokeWidth={1.7} />,
  sparkles: <Sparkles size={18} strokeWidth={1.7} />,
};

function createInitialState(): GeneratorState {
  const fallback: GeneratorState = {
    selectedIds: [...defaultSelection],
    globalTag: "proxy",
    perCategory: false,
    categoryTags: { ...DEFAULT_CATEGORY_TAGS },
    includeGeosite: false,
    blockTorrent: false,
    customDomains: "",
    customDomainsTag: "",
  };

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<GeneratorState>;
    const knownIds = new Set(ALL_SERVICE_IDS);
    const selectedIds = Array.isArray(parsed.selectedIds)
      ? parsed.selectedIds.filter(
          (id): id is string => typeof id === "string" && knownIds.has(id),
        )
      : fallback.selectedIds;
    const storedCategoryTags =
      parsed.categoryTags && typeof parsed.categoryTags === "object"
        ? parsed.categoryTags
        : {};
    const categoryTags = Object.fromEntries(
      categories.map((category) => {
        const tag = storedCategoryTags[category.id];
        return [
          category.id,
          typeof tag === "string" ? tag : DEFAULT_CATEGORY_TAGS[category.id],
        ];
      }),
    );

    return {
      selectedIds: [...new Set(selectedIds)],
      globalTag:
        typeof parsed.globalTag === "string" ? parsed.globalTag : "proxy",
      perCategory: Boolean(parsed.perCategory),
      categoryTags,
      includeGeosite: Boolean(parsed.includeGeosite),
      blockTorrent: Boolean(parsed.blockTorrent),
      customDomains:
        typeof parsed.customDomains === "string" ? parsed.customDomains : "",
      customDomainsTag:
        typeof parsed.customDomainsTag === "string"
          ? parsed.customDomainsTag
          : "",
    };
  } catch {
    return fallback;
  }
}

function sameIdSet(selected: readonly string[], target: readonly string[]) {
  if (selected.length !== target.length) return false;
  const selectedSet = new Set(selected);
  return target.every((id) => selectedSet.has(id));
}

function matchesSearch(service: Service, category: Category, query: string) {
  if (!query) return true;
  const haystack = [
    service.name,
    service.id,
    service.region ?? "",
    category.name,
    category.code,
    ...service.keywords,
  ]
    .join(" ")
    .toLowerCase();
  if (haystack.includes(query)) return true;
  return query.includes(".") && service.domains.some((domain) => domain.includes(query));
}

interface CategoryCardProps {
  category: Category;
  services: Service[];
  selectedIds: ReadonlySet<string>;
  open: boolean;
  perCategory: boolean;
  categoryTag: string;
  onToggleOpen: () => void;
  onToggleService: (id: string) => void;
  onToggleAll: (services: Service[]) => void;
  onCategoryTagChange: (tag: string) => void;
}

function CategoryCard({
  category,
  services,
  selectedIds,
  open,
  perCategory,
  categoryTag,
  onToggleOpen,
  onToggleService,
  onToggleAll,
  onCategoryTagChange,
}: CategoryCardProps) {
  const selectedCount = category.services.filter((service) =>
    selectedIds.has(service.id),
  ).length;
  const targets = services;
  const targetSelectedCount = targets.filter((service) =>
    selectedIds.has(service.id),
  ).length;
  const allTargetsSelected =
    targets.length > 0 && targetSelectedCount === targets.length;
  const someTargetsSelected = targetSelectedCount > 0 && !allTargetsSelected;
  const tagInvalid =
    perCategory && selectedCount > 0 && !isValidTag(categoryTag);

  return (
    <article className={`category-card ${open ? "is-open" : ""}`}>
      <div className="category-head">
        <button
          type="button"
          className="category-toggle"
          onClick={onToggleOpen}
          aria-expanded={open}
        >
          <span className="category-icon">
            {CATEGORY_ICONS[category.icon]}
          </span>
          <span className="category-copy">
            <span className="category-title-row">
              <span className="category-title">{category.name}</span>
              <span className="category-code">{category.code}</span>
            </span>
            <span className="category-description">{category.description}</span>
          </span>
          <ChevronDown className="category-chevron" size={16} />
        </button>

        <div className="category-side">
          {selectedCount > 0 ? (
            <span className="category-count">{selectedCount}</span>
          ) : null}
          {perCategory && selectedCount > 0 ? (
            <span className={`category-tag-badge ${tagInvalid ? "is-invalid" : ""}`}>
              → {categoryTag || "未设置"}
            </span>
          ) : null}
          <button
            type="button"
            className={`bulk-check ${allTargetsSelected ? "is-checked" : ""} ${
              someTargetsSelected ? "is-mixed" : ""
            }`}
            onClick={() => onToggleAll(targets)}
            role="checkbox"
            aria-label={
              allTargetsSelected
                ? `取消选择${category.name}的全部平台`
                : `选择${category.name}的全部平台`
            }
            aria-checked={
              allTargetsSelected ? true : someTargetsSelected ? "mixed" : false
            }
          >
            {allTargetsSelected ? (
              <Check size={13} strokeWidth={2.4} />
            ) : someTargetsSelected ? (
              <Minus size={13} strokeWidth={2.4} />
            ) : null}
          </button>
        </div>
      </div>

      {open ? (
        <div className="category-body">
          {perCategory ? (
            <label className="category-tag-field">
              <span>
                <Route size={13} />
                outboundTag
              </span>
              <input
                type="text"
                value={categoryTag}
                onChange={(event) => onCategoryTagChange(event.target.value)}
                className={tagInvalid ? "is-invalid" : ""}
                placeholder="proxy"
                spellCheck={false}
                autoComplete="off"
                aria-label={`${category.name}的 outboundTag`}
                aria-invalid={tagInvalid}
                list="xboard-outbound-tags"
              />
            </label>
          ) : null}

          <div className="service-grid">
            {services.map((service) => {
              const selected = selectedIds.has(service.id);
              return (
                <label
                  className={`service-tile ${selected ? "is-selected" : ""}`}
                  key={service.id}
                  style={
                    {
                      "--service-brand": service.brand,
                    } as CSSProperties
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleService(service.id)}
                  />
                  <span
                    className={`service-mark ${
                      service.mark.length > 2 ? "is-compact" : ""
                    }`}
                  >
                    {service.mark}
                  </span>
                  <span className="service-copy">
                    <span className="service-name">{service.name}</span>
                    <span className="service-meta">
                      {service.region ? `${service.region} · ` : ""}
                      {service.domains.length} 条路由
                    </span>
                  </span>
                  <span className="service-check" aria-hidden="true">
                    {selected ? (
                      <Check size={12} strokeWidth={2.5} />
                    ) : (
                      <Plus size={12} strokeWidth={2} />
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

interface SettingsCardProps {
  globalTag: string;
  perCategory: boolean;
  includeGeosite: boolean;
  blockTorrent: boolean;
  hasSelection: boolean;
  outboundTags: string[];
  onGlobalTagChange: (tag: string) => void;
  onPerCategoryChange: (value: boolean) => void;
  onIncludeGeositeChange: (value: boolean) => void;
  onBlockTorrentChange: (value: boolean) => void;
}

function SettingsCard({
  globalTag,
  perCategory,
  includeGeosite,
  blockTorrent,
  hasSelection,
  outboundTags,
  onGlobalTagChange,
  onPerCategoryChange,
  onIncludeGeositeChange,
  onBlockTorrentChange,
}: SettingsCardProps) {
  const invalid = hasSelection && !perCategory && !isValidTag(globalTag);

  return (
    <section className="settings-card">
      <div className="card-heading">
        <div>
          <span className="card-eyebrow">ROUTING TARGET</span>
          <h3>出站设置</h3>
        </div>
        <span className="step-chip">01</span>
      </div>

      <div className="settings-main">
        <label className="tag-field">
          <span className="field-label">
            <Route size={13} />
            outboundTag
          </span>
          <span className={`tag-input-shell ${invalid ? "is-invalid" : ""}`}>
            <span className="tag-prefix">→</span>
            <input
              type="text"
              value={globalTag}
              onChange={(event) => onGlobalTagChange(event.target.value)}
              placeholder="proxy"
              spellCheck={false}
              autoComplete="off"
              maxLength={64}
              aria-invalid={invalid}
              list="xboard-outbound-tags"
            />
          </span>
          <span className={`field-help ${invalid ? "is-error" : ""}`}>
            {invalid
              ? "请填写有效的标签，不能包含空格或 JSON 特殊字符。"
              : perCategory
                ? "关闭按分类时使用；自定义域名留空时也作为回退标签。"
                : "与节点自定义 Outbounds 中的 tag 保持一致。"}
          </span>
          {outboundTags.length > 0 ? (
            <span className="tag-source-hint">
              <Waypoints size={11} />
              已读取 {outboundTags.length} 个自定义 tag
            </span>
          ) : null}
        </label>

        <button
          type="button"
          className="setting-switch-row"
          role="switch"
          aria-checked={perCategory}
          onClick={() => onPerCategoryChange(!perCategory)}
        >
          <span className="switch-copy">
            <strong>按分类分配标签</strong>
            <span>为不同地区使用不同的 Outbound</span>
          </span>
          <span className={`switch-track ${perCategory ? "is-on" : ""}`}>
            <span />
          </span>
        </button>
      </div>

      <div className="advanced-options">
        <label className="check-option">
          <input
            type="checkbox"
            checked={includeGeosite}
            onChange={(event) => onIncludeGeositeChange(event.target.checked)}
          />
          <span className="check-option-box" aria-hidden="true">
            <Check size={11} strokeWidth={2.5} />
          </span>
          <span className="check-option-copy">
            <span>
              加入 geosite
              <Info
                className="inline-info"
                size={12}
                aria-label="需要节点包含 geosite.dat；默认使用显式域名。"
              />
            </span>
            <small>需要节点具备 geosite 数据</small>
          </span>
        </label>

        <label className="check-option">
          <input
            type="checkbox"
            checked={blockTorrent}
            onChange={(event) => onBlockTorrentChange(event.target.checked)}
          />
          <span className="check-option-box" aria-hidden="true">
            <Check size={11} strokeWidth={2.5} />
          </span>
          <span className="check-option-copy">
            <span>阻止 BT 流量</span>
            <small>添加 bittorrent → block 规则</small>
          </span>
        </label>
      </div>
    </section>
  );
}

interface CustomDomainsCardProps {
  open: boolean;
  value: string;
  tag: string;
  globalTag: string;
  onToggle: () => void;
  onChange: (value: string) => void;
  onTagChange: (value: string) => void;
}

function CustomDomainsCard({
  open,
  value,
  tag,
  globalTag,
  onToggle,
  onChange,
  onTagChange,
}: CustomDomainsCardProps) {
  const parsed = useMemo(() => parseCustomDomains(value), [value]);

  return (
    <section className={`custom-domains-card ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="custom-domains-head"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="custom-domains-icon">
          <Braces size={17} strokeWidth={1.8} />
        </span>
        <span className="custom-domains-title">
          <span>自定义域名规则</span>
          <small>添加预设之外的域名，支持通配符与 URL</small>
        </span>
        {parsed.domains.length > 0 ? (
          <span className="custom-domains-count">
            {parsed.domains.length} 个
          </span>
        ) : null}
        <ChevronDown className="custom-domains-chevron" size={16} />
      </button>

      {open ? (
        <div className="custom-domains-body">
          <div className="custom-domains-topline">
            <label className="field-label" htmlFor="custom-domains-input">
              <Plus size={13} />
              每个域名一行
            </label>
            <label className="mini-tag-field">
              <span>outboundTag</span>
              <input
                type="text"
                value={tag}
                onChange={(event) => onTagChange(event.target.value)}
                placeholder={globalTag || "proxy"}
                spellCheck={false}
                autoComplete="off"
                list="xboard-outbound-tags"
              />
            </label>
          </div>
          <textarea
            id="custom-domains-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            aria-label="自定义域名列表"
            placeholder={`example.com\n*.example.net\nfull:assets.example.org\nhttps://video.example.com/watch`}
          />
          <div className="custom-domains-foot">
            <span>
              自动识别 URL、<code>*.domain</code>、<code>domain:</code>、
              <code>full:</code>、<code>regexp:</code>
            </span>
            {parsed.invalid.length > 0 ? (
              <span className="custom-domains-invalid">
                {parsed.invalid.length} 条格式无法识别
              </span>
            ) : (
              <span className="custom-domains-valid">
                <Check size={12} />
                已识别 {parsed.domains.length} 个
              </span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function RouteGenerator() {
  const [activeTool, setActiveTool] = useState<BuilderTool>("routes");
  const [config, setConfig] = useState<GeneratorState>(createInitialState);
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(["global"]),
  );
  const [customDomainsOpen, setCustomDomainsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    drafts: outboundDrafts,
    setDrafts: setOutboundDrafts,
    result: outboundResult,
  } = useOutboundsBuilder();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Local persistence is a convenience; generation still works without it.
    }
  }, [config]);

  useEffect(() => {
    if (activeTool !== "routes") return;

    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeTool]);

  const selectedIds = useMemo(
    () => new Set(config.selectedIds),
    [config.selectedIds],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const hasSelection = selectedIds.size > 0;
  const outboundTags = useMemo(
    () => [
      ...new Set(
        outboundDrafts
          .map((draft) => draft.tag.trim())
          .filter(Boolean),
      ),
    ],
    [outboundDrafts],
  );
  const routeTagOptions = useMemo(
    () => [...new Set([...outboundTags, "direct", "block"])],
    [outboundTags],
  );

  const filteredCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          services: category.services.filter((service) =>
            matchesSearch(service, category, normalizedQuery),
          ),
        }))
        .filter(
          ({ services }) => !normalizedQuery || services.length > 0,
        ),
    [normalizedQuery],
  );

  const result = useMemo(
    () =>
      generateRoutes({
        selectedIds,
        globalTag: config.globalTag,
        perCategory: config.perCategory,
        categoryTags: config.categoryTags,
        includeGeosite: config.includeGeosite,
        blockTorrent: config.blockTorrent,
        customDomains: config.customDomains,
        customDomainsTag: config.customDomainsTag,
      }),
    [selectedIds, config],
  );

  const presets = useMemo(
    () => [
      {
        id: "popular",
        label: "热门推荐",
        description: "6 个常用平台",
        icon: Sparkles,
        ids: [...popularServiceIds],
      },
      {
        id: "ai",
        label: "AI 服务",
        description: "ChatGPT / Claude / Gemini",
        icon: Bot,
        ids: ["ai"],
      },
      {
        id: "jp-kr",
        label: "日韩流媒体",
        description: "21 个地区平台",
        icon: Clapperboard,
        ids: JP_KR_SERVICE_IDS,
      },
      {
        id: "all",
        label: "全部平台",
        description: `${allServices.length} 个预设`,
        icon: LayoutGrid,
        ids: ALL_SERVICE_IDS,
      },
    ],
    [],
  );

  function updateConfig(patch: Partial<GeneratorState>) {
    setConfig((previous) => ({ ...previous, ...patch }));
  }

  function toggleService(id: string) {
    setConfig((previous) => {
      const next = new Set(previous.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...previous, selectedIds: [...next] };
    });
  }

  function toggleServices(services: Service[]) {
    if (services.length === 0) return;
    setConfig((previous) => {
      const next = new Set(previous.selectedIds);
      const allSelected = services.every((service) => next.has(service.id));
      for (const service of services) {
        if (allSelected) next.delete(service.id);
        else next.add(service.id);
      }
      return { ...previous, selectedIds: [...next] };
    });
  }

  function applyPreset(ids: readonly string[]) {
    setConfig((previous) => ({ ...previous, selectedIds: [...ids] }));
  }

  function clearSelection() {
    setConfig((previous) => ({ ...previous, selectedIds: [] }));
  }

  function toggleCategoryOpen(id: string) {
    setOpenCategories((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const searchResultCount = filteredCategories.reduce(
    (total, category) => total + category.services.length,
    0,
  );

  function handleTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    current: BuilderTool,
  ) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const next: BuilderTool =
      event.key === "Home" || event.key === "ArrowLeft"
        ? "routes"
        : "outbounds";
    if (next === current) return;
    setActiveTool(next);
    window.requestAnimationFrame(() => {
      document.getElementById(`${next}-tab`)?.focus();
    });
  }

  return (
    <section className="generator-section" id="generator">
      <div className="container">
        <div className="builder-switch-row">
          <div
            className="builder-switch"
            role="tablist"
            aria-label="Xboard 配置类型"
          >
            <button
              type="button"
              role="tab"
              id="routes-tab"
              aria-label="自定义 Routes"
              aria-selected={activeTool === "routes"}
              aria-controls="routes-panel"
              tabIndex={activeTool === "routes" ? 0 : -1}
              className={`builder-switch-button ${
                activeTool === "routes" ? "is-active" : ""
              }`}
              onClick={() => setActiveTool("routes")}
              onKeyDown={(event) => handleTabKeyDown(event, "routes")}
            >
              <span className="builder-switch-icon">
                <Route size={16} strokeWidth={1.8} />
              </span>
              <span className="builder-switch-copy">
                <strong>
                  <span className="tab-label-full">自定义 Routes</span>
                  <span className="tab-label-short">Routes</span>
                </strong>
                <small>流媒体域名分流</small>
              </span>
              <span className="builder-switch-count">
                {String(selectedIds.size).padStart(2, "0")}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              id="outbounds-tab"
              aria-label="自定义 Outbounds"
              aria-selected={activeTool === "outbounds"}
              aria-controls="outbounds-panel"
              tabIndex={activeTool === "outbounds" ? 0 : -1}
              className={`builder-switch-button ${
                activeTool === "outbounds" ? "is-active" : ""
              }`}
              onClick={() => setActiveTool("outbounds")}
              onKeyDown={(event) => handleTabKeyDown(event, "outbounds")}
            >
              <span className="builder-switch-icon">
                <Waypoints size={16} strokeWidth={1.8} />
              </span>
              <span className="builder-switch-copy">
                <strong>
                  <span className="tab-label-full">自定义 Outbounds</span>
                  <span className="tab-label-short">Outbounds</span>
                </strong>
                <small>代理出口与链路</small>
              </span>
              {outboundResult.errors.length > 0 ? (
                <span
                  className="builder-switch-error"
                  title="Outbounds 存在配置错误"
                />
              ) : null}
              <span className="builder-switch-count">
                {String(outboundDrafts.length).padStart(2, "0")}
              </span>
            </button>
          </div>
          <span className="builder-switch-note">
            <ShieldCheck size={13} />
            本地生成 · 自动保存
          </span>
        </div>

        <datalist id="xboard-outbound-tags">
          {routeTagOptions.map((tag) => (
            <option value={tag} key={tag} />
          ))}
        </datalist>

        <div
          className="builder-view"
          id="routes-panel"
          role="tabpanel"
          aria-labelledby="routes-tab"
          hidden={activeTool !== "routes"}
        >
            <div className="section-heading">
          <div className="section-heading-copy">
            <span className="section-eyebrow">01 / ROUTE BUILDER</span>
            <h2>选择需要解锁的平台</h2>
            <p>
              自动合并重复域名并生成 Xray 原生规则。所有处理都在本地完成。
            </p>
          </div>
          <div className="selection-summary">
            <span className="selection-summary-value">
              {String(selectedIds.size).padStart(2, "0")}
            </span>
            <span className="selection-summary-label">
              已选择
              <small>/ {allServices.length} 个平台</small>
            </span>
          </div>
            </div>

            <div className="library-toolbar">
          <div className="search-shell">
            <Search size={16} strokeWidth={1.8} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 Netflix、AI、日本…"
              aria-label="搜索流媒体平台"
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="清除搜索"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </div>

          <div className="library-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => applyPreset(ALL_SERVICE_IDS)}
            >
              全选
            </button>
            <span className="action-divider" />
            <button
              type="button"
              className="text-button"
              onClick={clearSelection}
              disabled={!hasSelection}
            >
              清空
            </button>
          </div>
        </div>

        <div className="preset-row">
          <span className="preset-label">快速预设</span>
          <div className="preset-list">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const active = sameIdSet(config.selectedIds, preset.ids);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-button ${active ? "is-active" : ""}`}
                  onClick={() => applyPreset(preset.ids)}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  <span>{preset.label}</span>
                  <small>{preset.description}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="generator-grid">
          <div className="generator-column">
            <SettingsCard
              globalTag={config.globalTag}
              perCategory={config.perCategory}
              includeGeosite={config.includeGeosite}
              blockTorrent={config.blockTorrent}
              hasSelection={hasSelection}
              outboundTags={outboundTags}
              onGlobalTagChange={(tag) =>
                updateConfig({ globalTag: tag })
              }
              onPerCategoryChange={(perCategory) =>
                updateConfig({ perCategory })
              }
              onIncludeGeositeChange={(includeGeosite) =>
                updateConfig({ includeGeosite })
              }
              onBlockTorrentChange={(blockTorrent) =>
                updateConfig({ blockTorrent })
              }
            />

            <div className="library-heading-row">
              <div>
                <span className="card-eyebrow">PLATFORM LIBRARY</span>
                <h3>平台列表</h3>
              </div>
              <span className="library-result-count">
                {normalizedQuery
                  ? `${searchResultCount} 个结果`
                  : `${categories.length} 个分类`}
              </span>
            </div>

            <div className="category-list">
              {filteredCategories.length > 0 ? (
                filteredCategories.map(({ category, services }) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    services={services}
                    selectedIds={selectedIds}
                    open={Boolean(normalizedQuery) || openCategories.has(category.id)}
                    perCategory={config.perCategory}
                    categoryTag={config.categoryTags[category.id] ?? ""}
                    onToggleOpen={() => toggleCategoryOpen(category.id)}
                    onToggleService={toggleService}
                    onToggleAll={toggleServices}
                    onCategoryTagChange={(tag) =>
                      setConfig((previous) => ({
                        ...previous,
                        categoryTags: {
                          ...previous.categoryTags,
                          [category.id]: tag,
                        },
                      }))
                    }
                  />
                ))
              ) : (
                <div className="search-empty">
                  <span className="search-empty-icon">
                    <Search size={22} strokeWidth={1.5} />
                  </span>
                  <h3>没有找到“{query}”</h3>
                  <p>试试平台名、中文别名或域名后缀。</p>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => setQuery("")}
                  >
                    清除搜索
                  </button>
                </div>
              )}
            </div>

            <CustomDomainsCard
              open={customDomainsOpen}
              value={config.customDomains}
              tag={config.customDomainsTag}
              globalTag={config.globalTag}
              onToggle={() => setCustomDomainsOpen((open) => !open)}
              onChange={(customDomains) => updateConfig({ customDomains })}
              onTagChange={(customDomainsTag) =>
                updateConfig({ customDomainsTag })
              }
            />
          </div>

          <div className="output-column">
            <OutputPanel
              result={result}
              onLoadPopular={() => applyPreset(popularServiceIds)}
            />
          </div>
        </div>
        </div>
        <div
          className="builder-view"
          id="outbounds-panel"
          role="tabpanel"
          aria-labelledby="outbounds-tab"
          hidden={activeTool !== "outbounds"}
        >
          <OutboundsWorkspace
            drafts={outboundDrafts}
            onChange={setOutboundDrafts}
            result={outboundResult}
          />
        </div>
      </div>
    </section>
  );
}
