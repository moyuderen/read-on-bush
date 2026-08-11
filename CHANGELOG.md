# Change Log

All notable changes to the "readOnBush" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [2.8.0] - 2026-08-11

### Added

- 新增阅读面板模式（`camouflageSurface: readerPanel`）：伪装阅读内容可显示在侧边栏 Webview 面板中，不占用集成终端，支持全部键盘操作和伪装模板。
- 新增架构设计文档 `docs/architecture.md`，描述分层架构、模块职责和扩展方式。

### Changed

- **架构重构为 DDD 分层结构**：从扁平的 `src/core/*` 迁移到 `domain / application / infrastructure / presentation / formats / config` 六层架构，依赖方向严格自外向内。
- **领域模型解耦**：`TxtBook`、`EpubBook`、`PdfBook` 不再依赖 `ApplicationContext`，改为通过窄端口接口（`BookProgressPort`、`ReadingNotifier`、`TxtDisplayPort`、`ReadingPrivacyPort`）注入依赖。
- **缓存引擎通用化**：新增格式无关的 `ExtractionCache<T>` 和 `CachedExtractionLoader<T>`，统一 mtime 失效、JSON envelope、写入序列化和 in-flight 去重；缓存文件名改为 `encodeURIComponent` 防碰撞，记录增加 `bookId` 校验。
- **阅读器生命周期管理**：`ReadingSession` 成为当前 Reader 的唯一所有者，每次打开创建独立 Reader 实例并完整 dispose；新增 `openGeneration` 防止过期异步打开覆盖新书。
- **状态栏解耦**：状态栏控件改为依赖 `TxtReadingPort` 窄接口，不再直接访问 `ApplicationContext`；格式上下文和可见性由 bootstrap 事件驱动。
- **书架分组逻辑独立**：隐私分组规则从 `PrivacyService` 移至 bookshelf 专用模块，隐私模式下同时隐藏目录名和自定义分类名。
- **构建脚本优化**：`compile` 不再每次 clean，新增 `rebuild`（clean + compile）和 `typecheck`（tsc --noEmit）脚本。
- 扩展名解析提升为共享工具 `utils/fileExtension.ts`，消除 parser 和 format registry 的重复实现。

## [2.7.0] - 2026-08-05

### Added

- 新增隐私界面模式：一键隐藏书架、Tooltip、通知和阅读标题中的真实书名、路径、章节或页码等信息；支持隐私别名及 `readOnBush.privacyDisplayOnStart` 启动配置。
- 新增 EPUB/PDF 图片预览缩略图模式，点击图片后查看大图，切换到隐蔽内容模式时自动关闭图片预览。
- 新增 TXT / EPUB / PDF 书架格式图标，便于快速识别文件格式。

### Changed

- 新增 `readOnBush.imagePreviewMode` 配置，支持 `thumbnail` 和 `large` 两种图片预览初始模式。
- 优化 VSIX 打包范围，仅保留运行时依赖及 PDF.js 必需文件，排除开发依赖和未使用资源。
- 扩展市场分类调整为 `Other`。

## [2.6.0] - 2026-08-05

### Added

- 新建分类入口：书架标题栏新增 **New Category** 按钮，输入分类名后多选书籍加入。
- 重命名分类：按分类分组时右键分类文件夹可重命名，自动更新该分类下所有书籍；若新名与已有分类重名则自动合并。

### Changed

- 设置分类改为 QuickPick 列表选择：直接选已有分类（带数量标注、当前分类高亮），底部支持创建新分类或清除分类，无需每次手动输入。
- 书架改为 `createTreeView` 注册，支持拖拽：按分类分组时直接把书籍拖到目标分类文件夹或另一本书上即可改分类，拖到「未分类」或空白处清除分类，支持多选拖拽。

## [2.5.2] - 2026-08-05

### Changed

- 优化插件市场搜索发现性：精简 description，扩充 keywords（覆盖中英文高频搜索词），新增 Education 分类。
- 补充 `license`（Apache-2.0）和 `homepage` 元数据字段。

## [2.5.1] - 2026-08-05

### Changed

