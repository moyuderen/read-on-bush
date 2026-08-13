# 自动隐蔽 & 书签系统 — PRD 与实现方案

> 状态：PRD 初稿，待评审。
> 涉及版本：`3.0.0`
> 功能范围：① 失焦自动隐蔽 ② 书签 / 多位置标记

---

## 1. 背景与目标

Read On Bush 的核心定位是「在 IDE 里低调摸鱼看小说」。当前隐蔽能力已较完善（`q`/`d`
手动切换、隐私界面模式、双击 `q` 退出），但仍有一个**安全短板**和一个**体验缺口**：

| 问题 | 现状 | 风险 / 痛点 |
|------|------|------------|
| 窗口失焦 | Alt-Tab 切走后正文停留在 VS Code 窗口 | 切回来 / 截屏共享时暴露 |
| 单一进度 | 每本书只有一个 `process` 游标 | 精彩处没法标记、多本书来回跳转丢失位置 |

**本次目标**：

1. **失焦自动隐蔽**：VS Code 窗口失去焦点时，正文瞬间替换为伪装占位，重获焦点后保持隐蔽、手动恢复。
2. **书签系统**：每本书可保存多个位置标记，阅读中按 `b` 打开书签面板（新增 / 跳转 / 删除），跨会话持久化。

两者均为「加法式」改动——不破坏现有流程，默认行为可配置，老数据兼容。

---

## 2. 功能一：失焦自动隐蔽

### 2.1 用户故事

> 我正在终端伪装里看小说，领导突然走过来。我还没来得及按 `q`，但因为我本能地
> Alt-Tab 切到了别的窗口（或 VS Code 失焦），正文已经瞬间消失，换成了一行构建日志。
> 等领导走后，我回到 VS Code，按 `d` 继续看。

### 2.2 行为定义

| 触发条件 | 动作 |
|---------|------|
| VS Code 窗口失去焦点 (`focused === false`) | 当前伪装显示**强制切到 `debugTemplate` 占位内容**；若已是占位则不重复触发 |
| 窗口重新获得焦点 | **保持隐蔽状态**（不自动恢复正文），用户需手动按 `d` 恢复 |
| 失焦时未在阅读 / 已在占位模式 | 无动作（幂等） |
| 失焦时图片预览窗口打开 | 同步关闭图片预览（与现有 `d`/隐私切换行为一致） |

**设计要点**：
- 「重获焦点不自动恢复」是刻意设计——避免用户切回 VS Code 瞬间正文闪现被看到。
- 与手动 `q` / `d` 完全复用同一套隐蔽机制，不引入新渲染路径。

### 2.3 配置项

| 配置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `autoConcealOnFocusLoss` | boolean | `true` | 窗口失焦时是否自动隐蔽伪装阅读内容 |

默认开启——这是「安全优先」的选择；资深用户可关闭。

---

## 3. 功能二：书签系统

### 3.1 用户故事

> 这段写得太好了，我想标记一下以后重读。另外我同时在追两本书，切换时希望每本书
> 都能记住我上次「额外标记」的位置，而不只是单一的阅读进度。

### 3.2 数据模型

```ts
// 新增类型（src/domain/books/Bookmark.ts）
export type Bookmark = {
  id: string;
  label: string;        // 用户可编辑的标签，默认截取当前正文片段
  location: BookNavigationTarget;  // 复用现有导航目标，三种格式通用
  createdAt: number;
};
```

`BookNavigationTarget` 已天然支持三种格式：
- TXT → `{ kind: 'page', pageIndex }`（`getCurrentLocation()` 已实现于 `TxtReadingController.ts:119`）
- EPUB → `{ kind: 'section', sectionIndex, offset }`（`PaginatedReaderBase.getCurrentSectionLocation()`）
- PDF → `{ kind: 'section', sectionIndex, offset }`（页即 section）

**BookData 扩展**（加法式字段）：

```ts
// src/domain/books/BookData.ts
export type BookData = {
  // ...现有字段...
  bookmarks?: Bookmark[];   // 新增，可选
};
```

### 3.3 交互设计

阅读中（终端伪装内）按 `b` 打开书签 QuickPick：

```
+-- QuickPick: 书签 ------------------------------+
|                                                 |
|  📑 输入标签名新增书签，或选择已有书签跳转      |
|                                                 |
|  🔖 龙族崛起 [第 3 章]              2 分钟前    |
|  🔖 秘境入口 [第 5 章]              昨天        |
|                                                 |
|  $(add) 新建书签：当前位置                        |
|  $(trash) 删除模式…                              |
|                                                 |
|  [Enter 跳转]  [Esc 取消]                       |
+-------------------------------------------------+
```

