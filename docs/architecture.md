# 架构设计文档

本文档描述 Read On Bush v2.8.0 的分层架构与模块职责。

## 目录结构总览

```
src/
├── config/             配置层：常量、命令 ID、设置读写
├── domain/             领域层：纯阅读模型与端口接口（零 VS Code 依赖）
│   └── books/            BookData、TxtBook、EpubBook、PdfBook、分页引擎
├── application/        应用层：服务编排与生命周期管理
├── infrastructure/     基础设施层：文件解析与持久化存储
│   ├── parsers/          TXT / EPUB / PDF 提取器
│   └── storage/          BookStore、ExtractionCache、EpubCache、PdfCache
├── formats/            格式层：连接领域模型与基础设施
│   ├── BookFormat.ts       格式提供者接口与 reader 服务契约
│   ├── BookFormatRegistry.ts  扩展名 → 提供者路由
│   ├── PaginatedReaderBase.ts EPUB / PDF 共用的分页阅读基类
│   ├── CachedExtractionLoader.ts  提取结果缓存加载器
│   ├── epub/             EPUB Provider + Reader
│   ├── pdf/              PDF Provider + Reader
│   └── txt/              TXT Provider + Controller
├── presentation/       表示层：UI 适配
│   ├── bookshelf/         书架树视图
│   ├── reader/            阅读显示（伪装终端渲染、状态栏）
│   ├── readerSurfaces/    显示载体抽象（集成终端 / Webview 面板）
│   ├── readerControls/    终端输入控制
│   ├── readerEditors/     自定义模板可视化编辑器
│   ├── readerTemplates/   伪装模板定义与构建
│   └── statusBar/         状态栏控件
├── utils/              通用工具
└── extension.ts        扩展入口
```

## 分层架构

### 依赖方向

```
presentation ──→ application ──→ domain
formats ────────┤               ↑
infrastructure ──┘               │（领域层不依赖任何外层）
config ─────────→（被各层引用）
```

核心原则：**领域层零外部依赖**。`src/domain/books/` 下的代码不导入 `vscode`、不导入 `application/`、不导入 `presentation/`、不导入 `infrastructure/`。外层通过注入端口接口（Port）来驱动领域模型。

---

### domain（领域层）

| 文件 | 职责 |
|------|------|
| `BookData.ts` | 书籍数据模型与进度类型（`EpubProgress` / `PdfProgress`） |
| `BookOutline.ts` | 目录大纲类型 |
| `TxtBook.ts` | TXT 阅读模型：扁平 `string[]` + 整数游标翻页 |
| `EpubBook.ts` | EPUB 阅读模型：章节结构 + 跨章分页 |
| `PdfBook.ts` | PDF 阅读模型：按页分页（复用 EPUB 分页引擎） |
| `EpubPagination.ts` | 纯分页算法：折行、前/后翻页、进度百分比 |
| `ReadingPorts.ts` | 端口接口：`BookProgressPort`、`ReadingNotifier`、`TxtDisplayPort`、`ReadingPrivacyPort`、`TxtReadingPort` |
| `ReadingDisplayState.ts` | TXT 阅读显示状态 |
| `BookExtractions.ts` | EPUB / PDF 提取结果 DTO |
| `TextWidth.ts` | 字符宽度计算（CJK = 2，ASCII = 1） |

**端口注入模式：** 领域模型通过构造函数注入端口，而非直接依赖具体服务：

```typescript
// TxtBook 不依赖 ApplicationContext，只依赖窄接口
new TxtBook(book, contents, {
  display: txtDisplayPort,    // render / pause / 步进
  progress: progressPort,      // 持久化进度
  notifier: readingNotifier    // info / warn / error
});
```

---

### application（应用层）

| 文件 | 职责 |
|------|------|
| `ApplicationContext.ts` | 服务容器：组装所有子系统，提供 `ReaderServices` |
| `ReadingSession.ts` | 阅读会话：管理当前 Reader 的打开/关闭/导航，持有 `openGeneration` 防止过期异步覆盖 |
| `BookCatalog.ts` | 书架管理：增删改查、分类、排序、分组、隐私模式切换 |
| `PrivacyService.ts` | 隐私策略：书名/消息/图片标题脱敏，终端模板隐私化 |
| `ConfigurationCoordinator.ts` | 配置变更协调：监听设置变化，分发刷新到显示层和阅读会话 |
| `bootstrap.ts` | 启动入口：创建 `ApplicationContext`，注册状态栏、编辑器和格式变更事件 |
| `viewCommands.ts` | 书架命令注册：导入、刷新、自动刷新 |