- 大幅缩减安装包体积（8.5 MB → 1.5 MB，-82%）：排除 pdfjs-dist 中未使用的 cmaps / standard_fonts / web viewer / image_decoders / min 重复构建等附属文件。
- 清理残留的 `linebyline` 依赖（代码已不引用），排除 `pngjs` 浏览器构建和 README 截图等无关文件。
- 压缩扩展图标 `moyu.png`（1254×1254 → 256×256，1.5 MB → 108 KB），不影响显示效果。

## [2.5.0] - 2026-08-04

### Added

- 新增 `readOnBush.txtEncoding` 配置项，支持自动检测或手动指定 TXT 文件编码（`auto`/`utf-8`/`utf-16le`/`utf-16be`/`gb18030`），解决 Windows 中文 TXT 乱码问题。

### Changed

- 移除 `readOnBush.displayTarget` 的 `both` 选项，简化为 `statusBar` 和 `terminalCamouflage` 二选一，通过状态栏终端图标一键切换。
- TXT 阅读快捷键改为按书籍格式自动激活/释放：打开 TXT 书籍后快捷键自动生效，关闭或切换到 EPUB/PDF 后自动释放，不影响编辑器原生行首/行尾导航。
- EPUB 提取缓存支持并发去重与写入序列化，避免同一文件在短时间内被重复提取。
- 重写 TxtParser：移除 `linebyline` 依赖，内置 BOM 检测、UTF-16 无 BOM 端序检测与编码启发式。
- 提取 `applyReadingControlVisibility` 共享阅读控件可见性逻辑，消除 start/stop/状态栏刷新三处重复代码。
- 简化 EpubCache，移除冗余的 generation token 系统（写入序列化 + mtime 校验已足够）。

### Fixed

- 修复偶数长度纯 ASCII/UTF-8 文件被误判为 UTF-16 歧义编码导致无法阅读的问题。
- 修复 `Buffer` 传入 `TextDecoder` 在 TypeScript 5.7+ 的类型不兼容问题。

## [2.4.1] - 2026-08-03

### Added

- 新增 `readOnBush.showChapterTitle` 配置，默认显示 EPUB / PDF 终端伪装中的章节或页面名称，也可仅保留全书阅读进度。

### Changed

- 将章节名称显示控制从分页内容中抽离，配置变更时实时刷新 EPUB / PDF 终端伪装。

## [2.4.0] - 2026-08-03

### Added

- 终端伪装新增 `custom` 样式：支持通过单个 JSON 对象自定义普通日志模板（终端名称、正文前缀、header/trailing/debugContent、完成行），并提供安全颜色枚举与 `{{progress}}` 进度占位符。
- 新增可视化模板编辑器：执行 **Read On Bush: 配置自定义终端模板** 打开 Webview，提供默认示例、表单编辑、实时终端预览（标注各配置区段）、只读模板 JSON 与 `settings.json` 配置，支持保存启用、复制 JSON 与恢复示例；将 `terminalCamouflageStyle` 切换为 `custom` 时会自动打开该编辑器。
- 自定义模板同时作用于 TXT / EPUB / PDF 三种格式的伪装终端。

### Changed

- 渲染层统一改为基于「已解析模板」工作，支持宽字符（中文）正文前缀，自定义模板更新后正确刷新终端标题与调试占位缓存。
- 终端伪装的安全 SGR 调色板收敛为单一事实源（`STYLE_SGR_ENTRIES`），编译、预览解析与清洗规则统一派生。
- 扩展改为启动后激活（`onStartupFinished`），确保切换到 `custom` 时能可靠打开模板编辑器。

### Fixed