| 操作 | 入口 | 行为 |
|------|------|------|
| 新建书签 | QuickPick 顶部输入框（输入非空 → Enter） | 用当前 `getCurrentLocation()` + 输入文本创建，持久化 |
| 跳转书签 | 选中已有书签 → Enter | `jumpTo(location)`，搜索返回栈同源（可 `searchBack` 返回） |
| 删除书签 | QuickPick 内「删除模式」或逐项右键 | 从 `bookmarks` 移除并持久化 |
| 自动标签 | 新建时输入框预填当前正文前 N 字 | 用户可改，回车即存 |

**隐蔽性约束**：
- 隐私模式下，书签 QuickPick 的标签与章节上下文**自动脱敏**（复用 `PrivacyService`）。
- 占位模式（`debugTemplate`）下按 `b` **不打开**书签面板（与 `i`/`f` 在占位模式的行为一致）。

### 3.4 命令

| 命令 ID | 触发 | 说明 |
|---------|------|------|
| `readOnBush.bookmark.open` | 终端内 `b` 键 / 命令面板 | 打开当前书的书签 QuickPick |

不新增配置项——书签是纯增量功能，无开关需求。

---

## 4. 架构集成分析

### 4.1 现有隐蔽机制（复用基础）

隐蔽状态机集中在 `CamouflageConcealController`（`presentation/readerControls/ConcealController.ts`）：

```
CamouflageConcealController
  ├─ contentMode: 'real' | 'debugTemplate'
  ├─ toggleDebugContent()  ← d 键
  ├─ showDebugContent()    ← q 键（私有）
  ├─ handleQuitKey()       ← q q 退出
  └─ reset()               ← 关闭时恢复 real
```

两个伪装显示均继承 `CamouflageDisplayBase`，持有 `concealController`：
- `TxtCamouflageDisplay`（TXT 伪装终端，由 `ReaderDisplayManager` 管理）
- `PaginatedReaderDisplay`（EPUB/PDF 伪装终端，由 `PaginatedReaderBase` 持有）

**结论**：隐蔽的「执行」已在 presentation 层封装好。本次只需新增「触发源」（窗口失焦）和「入口方法」。

### 4.2 失焦的集成路径

**核心问题**：触发源在 application 层（监听 `window.onDidChangeWindowState`），而隐蔽执行在 presentation 层的 display 实例中。且两种 display 创建位置不同。

**方案：新增 `AutoConcealService`（application 层）作为中央协调器**

```
AutoConcealService (application/AutoConcealService.ts)
  ├─ 订阅 window.onDidChangeWindowState  → 失焦时 concealActive()
  └─ concealActive()                      → 调用当前活跃 display 的 conceal()
```

`concealActive()` 的双路径（同一时刻最多一个活跃）：

```
concealActive():
  ├─ app.displayManager.concealActive()     // TXT 伪装（若活跃且 real 模式）
  └─ app.readingSession.current?.conceal?.() // EPUB/PDF 伪装（若活跃且 real 模式）
```

**需要暴露的新方法**（均为 public，薄封装）：

| 位置 | 新方法 | 说明 |
|------|--------|------|
| `CamouflageConcealController` | `conceal(): boolean` | 强制切 debugTemplate（若已是则返回 false，不重复触发） |
| `CamouflageDisplayBase` | `conceal(): void` | 调用 `concealController.conceal()`，false 时不重复 render |
| `BookReaderController` | `conceal?(): void` | 接口新增可选方法 |
| `PaginatedReaderBase` | `conceal()` | `this.terminal.conceal()` |
| `TxtReadingController` | `conceal()` | 通过 `ReaderServices` 新增端口方法触达 TXT display |
| `ReaderDisplayManager` | `concealActive()` | 若 TXT 伪装 display opened 且 real，调用其 `conceal()` |

### 4.3 书签的集成路径

**持久化**：复用 `GlobalStateBookStore` + 防抖写入（与进度写入同一套机制）。

```
新增 BookStore.updateBookmarks(id, bookmarks)
  └─ BookCatalog.updateBookmarks(id, bookmarks)   // 走 scheduleProgressWrite 防抖
```

**读取 / 跳转**：三种 reader 已实现 `getCurrentLocation()` 和 `jumpTo()`，直接复用。

**UI**：新增 `BookmarkService`（application 层），参照 `SearchService` 的 QuickPick 模式：

