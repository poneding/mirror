# Mirror

一款基于 Rust（Tauri 2）的跨平台离线视频播放器。界面极简、磨砂透明，窗口按视频画面比例加载。

## 运行

使用 Makefile（`make help` 查看全部命令）：

```bash
make install      # 安装依赖
make run          # 启动桌面应用（tauri dev）
make run-web      # 仅前端，浏览器内预览 UI
make build-app    # 打包桌面应用（需签名变量，见“发布与更新”）
```

质量门：

```bash
make check        # 类型检查 + lint（不写入，CI 入口）
make test         # Vitest + cargo test
make coverage     # src/lib 覆盖率
make audit        # 依赖安全审计
```

直接使用 npm 亦可：

```bash
npm install
npm run tauri dev
npm run build
npm test
```

## 技术栈

| 层 | 选择 | 说明 |
| --- | --- | --- |
| 原生外壳 | Tauri 2 (Rust) | 窗口、置顶、全屏、按比例缩放、系统文件对话框 |
| 渲染 | 系统 WebView (WebView2 / WKWebView / WebKitGTK) | 硬件加速解码，无需内置播放内核 |
| 界面 | React 19 + TypeScript + Vite | 无运行时 UI 框架，纯 CSS 变量主题 |
| 图标 | lucide-react | 统一 24×24 viewBox |
| 主题色 | shadcn 默认 neutral 调色板 | 深/浅/跟随系统 |
| 磨砂 | `window-vibrancy` | Windows Acrylic / macOS Vibrancy |
| 更新 | `tauri-plugin-updater` + git-cliff | Release 正文即 changelog，签名校验后安装 |
| 测试 | Vitest (jsdom) + `cargo test` | `src/lib` 纯逻辑双端覆盖 |
| Lint | ESLint (typescript-eslint) + clippy `-D warnings` | 告警即失败 |

## 应用 Logo

<img src="src/assets/logo.svg" alt="Mirror 应用 Logo" width="96" height="96" />

银白镜面、石墨色播放切面，以及左侧更轻的磨砂倒影。图形保持中性配色，
透明圆角外沿可用于深浅背景；不将文字塞进小尺寸应用图标。

- [设计预览](design-system/mirror/brand/preview.html)：深浅背景与 16–96 px 尺寸对照。
- 矢量源稿：`src/assets/logo.svg`，颜色集中在 SVG 的 CSS 变量中。
- 首页图标：`src/assets/logo.png`（256×256）。
- 高清母版：`src-tauri/icons/icon.png`（1024×1024），其余 PNG / ICO / ICNS 同步生成。

修改源稿后运行 `make icons`，无需新增依赖。不要从小图反向放大生成应用图标。

## 快捷键

| 功能 | macOS | Windows / Linux |
| --- | --- | --- |
| 播放 / 暂停 | `Space` | `Space` |
| 快进 / 快退 | `←` `→` | `←` `→` |
| 音量 | `↑` `↓` | `↑` `↓` |
| 上一个 / 下一个 | `⌘ ←` `⌘ →` | `Alt ←` `Alt →` |
| 倍速 | `⌘ ↑` `⌘ ↓` | `Alt ↑` `Alt ↓` |
| 全屏 / 退出全屏 | `Enter` | `Enter` |
| 打开视频 | `⌘ O` | `Ctrl O` |
| 设置面板 | `⌘ ,` | `Ctrl ,` |
| 播放列表面板 | `⌘ P` | `Ctrl P` |

长按 `←` / `→`：分别以 0.25× / 2× 倍速播放，松开即恢复所选倍速；轻按仍是快退 / 快进。

`Esc` 优先级：关闭设置面板 → 关闭播放列表面板 → 退出全屏。

## 发布与更新

发布以 tag 为准：**推送版本 tag 即自动发布**——CI 会创建 Release 并构建、上传安装包，普通推送不发布任何东西。

```bash
# 创建 tag 并推送，发布到此结束
git tag v0.2.0 && git push origin v0.2.0
```

