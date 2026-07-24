# EPUB 阅读支持 — 设计文档

> 状态：已通过 `/grill-me` 设计拷问定稿，进入实现阶段。
> 分支：`feat/epub-support`

## 1. 背景与目标

Read On Bush 当前**仅支持 `.txt`**：解析器注册表 `parserFactories` 只登记了 `.txt`
（`src/core/parsers/index.ts`），下游阅读链路（`Book` / 状态栏 / 终端伪装）建立在
**扁平 `string[]` + 整数游标 `process`** 的模型上。

目标：**新增直接阅读 `.epub` 的能力**，提供 epub 原生体验（章节目录、跳章），同时保持
扩展"低调伪装阅读"的核心定位。

### 1.1 关键约束

- EPUB 本质是 **zip 压缩包**，内含按 OPF spine 顺序排列的 XHTML 章节、图片、CSS 与清单文件，
  无法像 txt 那样按行流式读取。
- epub 是**结构化、分章节**的；txt 的扁平数组模型不适用。
- 扩展的**全部存在理由是"伪装"**——在 IDE 里偷看小说。epub 原生形态（封面 / 图片 / 排版）
  与伪装正面对撞，必须在"原生程度"与"隐蔽程度"之间做取舍。

## 2. 现状与扩展点分析

项目已经为新增格式留好了较干净的扩展点（git log 中 `refactor(parser): 抽象书籍解析器`）：

- `parsers/index.ts`：按扩展名注册的工厂表 `parserFactories`，派生出 `supportedBookExtensions`。
- `BookList`：导入对话框过滤、目录扫描、去重**全部自动跟随** `supportedBookExtensions`。
- 显示层：`ReadingDisplayState = { content, contents, process, total, ... }`，与文件格式无关。
- 伪装终端 `TerminalCamouflageDisplay`（`display/terminalCamouflageDisplay.ts`，440 行）是一个
  **真正的 `Pseudoterminal`**（`window.createTerminal({ name: 'npm: watch', pty: this })`），
  通过写 ANSI 字符串伪装成 `npm run watch` 等日志输出。

但 epub 的结构化特性与现有扁平模型存在落差，因此**不能简单复用 txt 链路**，需要分叉。

## 3. 设计决策汇总

| 决策点 | 结论 | 关键理由 |
|---|---|---|
| 内容模型 | **epub 走自己的逻辑**，不复用 `string[]` + 整数 `process` | epub 是分章 XHTML，扁平数组丢失结构 |
| 阅读范围 | epub 原生体验：章节目录、跳章；**图片按需查看** | 默认无图保隐蔽，图片为显式动作 |
| 书架 | **共享**（txt + epub 同一书架），`BookData` 加 `format` 判别 | 避免两套书架，复用存储/导入/去重 |
| 目录位置 | **目录 → 书架树**（章节作为 epub 书的子节点，点击跳章） | 复用现有 TreeView，无需新面板 |
| 正文位置 | **正文 → epub 自己的伪装终端**，不进状态栏 | 终端伪装是本扩展的隐蔽核心 |
| epub 显示策略 | **epub 永远走自己的终端，无视全局 `displayTarget`** | 呼应"只支持伪装终端"的产品定位 |
| 图片 | **按需查看 (b)**：默认无图，当前内容附近有图时露入口，点击弹 Webview 看 | 平衡原生需求与隐蔽性 |
| 显示层复用边界 | **折中**：共享"视觉原语"（日志模板 / 折行 / ANSI 拼屏）；**分页与进度 epub 自有** | 视觉长相相同→共享；分页/进度形态不同→分叉 |
| 进度模型 | **`{ chapterIndex, charOffset }`**，char 偏移、章锚定；全书百分比派生 | char 偏移不随显示配置漂；章锚定支持目录跳转 |
| 章节边界 | **自动流入下一章** | 与进度模型配套，全书% 平滑爬到 100% |
| 缓存 | 缓存提取后纯文本，按文件 **mtime 失效**；`charOffset→文本`、全书字符从缓存读 | 大书反复解压提取会卡 |

### 3.1 默认采纳的实现细节