```
BookmarkService (application/BookmarkService.ts)
  ├─ openQuickPick(bookId)    // 弹 QuickPick（新增/跳转/删除）
  ├─ addBookmark(bookId, label?)
  ├─ removeBookmark(bookId, bookmarkId)
  └─ jumpToBookmark(bookId, bookmarkId)  // 调 readingSession.jumpTo()
```

**`b` 键接入**：`CAMOUFLAGE_INPUT_KEYS` 增加 `'b'`，`handleCamouflageKey` 增加 `bookmark` 分支。
两种 display 的 `getInputHandlers()` 增加 `bookmark` 映射到 `executeRealContentCommand(Commands.BookmarkOpen)`。

---

## 5. 数据与配置变更汇总

### 5.1 新增配置项（package.json `contributes.configuration`）

| 配置 key | 类型 | 默认 | 所属功能 |
|----------|------|------|---------|
| `readOnBush.autoConcealOnFocusLoss` | boolean | `true` | 失焦隐蔽 |

### 5.2 新增命令（package.json `contributes.commands`）

| 命令 | 标题 |
|------|------|
| `readOnBush.bookmark.open` | 书签管理 |

### 5.3 新增按键

| 按键 | 上下文 | 功能 |
|------|--------|------|
| `b` | 终端伪装内（real 模式） | 打开书签 QuickPick |

`CAMOUFLAGE_INPUT_KEYS` 由 `['n','p','j','i','d','f','a','q']` 扩展为追加 `'b'`。

### 5.4 数据模型字段

| 文件 | 变更 |
|------|------|
| `domain/books/BookData.ts` | `BookData` 增加 `bookmarks?: Bookmark[]` |
| `domain/books/Bookmark.ts` | **新文件**，定义 `Bookmark` 类型 |

### 5.5 向后兼容

- `bookmarks` 为可选字段；旧数据（无此字段）解析时按 `[]` 处理。
- 新配置项有默认值；不修改配置的用户行为不变（失焦隐蔽默认开，但仅在有伪装终端活跃时生效）。
- `conceal()` / `bookmark` 均为接口可选方法，不影响已有实现。

---

## 6. 任务拆分与实现步骤

按「先隐蔽（安全优先）、后书签（体验增强）」的顺序，分 3 个阶段。每个阶段产出可独立验证。

### 阶段 0：基础设施（共用）

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 0.1 | ConcealController 增加 `conceal()` | `presentation/readerControls/ConcealController.ts` | 公开方法，强制切 debugTemplate；已在 debug 时返回 false 不重复 render |
| 0.2 | DisplayBase 增加 `conceal()` | `presentation/reader/CamouflageDisplayBase.ts` | 薄封装调用 `concealController.conceal()` |
| 0.3 | 接口增加 `conceal?()` | `formats/BookFormat.ts` → `BookReaderController` | 可选方法 |
| 0.4 | 类型检查 + 单测 | `test/reader/concealController.test.ts` | 验证 `conceal()` 幂等性 |

**验证点**：`npm run typecheck` 通过；单测验证 conceal 不重复触发。

---

### 阶段 1：失焦自动隐蔽

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 新建 `AutoConcealService` | `application/AutoConcealService.ts` | 构造时订阅 `window.onDidChangeWindowState`；失焦 → `concealActive()` |
| 1.2 | 实现双路径 `concealActive()` | 同上 | `displayManager.concealActive()` + `readingSession.current?.conceal?.()` |
| 1.3 | DisplayManager 增加 `concealActive()` | `presentation/reader/ReaderDisplayManager.ts` | TXT 伪装 display opened 且 real 时调用 `camouflageDisplay.conceal()` |
| 1.4 | PaginatedReader 实现 `conceal()` | `formats/PaginatedReaderBase.ts` | `this.terminal.conceal()` |
| 1.5 | TxtReadingController 实现 `conceal()` | `formats/txt/TxtReadingController.ts` | 委托 `ReaderDisplayManager.concealActive()`（通过 services 注入或直接走 app） |
| 1.6 | ApplicationContext 注册服务 | `application/ApplicationContext.ts` | 实例化 `AutoConcealService`，push 到 subscriptions |
| 1.7 | 新增配置项 | `package.json` / `config/settings.ts` | `autoConcealOnFocusLoss`（默认 true）+ getter |
| 1.8 | 配置变更联动 | `application/ConfigurationCoordinator.ts` | 运行时改配置即时生效 |
| 1.9 | 失焦时关闭图片预览 | `AutoConcealService` / `PaginatedReaderBase` | conceal 后触发 `imagePreview.close()`（复用 onDidConcealContent 事件） |