**Reader 生命周期：** `ReadingSession` 是当前 Reader 的唯一所有者。每次打开书籍时：

1. 关闭旧 Reader（`close()` + `dispose()`）
2. 通过 Provider 创建新 Reader 实例
3. 调用 `reader.open()`，返回 `boolean` 表示是否成功
4. 成功后发射格式变更事件；失败则清理并显示空闲提示

---

### infrastructure（基础设施层）

| 模块 | 职责 |
|------|------|
| `parsers/TxtParser.ts` | TXT 文件读取：BOM 检测、UTF-16 端序检测、GB18030 |
| `parsers/EpubExtractor.ts` | EPUB 解压与章节/图片提取 |
| `parsers/PdfExtractor.ts` | PDF 文本/图片提取（pdfjs-dist） |
| `storage/BookStore.ts` | 书籍数据持久化（VS Code globalState） |
| `storage/ExtractionCache.ts` | 通用提取缓存：mtime 失效、JSON envelope、写入序列化 |
| `storage/EpubCache.ts` | EPUB 缓存适配器（版本 + 校验） |
| `storage/PdfCache.ts` | PDF 缓存适配器（版本 + 结构校验） |

**缓存设计：**

- `ExtractionCache<T>` 是格式无关的通用缓存引擎
- 文件名使用 `encodeURIComponent(bookId)` 避免碰撞
- 缓存记录包含 `bookId` / `version` / `fileMtime`，读取时三者均校验
- 写入操作按 bookId 序列化，避免并发撕裂
- `CachedExtractionLoader<T>` 在 Provider 层持有，提供 in-flight 去重

---

### formats（格式层）

格式层是连接领域模型与基础设施的适配层，每种格式注册一个 `BookFormatProvider`。

| 文件 | 职责 |
|------|------|
| `BookFormat.ts` | 提供者接口、`ReaderServices`、`BookReaderController` |
| `BookFormatRegistry.ts` | 扩展名 → 提供者路由，支持 supported / convertible / unknown 分类 |
| `PaginatedReaderBase.ts` | EPUB / PDF 共用的分页阅读基类：打开/关闭/翻页/图片预览/生命周期 |
| `CachedExtractionLoader.ts` | 提取缓存加载器：缓存命中 → 提取 → 后台写入 |
| `FormatProviderHelpers.ts` | 导入与目录生成的共享工具 |

**Provider 契约：**

```typescript
interface BookFormatProvider {
  readonly format: BookFormat;
  readonly supportedExtensions: readonly string[];
  importBook(input: ImportBookInput): Promise<BookData>;
  createReader(input: CreateReaderInput): BookReaderController;
  getOutline?(book: BookData): Promise<BookOutlineItem[]>;
  deleteCache?(book: BookData): Promise<void>;
}
```

新增格式只需实现 Provider 并在 `createDefaultBookFormatRegistry` 中注册，无需改动核心流程。

---

### presentation（表示层）

| 模块 | 职责 |
|------|------|
| `bookshelf/` | 书架树视图、分组逻辑、隐私脱敏渲染 |
| `reader/` | 阅读显示管理、伪装终端渲染、状态栏适配、图片预览面板 |
| `readerSurfaces/` | 显示载体抽象：`TerminalSurface`（集成终端）与 `ReaderViewSurface`（Webview 面板） |
| `readerControls/` | 终端键盘输入解析与隐蔽控制 |
| `readerEditors/` | 自定义模板可视化编辑器 |
| `readerTemplates/` | 伪装模板定义（Claude CLI / 构建日志 / 服务日志 / Vite / Docker / 自定义） |
| `statusBar/` | 状态栏控件（内容、翻页、进度、模式切换） |

**显示载体抽象（`ReaderSurface`）：**

```
ReaderSurface（接口）
├── TerminalSurface     → 集成终端 + Pseudoterminal
└── ReaderViewSurface   → Webview 面板（readerPanel 模式）
      └── SurfaceRouter  → 运行时热切换，显示类不感知底层载体
```

状态栏控件依赖 `TxtReadingPort` 窄接口而非 `ApplicationContext`，通过 `ReadingSession` 暴露 TXT 能力。

---

### config（配置层）

| 文件 | 职责 |
|------|------|
| `constants.ts` | 应用名、行宽限制、状态栏优先级 |
| `commands.ts` | 命令 ID 枚举、when 子句上下文键 |
| `settings.ts` | 配置读写与规范化（类型安全的 getter） |
| `bookGroups.ts` | 书架分组名称生成 |
| `convertGuide.ts` | 格式转换引导（CloudConvert URL） |