- 修复自定义模板完成行在进度文案含 `$&` / `$'` / `` $` `` 时被当作 `$`-替换模式，导致 `{{progress}}` 字面量泄漏并破坏输出的问题。
- 修复有工作区配置覆盖时「保存并启用」写入用户配置被静默遮蔽、保存不生效的问题（改为写入当前生效作用域）。

## [2.3.1] - 2026-07-31

### Changed

- 拆分终端伪装模板实现，统一底部渲染接口，保持各伪装样式行为一致。

## [2.3.0] - 2026-07-30

### Added

- 新增 PDF 原生导入与阅读：按页提取文本、展示页面目录、支持跳页和持久化阅读进度。
- 新增 PDF 页面图片预览，按需解码并在快速隐藏时同步关闭图片窗口。
- 新增 PDF 提取缓存、中文排版空格归一化，以及 PDF 格式 provider 和回归测试。

### Changed

- EPUB 与 PDF 复用分页伪装终端和图片预览面板，统一终端阅读交互。
- PDF 从“需转换格式”调整为原生支持格式，CloudConvert 引导仅保留 mobi / azw3。

### Fixed

- 修复 PDF 二进制数据以 Node `Buffer` 传入 pdfjs 导致导入失败的问题。
- 修复 PDF 页边界提前显示下一页图片，以及空白页/纯图片页被跳过的问题。
- 增强 pdfjs 扩展宿主兼容性和 PDF 缓存校验，避免全局状态残留与损坏缓存崩溃。

## [2.2.3] - 2026-07-27

### Added

- 新增 Vite 与 Docker Compose 两种终端伪装样式，并补充更丰富的日志、错误、diff 与调试占位内容。
- 终端伪装模板支持安全 ANSI 配色，使内置日志和占位内容更接近真实终端输出。

### Changed

- 切换终端伪装样式时同步更新终端标题，避免终端名称与当前伪装模板不一致。
- 完善 README 与扩展描述，补充 EPUB 阅读、格式转换引导和终端伪装样式说明。

## [2.2.1] - 2026-07-24

### Changed

- 优化 Claude Code CLI 终端伪装模板，使输出布局更贴近真实 Claude Code 会话，并将 EPUB 伪装终端名称改为 `Claude Code`。

## [2.2.0] - 2026-07-24

### Added

- 导入 mobi/azw3/pdf 时引导用户前往 CloudConvert 转 epub（不自研二进制解析）；目录导入也不再静默丢弃这些格式。

### Changed

- `BookFormatRegistry` 新增 convertible 分类（classifyPath/getAcknowledgedExtensions），集中「app 响应哪些扩展名」的判断，导入对话框 filter 随之包含可转换格式。

## [2.1.0] - 2026-07-24

### Added

- 新增 EPUB 直接阅读：导入 `.epub` 后可在专属伪装终端按章节阅读，支持章节目录、跳章、跨章自动流入、阅读进度（章 + 全书百分比）与按需查看图片。
- 书架支持 epub：epub 书可展开查看章节，点击章节跳转；导入时提取章节目录并预热缓存。
- 抽象伪装终端视觉原语（日志模板 / 折行 / 拼屏），txt 与 epub 共享同一套日志伪装长相。

### Changed

- 引入可扩展的多格式架构：`BookFormatProvider`/`Registry` + 通用 domain 类型 + `ReadingSessionService` 统一阅读会话；导入/打开/目录树/缓存清理统一走 provider，未来新增格式（如 pdf/mobi/azw3）只需注册 provider，无需改动核心流程。
- `BookData` 增加 `format` / `epubProgress` / `chapters` 字段（加法式，不影响 txt）。

## [2.0.0] - 2026-07-22

### Added

- 新增终端伪装阅读窗口，可将正文混入构建日志、Claude Code CLI 或服务日志风格输出。
- 新增阅读内容显示位置配置，支持仅状态栏、仅终端伪装或两处同时显示。
- 新增终端伪装相关配置：正文宽度、展示行数和输出风格。
- 新增按目录批量导入 txt 书籍能力。
- 新增书架管理能力：重命名、删除、设置/清除分类、排序和按分类/目录分组展示。
- 新增阅读体验配置：状态栏片段长度、默认阅读快捷键模式、自动刷新、状态栏前缀和进度展示开关。

### Changed

- 完善 README 使用文档，补充当前大版本的功能亮点、使用流程、命令和配置说明。
- 抽象书籍解析器与书籍存储逻辑，提升后续功能扩展和维护性。

### Fixed

- 修复最后一页阅读进度显示不准确的问题。
- 统一书架树刷新行为，减少导入或更新书籍后的展示不一致。