**验证点**：
- 打开 EPUB/TXT 伪装终端 → 切到浏览器 → 切回 VS Code：正文已被占位替换，按 `d` 恢复。
- `autoConcealOnFocusLoss = false` 时失焦不隐蔽。
- 状态栏模式（非伪装终端）失焦无副作用。

---

### 阶段 2：书签系统

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.1 | 定义 `Bookmark` 类型 | `domain/books/Bookmark.ts`（新） | `{ id, label, location, createdAt }` |
| 2.2 | BookData 增加 `bookmarks` | `domain/books/BookData.ts` | 可选字段 |
| 2.3 | barrel 导出 | `domain/books/index.ts` | 导出 Bookmark |
| 2.4 | BookStore 增加 `updateBookmarks` | `infrastructure/storage/BookStore.ts` | 接口 + 实现，复用 `updateBook` 模式 |
| 2.5 | BookCatalog 增加书签写入 | `application/BookCatalog.ts` | `updateBookmarks(id, bookmarks)`，走防抖或直接写（书签低频，可直接写） |
| 2.6 | 新建 `BookmarkService` | `application/BookmarkService.ts`（新） | QuickPick UI + 增删跳，参照 `SearchService` 结构 |
| 2.7 | 注册命令 | `config/commands.ts` + `ApplicationContext` | `Commands.BookmarkOpen` |
| 2.8 | `b` 键接入 | `presentation/readerControls/CamouflageInput.ts` | `CAMOUFLAGE_INPUT_KEYS` 加 `'b'`；`handleCamouflageKey` 加 bookmark 分支 |
| 2.9 | display 接线 | `TxtCamouflageDisplay` / `PaginatedReaderDisplay` | `getInputHandlers()` 增加 `bookmark` 映射（real 模式才执行） |
| 2.10 | 隐私脱敏 | `application/BookmarkService` | 隐私模式下标签 / 章节上下文脱敏 |
| 2.11 | package.json | `package.json` | 注册命令声明 |

**验证点**：
- TXT/EPUB/PDF 三种格式均能新增、跳转、删除书签；重启 VS Code 后书签仍在。
- 跳转书签后按 `searchBack` 可返回书签面板打开前的位置。
- 隐私模式下书签标签不泄露书名 / 章节名。
- 占位模式按 `b` 无反应。

---

### 阶段 3：收尾

| # | 任务 | 说明 |
|---|------|------|
| 4.1 | README 更新 | 新增「自动隐蔽」「书签」章节、配置项、按键表 |
| 4.2 | CHANGELOG | 3.0.0 Added 条目 |
| 4.3 | 版本号 | `package.json` → `3.0.0` |
| 4.4 | 全量 `npm run rebuild && npm run lint && npm run test` | |

---

## 7. 风险与权衡

| 风险 | 影响 | 应对 |
|------|------|------|
| 失焦隐蔽误触（频繁切窗） | 频繁隐蔽打断阅读 | 幂等设计（已在占位则不重复）；隐蔽后只需按一下 `d` 恢复，成本低 |
| 书签 location 失效（书籍文件被替换） | 跳转位置偏移 | location 基于 chapterIndex/pageIndex（相对锚），比绝对 charOffset 稳健；极端情况下进度同样会偏，与现有进度一致，不额外处理 |
| `conceal()` 暴露为 public 破坏封装 | 低 | 仅薄封装已有私有 `showDebugContent()`，不引入新逻辑 |
| globalState 存储增长 | 书签数据量小（每条 < 200B） | 不做额外清理；删除书籍时书签随书籍一并删除（天然） |

---

## 8. 测试策略

| 层次 | 覆盖点 |
|------|--------|
| 单元（domain） | `ConcealController.conceal()` 幂等；`Bookmark` 类型；`BookStore.updateBookmarks` 读写 |
| 单元（application） | `AutoConcealService` 失焦触发 |
| 集成（vscode-test） | 三种格式书签的新增 / 跳转 / 删除 / 持久化；隐私模式脱敏 |
| 手动 | 失焦隐蔽（Alt-Tab）、占位模式下 `b` 无效 |

---

## 9. 不做的事（Out of Scope）

- **书签跨设备同步**：不引入 Gist / 云存储，书签随 globalState 本地保存。
- **书签导入导出**：暂不做文件级导出。
- **书签的拖拽排序**：QuickPick 不支持拖拽，用创建时间排序即可。