- **缓存位置**：`context.globalStorageUri/cache/<bookId>.json`（扩展自有目录）。不放在
  `workspaceState`（换工作区即丢），不放在 epub 旁边（污染用户目录 / 可能只读）。
- **提取时机**：导入时只提**章节标题**（解析 OPF/nav，便宜，支持目录批量导入不卡）；
  正文与缓存**懒加载**到首次打开该书时，一次性提取全书章节写缓存（自动流入需相邻章节都在）。
- **HTML→文本保真**：段落感知（段落不粘）、去标签去 CSS、标题当普通文本、脚注/诗歌丢格式；
  图片引用从默认流剥离但**保留位置锚点**供"看图入口"使用。
- **依赖**：`fflate`（纯 JS 解 zip）+ `fast-xml-parser`（解析 OPF / NCX / nav / XHTML），
  不引重型 epub 库；纯 JS、无 native、随 vsix 打包。
- **看图入口**：终端内当前内容附近有图时出可点击标记，点开弹临时 Webview 显单张图，不做画廊。
- **epub 终端名**：另起一个假日志名（如 `node: server`），区别于 txt 的 `npm: watch`。

## 4. 总体架构

### 4.1 共享 vs 分叉边界

```
共享（txt + epub 都用）                分叉（epub 自有）
─────────────────────────             ─────────────────────────
书架树（+ epub 章节子节点）             解析：EpubExtractor（zip+OPF+XHTML）
BookStorage（BookData 元数据）          内容模型：Chapter[] + 进度 {chapterIndex,charOffset}
导入 / isSupportedBookPath / 去重       分页逻辑（按章节，自动流入）
camouflageRender（视觉原语）            EpubBook（阅读模型）
  · getTemplate（日志模板）             EpubTerminalDisplay（自己的 Pseudoterminal）
  · splitContent（折行）                  · 自己的终端实例 / 生命周期
  · formatCamouflageScreen                · 自己的 handleInput（n/p/j/q→epub 命令）
    (style, lines, progressLabel)         · 看图入口标记
                                        进度计算 + 进度文案（第N章 · 全书X%）
```

### 4.2 渲染流水线

```
书架树(目录/章节) ──点某章──▶ EpubBook 设(当前章, charOffset)
                                   │ 取当前章节文本 + 计算本屏要显示的若干行
                                   │ 拼进度文案 "第3章 · 全书18%"
                                   ▼
                          EpubTerminalDisplay(epub 自己的终端壳/按键/控件)
                                   │ 调用
                                   ▼
                       camouflageRender.formatCamouflageScreen()  ← 共享视觉原语
                                   │
                                   ▼
                              画出一屏假日志
```

> **关键边界**：视觉长相只有一份（`getTemplate` 的日志模板），改样式只改一处；但分页与进度
> 各算各的，epub 不被迫假装自己是扁平数组。

## 5. 数据模型

### 5.1 `BookData`（`src/core/Book.ts`）扩展

加法式扩展，**不动 txt 现有字段**：

```ts
export type BookFormat = 'txt' | 'epub';

export type EpubProgress = {
  chapterIndex: number; // 第几章（0 起）
  charOffset: number;   // 章内字符偏移（绑定源文本，不随显示配置漂）
};

export type ChapterRef = {
  title: string;
};

export type BookData = {
  // ...现有字段保持不变
  id: string;
  name: string;
  process: number;            // txt 用（扁平游标），epub 不用
  url: string;
  children?: BookData[];      // 原有空置，保留
  category?: string;
  createdAt?: number;
  order?: number;
  // —— 新增 ——
  format?: BookFormat;        // 缺省视为 'txt'
  epubProgress?: EpubProgress; // 仅 epub
  chapters?: ChapterRef[];    // 仅 epub：导入时提取的章节标题，供书架树展示
};
```

### 5.2 提取产物（`EpubExtractor`）

```ts
export type EpubImage = {
  zipPath: string;     // epub 包内路径，供看图时直接取字节
  mediaType: string;
  charOffset: number;  // 该图在所属章节文本中的字符锚点
};

export type EpubChapter = {
  index: number;
  title: string;
  text: string;        // 段落感知的纯文本
  images: EpubImage[]; // 章内图片引用（带锚点）
};

export type EpubExtraction = {
  bookTitle: string;
  chapters: EpubChapter[];
};
```

