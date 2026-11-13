# XRoute

为 **Xboard Node** 高级协议配置中的「自定义 Routes」与「自定义 Outbounds」
生成可直接粘贴的 JSON 配置。界面参考 Vercel 的极简黑白风格，针对桌面端与移动端做了响应式适配。

![XRoute 界面预览](./preview.png)

## 功能

- 覆盖 55 个流媒体、AI 与地区服务，分为 7 个地区分类
- 默认输出单条 `proxy` 规则，支持按分类配置不同的 `outboundTag`
- 支持 7 种 Xray 出口：SOCKS5、HTTP、Shadowsocks、Trojan、VMess、VLESS、WireGuard
- 预置 Cloudflare WARP 参数，支持链式代理、自定义 settings、标签冲突与循环检测
- 自动合并同标签规则、去重域名并校验 JSON
- 支持显式域名、`domain:`、`full:`、`regexp:` 与 `geosite:` 规则
- 可添加自定义域名、批量选择、搜索与快速预设
- 支持复制、下载和浏览器本地自动保存
- 浅色 / 深色主题

## Routes 生成格式

输出是 Xray 原生的 `field` 规则数组，对应 Xboard Node 的 raw
`custom_routes`，**不需要**外层 `routing` 或 `rules` 包装：

```json
[
  {
    "type": "field",
    "outboundTag": "proxy",
    "domain": [
      "domain:netflix.com",
      "domain:disneyplus.com"
    ]
  }
]
```

将结果粘贴到：

```text
Xboard 面板 → 节点编辑 → 高级协议配置 → 自定义 Routes
```

## Outbounds 生成格式

输出为 Xboard 面板可直接接收的结构化数组，不要添加外层对象：

```json
[
  {
    "tag": "proxy",
    "protocol": "socks",
    "settings": {
      "servers": [
        {
          "address": "1.2.3.4",
          "port": 1080
        }
      ]
    }
  },
  {
    "tag": "warp",
    "protocol": "wireguard",
    "settings": {
      "secretKey": "<private-key>",
      "address": ["172.16.0.2/32"],
      "peers": [
        {
          "endpoint": "engage.cloudflareclient.com:2408",
          "publicKey": "<warp-public-key>",
          "keepAlive": 0,
          "allowedIPs": ["0.0.0.0/0", "::/0"]
        }
      ],
      "mtu": 1280,
      "domainStrategy": "ForceIP"
    }
  }
]
```

粘贴到：

```text
Xboard 面板 → 节点编辑 → 高级协议配置 → 自定义 Outbounds
```

> 当前 Outbounds 按 **Xray 内核**生成。Xboard 面板只暴露结构化
> `tag / protocol / settings / proxy_tag` 字段，无法配置 Xray 的根级 TLS、
> REALITY、WebSocket、gRPC 等 `streamSettings`。需要这些能力时应使用节点本地原生配置。

### Outbound 标签

`outboundTag` 必须与节点「自定义 Outbounds」中的 `tag` 一致。仅使用一个出口时保留
默认值 `proxy` 即可。启用「阻止 BT 流量」时会额外生成一条指向 `block` 的规则。

Outbounds 中的 `tag` 可以直接被 Routes 的 `outboundTag` 引用；设置
`proxy_tag` 后，该出口的流量会继续交给目标出口。生成器会检查重复、自引用、
未知引用和生成项之间的循环链。

### geosite

默认输出显式域名。只有在节点包含 `geosite.dat` 时，才建议开启「加入 geosite」选项。

## 本地运行

```bash
pnpm install
pnpm dev
```

生产构建与测试：

```bash
pnpm test
pnpm build
pnpm preview
```

构建产物位于 `dist/`，可部署到任意静态站点托管服务。

## 项目结构

```text
src/
  components/       页面组件与交互
  data/services.ts  平台、分类与域名预设
  lib/routes.ts     JSON 生成、标签校验、自定义域名解析
  lib/outbounds.ts  Xray Outbounds 模板、校验与链式检测
  styles.css        Vercel 风格设计系统与响应式样式
```

平台域名数据维护在 `src/data/services.ts`。新增平台时添加一个 `Service`
对象即可，界面和生成逻辑会自动读取。

## 说明

所有计算都在浏览器本地完成，不会上传节点信息。路由数据仅供技术交流与学习使用，
请遵守当地法律法规以及各平台的服务条款。