手动在 GitHub 上为该 tag 创建并发布 release 同样会触发这条流水线（正文由 CI 覆盖），历史上漏发的 tag、
或重跑某次失败的发布都走这条路。

`.github/workflows/release.yml` 会：

1. 校验 tag 符合 SemVer（`v1.2.3`，预发布用 `v1.2.3-rc.1`），并把它写入 `package.json`、`package-lock.json`、`tauri.conf.json`、`Cargo.toml`（`scripts/set-version.mjs`，tag 即版本号唯一来源）。
2. 创建 Release（已存在则只更新正文），用 git-cliff（`cliff.toml`）生成本次 tag 的 changelog 写进正文。
3. 在 macOS（arm64 + x86_64）、Linux、Windows 上构建、签名，上传安装包与 `latest.json`。

预发布阶段还有一个坑，现在由流水线代为处理：更新检查读的是 `releases/latest/download/latest.json`，
而 GitHub 的 `/releases/latest` **不包含** prerelease 与草稿，API 也不能把 prerelease 设为 latest
（`Latest release cannot be draft or prerelease`）。所以只要还没有正式版，Release 就不能带 GitHub 的
prerelease 勾，否则应用检查更新会报 “Could not fetch a valid release JSON from the remote”。tag 本身叫
`v0.1.0-alpha.2`（SemVer 预发布）没问题，隐藏它的是那个勾。因此只有**已经存在正式版 Release** 时，CI
才会给 `v1.2.3-rc.1` 这类预发布 tag 打勾；在此之前一律不打。等正式版发布后规则自动反过来——那时
`latest.json` 指向正式版，预发布版用户依然会收到升级提示（SemVer 里 `0.1.0 > 0.1.0-alpha.3`）。历史
上勾错的仍可手动取消：`gh release edit <tag> --prerelease=false`。

changelog 由 Conventional Commits 生成，所以提交信息要带类型前缀（`feat` / `fix` / `perf` / `refactor` / `docs`；`chore`、`ci`、`style`、`test` 不入 changelog）。**release 正文就是应用内“更新内容”的来源**：`latest.json` 的 `notes` 取自正文，更新提示里以 Markdown 渲染。

### 一次性配置

```bash
# 1. 生成签名密钥（私钥务必保密并备份；丢失后已安装的旧版本将无法再升级）
npm run tauri signer generate -- -w ~/.tauri/mirror.key

# 2. 公钥写入 src-tauri/tauri.conf.json 的 plugins > updater > pubkey（当前已写入本机生成的公钥）
cat ~/.tauri/mirror.key.pub

# 3. 私钥加进仓库 secret；私钥设了密码就再加 TAURI_SIGNING_PRIVATE_KEY_PASSWORD
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo <owner>/<repo> < ~/.tauri/mirror.key
```

另外确认 `src-tauri/tauri.conf.json` 的 `plugins > updater > endpoints` 指向本仓库（默认按 `poneding/mirror` 填写）。

本地打包同样需要签名变量，否则 `tauri build` 会交互式索要私钥密码：

```bash
TAURI_SIGNING_PRIVATE_KEY=~/.tauri/mirror.key TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" make build-app
```

### 应用内更新

打开“自动检查更新”后，应用启动时向上述端点查询一次；也可以在设置面板点“检查更新”。检查结果会
弹出一个对话框：有新版本时在里面用 Markdown 展示 changelog，并提供“下载并安装”（安装后重启
生效）；没有更新、检查失败、或最新版被预览版设置拦住，都在同一个对话框里说明。启动时的那次检查
只在真的可以更新时才弹出，不打扰用户。

“接收预览版更新”默认关闭，所以 `0.1.0-alpha.2` 这类预览版不会被自动升级到稳定版用户身上。关闭时
如果发现的最新版是预览版，对话框会点名版本并说明原因，并提供“开启并重新检查”——否则用户看到的
现象和“已是最新版本”一模一样。注意这里看的是版本号本身（SemVer 的预发布段），不是 GitHub 上的
prerelease 勾选，两者是两回事。