### 5.3 缓存记录（`EpubCache`）

```ts
export type EpubCacheRecord = {
  bookId: string;
  fileMtime: number;     // 源文件 mtime，用于失效判定
  extractedAt: number;
  extraction: EpubExtraction;
};
```

存储于 `context.globalStorageUri/cache/<bookId>.json`，经 `vscode.workspace.fs` 读写。

## 6. 进度模型详解

- **真相来源**：`{ chapterIndex, charOffset }`。`charOffset` 是**字符**偏移而非行偏移——
  行偏移会随 `lineWidth` / 提取算法变化而漂，字符偏移绑定源文本，稳定。
- **全书百分比**（派生，不持久化）：
  `bookPercent = (已读整章字符累计 + 当前章 charOffset) / totalChars`。
  `totalChars` 与各章字符数由 `chapter.text.length` 派生，不额外持久化。
- **自动流入**：`charOffset` 到达当前章文本长度时，推进 `chapterIndex++`、`charOffset = 0`，
  全书% 连续走到 100%。
- **持久化**：存入 `BookData.epubProgress`，与 txt 的 `process` 互不干扰。
- **显示文案**：epub 自拼 `"第3章 · 全书18%"`，作为 `progressLabel` 喂给共享的
  `formatCamouflageScreen`（不复用 txt 的 `${current}/${total}`）。

## 7. 关键流程

### 7.1 导入
1. `BookList.addBook/addBookDirectory` 选择 `.epub`（`supportedBookExtensions` 已含 epub）。
2. 按 `format = getBookFormat(url)` 创建 `BookData`，`epubProgress = { chapterIndex: 0, charOffset: 0 }`。
3. **导入时仅提取章节标题**写入 `chapters`（解析 OPF/nav，不解正文），避免批量导入卡顿。

### 7.2 打开
1. `BookList.openOnBook` 按 `format` 分派：txt → `Book`，epub → `EpubBook`。
2. `EpubBook.init`：stat 源文件 mtime → `EpubCache.get(bookId, mtime)`；未命中或失效则
   `EpubExtractor.extract(url)` 全量提取并 `EpubCache.set`。
3. 恢复 `epubProgress`，渲染当前页。

### 7.3 翻页 / 自动流入
- 下一页：从当前 `charOffset` 起，取足够填满 `lineCount` 行的文本（用共享 `splitContent` 折行）；
  跨章节边界时自动推进到下一章（需相邻章节文本，故首次打开全量提取）。
- 上一页：对称回退，可跨章回退到上一章末尾。

### 7.4 跳章
书架树点击章节 → `EpubBook.jumpToChapter(index)` → `{ chapterIndex: index, charOffset: 0 }` → 渲染。

### 7.5 看图
当前页文本区间内若有 `EpubImage` 锚点 → 终端出可点击标记 → 点击弹临时 Webview 显示该图
（从缓存/epub 解出 bytes → base64）→ 关闭即销毁。

### 7.6 配置变更
epub 无视全局 `displayTarget`；但 `terminalCamouflageLineWidth / lineCount / style` 对 epub 终端
**仍然生效**（这些是视觉/分页参数，非显示位置）。

## 8. 文件改动清单

### 新增
| 文件 | 职责 |
|---|---|
| `src/core/parsers/EpubExtractor.ts` | `fflate` 解 zip + OPF spine + XHTML→文本 → `EpubExtraction` |
| `src/core/EpubBook.ts` | epub 阅读模型：`Chapter[]`、进度、自动流入分页、`viewImage` |
| `src/core/display/camouflageRender.ts` | 抽出的纯视觉原语（`getTemplate`/`splitContent`/宽度/`formatCamouflageScreen`） |
| `src/core/display/epubTerminalDisplay.ts` | `EpubTerminalDisplay implements Pseudoterminal`：自有终端/生命周期/`handleInput`/看图标记 |
| `src/core/storage/EpubCache.ts` | globalStorage sidecar 缓存 + mtime 失效 |

### 修改
| 文件 | 改动 |
|---|---|
| `src/core/Book.ts` | `BookData` 加 `format` / `epubProgress` / `chapters` 与对应类型 |
| `src/core/parsers/index.ts` | 拆分"支持扩展名"（txt∪epub）与 txt 专用 `createBookParser`；导出 `getBookFormat` |
| `src/core/display/terminalCamouflageDisplay.ts` | 纯函数移入 `camouflageRender.ts`；`formatTerminalCamouflageScreen` 瘦身为薄壳（txt 行为不变） |
| `src/core/BookList.ts` | `openOnBook` 按 `format` 分派；导入按扩展名设 `format`、提章节标题 |
| `src/core/BookTree.ts` | epub 书可展开 + 章节子节点（`BookTreeChapterItem`），点击跳章 |
| `src/core/Commands.ts` | 新增 epub 命令枚举（`openChapter`、上/下一页、上/下一章、看图、停止） |
| `package.json` | 注册 epub 命令/keybindings；`dependencies` 加 `fflate`、`fast-xml-parser` |

## 9. 实现阶段

1. **数据层**：`BookData` 扩展 + 解析器注册表拆分 + `EpubExtractor` + `EpubCache`。（可 `tsc` 验证）
2. **阅读模型**：`EpubBook` + 进度模型 + 自动流入分页。
3. **视觉层重构**：`camouflageRender.ts` + `formatCamouflageScreen`，确认 txt 不回归。
4. **epub 终端**：`EpubTerminalDisplay`（自有终端，调共享视觉）。
5. **书架目录**：树展开 + 章节子节点 + 跳章。
6. **看图**：入口标记 + 临时 Webview。
7. **收尾**：终端名、命令/快捷键、异常（损坏 / DRM 加密 / 空章节 / 非法 XHTML）。

## 10. 依赖

| 包 | 用途 | 备注 |
|---|---|---|
| `fflate` | 解 zip（epub 容器） | 纯 JS，~8KB |
| `fast-xml-parser` | 解析 container.xml / OPF / NCX / nav / XHTML | 纯 JS，实体解码，一个解析器通吃 |

约束：纯 JS、无 native 模块；项目无 bundler（纯 `tsc`），依赖随 `node_modules` 打入 vsix
（`.vscodeignore` 未排除 `node_modules`，与现有 `linebyline` 一致）。

## 11. 风险与边界情况

- **DRM / 加密 epub**：`META-INF/encryption.xml` 或解压失败 → 友好报错，不支持解密。
- **非法 / 非 well-formed XHTML**：`fast-xml-parser` 尽量容错；解析失败的章节降级为
  "本章无法解析"占位，不中断全书。
- **无 TOC 的 epub**：回退用章节首标题或 `"第 N 章"`。
- **超大书**：全量提取 + 缓存写在首次打开（一次性），后续打开走缓存；缓存按 mtime 失效。
- **进度漂移**：源文件 mtime 变更触发缓存重建，`charOffset` 可能在新文本中略有偏移，
  但 `chapterIndex` 仍指向正确章节（与 txt 现有隐患同级，可接受）。
- **txt 回归**：视觉层重构后必须保证 txt 阅读行为零变化（阶段 3 验证）。

## 12. 决策溯源（拷问关键转折）

- **为什么不"摊平成 string[]"**：会丢失章节结构，无法支持目录/跳章，且 epub 原生体验无从谈起。
- **为什么图片按需而非内联**：内联图片 = 明晃晃的阅读器，毁掉伪装前提；按需查看保默认隐蔽。
- **为什么进度用 char 偏移而非行偏移/全局字符数**：行偏移随配置漂；全局字符数丢章节锚点、
  目录跳转难做；`{chapterIndex, charOffset}` 兼顾稳定、锚定与全书% 计算。
- **为什么视觉层共享而分页/进度分叉**：视觉长相（日志伪装）txt 与 epub 完全一致→共享；
  分页与进度的**语义**形态不同→各算各的，避免 epub 被迫套用扁平数组模型。