网络请求只发往该 Release 端点，不涉及遥测。

## 打开视频与文件夹

首页的「打开」控件分成两半：左边「打开视频」直接弹出文件选择框（可多选），右边的箭头弹出菜单
（打开视频 / 打开文件夹）。播放列表工具栏空间够用，就直白地放两个按钮：「添加视频」与「添加
视频文件夹」。

文件夹会加载其中的全部视频：目录自身的文件在前，然后是各子目录，同一层按文件名（忽略大小写）排序。
之所以不是「一个对话框两种都选」：系统对话框本身就是二选一——Windows 用 `FOS_PICKFOLDERS`
在两者间切换，rfd 在 macOS 上把 `NSOpenPanel` 的两种模式写死，Tauri 插件也只暴露
`directory: true/false`（上游 issue：tauri-apps/plugins-workspace#2137、PolyMeilex/rfd#131）。
所以首页把文件夹放进箭头菜单、让最常见的「打开视频」保持一次点击，工具栏则是两个并列按钮。

把文件或文件夹直接拖进窗口走同一条路径——拖入文件夹与选「打开文件夹」等价。

只有原生层能枚举目录，所以遍历由 Rust 命令 `collect_video_paths` 完成，扩展名过滤表仍只有一份
（`lib/player.ts` 的 `SUPPORTED_VIDEO_EXTENSIONS`），由前端传入；读不到的条目跳过，符号链接指向的
目录不进入（否则可能成环）。浏览器预览没有原生遍历，改用文件输入的 `webkitdirectory` 模式。

## 设置持久化

主题、语言、快进步长、倍速、音量、播放结束行为、自动更新检查、预览版更新、自动清除播放记录均写入 `localStorage`（键名集中在 `STORAGE_KEYS`）。播放列表与播放进度同样持久化；浏览器预览模式下 `blob:` 来源无法跨刷新保存，会在恢复时自动丢弃（桌面端使用 `asset://` 协议，不受影响）。

## 窗口比例

窗口始终匹配视频宽高比。缩放是等比进行的，约束只改变整体尺寸，绝不会单独改某一轴——按轴独立 clamp 会扭曲 32:9 或竖屏等极端比例。`fitWindowToVideo`（TypeScript）与 `fitted_size`（Rust）是同一算法的两份实现，两端均有测试；修改其一请同步另一个。

比例只决定窗口**初始**尺寸，它不锁定拖动。用户拖出的窗口形状可以与视频不同（Tauri 2 / tao 0.35 没有 `set_aspect_ratio`），此时画面必须完整留黑边显示，绝不能被裁掉。这靠 `.video-element` 的 `min-width: 0; min-height: 0;` 保证：`<video>` 是替换元素，作为 `.stage` 的 grid 子项时自动最小尺寸等于其固有尺寸，缺了这两条声明就会溢出并被 `overflow: hidden` 裁掉上下边缘（正是“调整窗口宽度后画面被遮挡”的原因）。`src/lib/aspect.test.ts` 直接读取 `src/styles.css` 校验这两条声明，防止回归。

## 已知边界

- 安装包未做系统级代码签名（Apple Developer ID / Windows Authenticode），用户首次打开会有系统提示；CI 只产出 Windows NSIS 安装包，MSI 需要时在 workflow 矩阵里加 `msi`。
- 图标由 `src-tauri/icons/icon.png`（256×256）生成，放大后略显模糊；换成 1024×1024 源图后重跑 `npm run tauri icon` 即可。
- 更新检查依赖已发布的 release 与 `latest.json`；仓库名或端点不匹配时会显示检查失败。
- 播放依赖系统 WebView 的编解码能力，不额外内置解码器；个别容器格式（如部分 `mkv` 编码组合）在缺少系统解码器时无法播放。
- 播放列表为平铺结构，暂不支持拖拽排序；仅保存最近一条播放位置。
- 设置面板与播放列表面板共用一个位置，二者互斥。
