# Read On Bush

> 在 VS Code 中低调摸鱼看小说——把正文伪装成 Claude CLI、构建日志、服务日志等开发输出，旁人路过只会以为你在认真工作。

支持 **TXT / EPUB / PDF** 三种格式，内置书架管理、章节目录、进度跳转和快捷键翻页。

---

## 📋 目录

- [功能概览](#功能概览)
- [✨ 特色功能](#-特色功能)
  - [终端伪装：把小说藏进开发日志](#终端伪装把小说藏进开发日志)
  - [一键隐蔽：0.1 秒消除证据](#一键隐蔽01-秒消除证据)
  - [图片预览：插图随看随关](#图片预览插图随看随关)
  - [自定义伪装模板：打造专属风格](#自定义伪装模板打造专属风格)
- [📖 使用指南](#-使用指南)
- [快捷键](#快捷键)
- [配置项](#配置项)
- [命令列表](#命令列表)

---

## 功能概览

```
导入书籍 --> 书架管理 --> 选择书籍 --> 开始阅读
                                |
                                +-- 状态栏模式：正文显示在底部状态栏
                                +-- 终端伪装模式：正文混入伪装终端（推荐）
```

| 能力 | 说明 |
|------|------|
| 多格式 | TXT / EPUB / PDF 统一书架管理，导入时自动提取目录 |
| 双模式 | 状态栏阅读 + 终端伪装，通过状态栏图标一键切换 |
| 书架整理 | 分类、排序、按分类或目录分组，支持拖拽改分类 |
| 编码检测 | TXT 自动检测 BOM / UTF-16 端序 / GB18030，也支持手动指定 |

![Read On Bush 功能展示](https://cdn.jsdelivr.net/gh/moyuderen/read-on-bush@main/readme/example.png)

---

## ✨ 特色功能

### 终端伪装：把小说藏进开发日志

这是 Read On Bush 最核心的特色。小说正文被嵌入终端日志模板中，看起来就像你在正常开发：

```
+-- terminal: Claude Code -----------------------------------+
|                                                            |
|  > Planning...                                             |
|    Read src/features/orders/OrderList.tsx                  |
|    Read src/api/orders.ts                                  |
|                                                            |
|    第三章 龙族崛起                                         |
|    他缓缓睁开双眼，发现自己躺在一间陌生                    |
|    的石室之中，空气中弥漫着古老的气息。                    |
|                                                            |
|  Updated src/api/orders.ts                                 |
|     @@ -24,7 +24,12 @@                                     |
|     +  const params = new URLSearchParams(...)             |
|                                                            |
|  npm test -- 18 passed (2.4s)                              |
|  ------------------------------------                      |
|  [opus-4.8] [========------] 43% | $16.17 | 305m           |
+------------------------------------------------------------+
```

内置 6 种伪装风格，通过配置项 `terminalCamouflageStyle` 切换：

| 风格 | 伪装效果 |
|------|---------|
| `claudeCli`（默认） | Claude Code 命令行交互界面 |
| `buildLog` | Webpack / tsc 等构建工具的 Watch 输出 |
| `serverLog` | 后端服务运行时日志 |
| `vite` | Vite 开发服务器终端输出 |
| `docker` | Docker Compose 容器日志 |
| `custom` | 自定义 JSON 模板（见[自定义伪装模板](#自定义伪装模板打造专属风格)） |

终端伪装窗口内的键盘操作（TXT / EPUB / PDF 通用）：

| 按键 | 功能 |
|------|------|
| `→` 或 `n` | 下一行 / 下一页 |
| `←` 或 `p` | 上一行 / 上一页 |
| `j` | 跳转 |
| `d` | 切换真实内容 ↔ 模板占位（[无痕切换](#一键隐蔽01-秒消除证据)，按一下隐藏，再按一下继续看） |
| `q` | 快速切到模板占位（一键隐蔽） |
| `q q` | 停止阅读 |
| `i` | 查看 / 关闭当前页图片（仅 EPUB / PDF，见[图片预览](#图片预览插图随看随关)） |

### 一键隐蔽：0.1 秒消除证据

旁人靠近时，两个按键帮你瞬间隐蔽：

- **`q` — 一键隐蔽**：正文瞬间替换为伪装占位文案，看起来就像正常的 AI 编程输出
- **`d` — 无痕切换**：在真实内容和占位文案之间来回切换，按一下隐藏，再按一下继续阅读

以 Claude CLI 模式为例，按 `q` 的前后对比：

```
+-- 正常阅读 ------------------------------------------------+
|                                                            |
|  > Planning...                                             |
|                                                            |
|  第三章 龙族崛起                                           |
|  他缓缓睁开双眼，发现自己躺在一间陌生的                    |
|  石室之中，空气中弥漫着古老的气息。                        |
|                                                            |
|  Updated src/api/orders.ts                                 |
|  [opus-4.8] [========------] 43% | $16.17 | 305m           |
+------------------------------------------------------------+
         |
         |  按 q 或 d (0.1 秒切换)
         v
+-- 一键隐藏 ------------------------------------------------+
|                                                            |
|  > Planning...                                             |
|                                                            |
|  I'll keep the terminal rendering state local to           |
|  the pseudoterminal and reuse the shared renderer.         |
|     @@ -42,7 +42,11 @@ render(state)                       |
|     +  this.panel.webview.html = renderScreen(...)         |
|                                                            |
|  Updated src/api/orders.ts                                 |
|  [opus-4.8] [========------] 43% | $16.17 | 305m           |
+------------------------------------------------------------+
```

上下两段的 Header（任务规划）、Trailing（代码 diff）、底部进度条完全一致——只有中间正文被替换。再按 `d` 即可切回真实内容继续阅读。

### 图片预览：插图随看随关

阅读 EPUB 或 PDF 时，如果当前页包含图片，进度处会显示 `[图 i]` 标记。按 `i` 即可在独立窗口中查看插图：

```
+-- terminal: Claude Code -------------------+
|                                            |
|  第三章 龙族崛起 - 第 12 页 [图 i]         |
|  他缓缓睁开双眼，发现自己躺在一间陌生      |
|  的石室之中，石壁上刻满了古老的符文...     |
|  ------------------------------ 43%        |
+--------------------------------------------+
         |
         |  按 i
         v
+-- 图片预览窗口 ----------------------------+
|                                            |
|                                            |
|       [ 石壁符文插图 ]                     |
|                                            |
|                                            |
|    按任意键或点击即关闭                    |
|                                            |
+--------------------------------------------+
```

隐蔽设计细节：

- 图片窗口内**按任意键或点击**立即关闭——旁人靠近时无需找按键，随手一按就行
- 切换到模板占位模式（`q` 或 `d`）时，已打开的图片窗口会**自动关闭**
- 占位模式下按 `i` **不会打开真实图片**，不会暴露你在看什么
- PDF 图片为纯 JS 按需解码，无需额外原生依赖

### 自定义伪装模板：打造专属风格

如果 6 种内置风格都不够用，可以用可视化编辑器打造完全属于自己的伪装模板。

执行 **Read On Bush: 配置自定义终端模板** 打开 Webview 编辑器：

- **实时预览**：左侧编辑表单，右侧终端预览，带 Header / 正文 / Trailing / Done 区段标注
- **所见即所得**：修改任意字段，预览立即更新
- **一键启用**：点击「保存并启用」自动写入 `settings.json` 并切换到 `custom` 风格
- **安全颜色**：支持 `plain` / `dim` / `red` / `green` / `yellow` / `blue` / `magenta` / `cyan`

将 `terminalCamouflageStyle` 设为 `custom` 时也会自动打开编辑器。模板支持静态头尾日志、正文前缀、`{{progress}}` 进度占位符。不支持脚本、原始 ANSI 或动态底栏。

示例模板：

```json
{
  "version": 1,
  "terminalName": "dev server",
  "contentPrefix": "INFO  ",
  "header": [
    { "text": "npm run dev", "style": "blue" },
    "",
    { "text": "INFO  Server listening on http://localhost:3000", "style": "green" }
  ],
  "trailing": [
    "",
    { "text": "INFO  Background worker heartbeat ok", "style": "green" }
  ],
  "done": { "text": "INFO  request completed{{progress}}", "style": "green" },
  "debugContent": [
    { "text": "INFO  GET /api/workspaces 200 14ms", "style": "green" },
    { "text": "WARN  slow query detected duration=42ms", "style": "yellow" }
  ]
}
```

---

## 📖 使用指南

### 安装与导入

安装后点击活动栏的 Read On Bush 图标打开书架视图。点击 **Import** 选择单本文件，或点击 **Import Directory** 选择目录批量导入，导入后可点击 **Refresh** 刷新书架。

### 书架管理

书籍右键菜单：**Rename**（重命名）、**Set Category** / **Clear Category**（分类）、**Delete**（删除）。

书架标题栏：**Sort**（排序）、**Group By**（分组方式：不分组 / 按分类 / 按文件目录）、**New Category**（新建分类）、**Refresh**（刷新）。

**分类管理：**

- **设置分类**：右键书籍 → **Set Category**，弹出已有分类列表可直接选择（带数量标注、当前分类高亮），也可底部「创建新分类…」输入新名称或「清除分类」
- **拖拽改分类**：切换到「按分类分组」后，直接把书籍拖到目标分类文件夹或另一本书上即可改分类；拖到「未分类」或空白处则清除分类，支持多选拖拽
- **新建分类**：点击标题栏 **New Category**，输入名称后多选要加入的书籍
- **重命名分类**：右键分类文件夹 → 点击编辑图标重命名，自动更新该分类下所有书籍；若新名与已有分类重名则自动合并

### 状态栏阅读

选择 TXT 书籍后，正文片段显示在 VS Code 底部状态栏，点击翻页：

```
+-- VS Code 底部状态栏 --------------------------------------+
|                                                            |
|  第三章 龙族崛起 他缓缓睁开双眼... 43%  Reading  main*     |
|                                                            |
+------------------------------------------------------------+
```

通过状态栏的 **Reading / Coding** 按钮切换快捷键是否生效——打开 TXT 书籍时自动激活，关闭或切换到 EPUB/PDF 后自动释放，不影响编辑器原生行首/行尾导航。

### EPUB & PDF 阅读

EPUB 和 PDF 均通过专属终端伪装窗口阅读（与 TXT 伪装终端相互独立，不受 `displayTarget` 配置影响）。终端操作和图片预览复用上方[特色功能](#-特色功能)中的说明。

**通用流程：**

1. **Import** 导入 `.epub` / `.pdf`（或 **Import Directory** 批量导入），自动提取目录
2. 首次打开解析并缓存全书（按文件修改时间失效），之后秒开

**目录树与跳转：**

书架中的 EPUB / PDF 书籍可**展开**查看目录树，直接点击任意章节或页面跳转：

- **EPUB**：展开后显示章节目录（如「第一章 初入江湖」「第二章 龙族崛起」…），点击章节名跳转到对应位置
- **PDF**：展开后显示页面目录（如「第 1 页」「第 2 页」…），点击页码跳转到对应页面；也可以在终端中按 `j` 输入页码跳转

展开后的目录树支持滚动浏览，几百页的书也能快速定位到想看的位置。

**翻页衔接：**

EPUB 和 PDF 都支持跨章 / 跨页自动流入——当一页内容不够填满终端时，会自动从下一章 / 下一页继续拼接显示，翻页体验连贯。PDF 中的空白页和纯图片页会保留页码语义（不会被跳过），遇到时单独占一屏。

**格式差异：**

| | EPUB | PDF |
|---|------|-----|
| 目录单位 | 章节 | 页面 |
| 进度显示 | 第 N 章 · 全书 X% | 第 N 页 · 全书 X% |
| 图片 | 按章节内位置锚定 | 按页锚定，纯 JS 按需解码 |

### 格式转换引导

导入 `mobi` / `azw3` 时不会静默丢弃，而是弹窗提示并提供 **前往 CloudConvert** 按钮一键打开 [cloudconvert.com](https://cloudconvert.com)，转换完成后把生成的 `.epub` 重新导入即可。

---

## 快捷键

以下快捷键仅在 **阅读模式开启且正在阅读 TXT 书籍** 时生效（不影响 EPUB / PDF 终端内的按键操作）：

| 平台 | 上一行 | 下一行 |
|------|--------|--------|
| macOS | `Cmd+Left` | `Cmd+Right` |
| Windows / Linux | `Ctrl+Left` | `Ctrl+Right` |

终端伪装窗口内的完整键盘操作见[终端伪装](#终端伪装把小说藏进开发日志)章节。

## 配置项

在 VS Code 设置中搜索 `Read On Bush` 调整以下配置。

### 显示与伪装

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `displayTarget` | `statusBar` | 阅读内容显示位置：`statusBar`（状态栏）或 `terminalCamouflage`（终端伪装）。**推荐改为 `terminalCamouflage` 体验伪装阅读**，通过状态栏终端图标也能随时切换 |
| `terminalCamouflageStyle` | `claudeCli` | 伪装输出样式：`claudeCli` / `buildLog` / `serverLog` / `vite` / `docker` / `custom`。选择最适合你工作场景的风格 |
| `terminalCamouflageLineCount` | `3` | 终端伪装中一次展示的正文行数。设大一点（如 5-8）可以一次多看几行，但也会占用更多终端空间 |
| `terminalCamouflageLineWidth` | `0` | 终端伪装中每行正文的最大显示宽度。`0` 表示根据终端宽度自动计算，也可以手动指定固定值（如 `60`） |
| `showProgress` | `true` | 是否在状态栏 / 终端伪装中显示阅读进度百分比 |
| `showChapterTitle` | `true` | 是否在终端伪装的进度中显示当前章节名称（EPUB 显示章节名，PDF 显示页码） |

### 状态栏阅读

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `lineWidth` | `45` | 状态栏每个阅读片段的最大字符数。值越大状态栏显示的正文越长，但也会挤占状态栏空间 |
| `statusBarPrefix` | `""` | 状态栏内容前缀。可以设置一个不起眼的字符串（如 `| ` 或 `Ln `）让正文更隐蔽 |

### TXT 编码

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `txtEncoding` | `auto` | TXT 文件编码。`auto` 自动检测 BOM / UTF-16 端序 / GB18030。如果 Windows 中文 TXT 出现乱码，手动指定为 `gb18030` 即可解决 |

### 书架与快捷键

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `bookListGroupBy` | `none` | 书架分组方式：`none`（不分组）/ `category`（按分类）/ `directory`（按文件目录）。书多时按分类分组更整洁 |
| `defaultReadingMode` | `true` | 是否默认启用阅读快捷键。如果不想让快捷键自动激活，设为 `false` 改为手动开关 |
| `autoRefreshBookList` | `false` | 是否尝试自动刷新书架 |
| `terminalCamouflageCustomTemplate` | `null` | `custom` 样式的 JSON 模板，建议通过可视化编辑器生成，不建议手写 |

## 命令列表

| 命令 | 说明 |
| --- | --- |
| `readOnBush.prev` | 状态栏读书：上一行 |
| `readOnBush.next` | 状态栏读书：下一行 |
| `readOnBush.jump` | 状态栏读书：跳转 |
| `readOnBush.switchReadingMode` | 激活阅读快捷键 |
| `readOnBush.switchCodingMode` | 禁用阅读快捷键 |
| `readOnBush.openTerminalCamouflage` | 打开终端伪装 |
| `readOnBush.toggleTerminalCamouflage` | 切换终端伪装 |
| `readOnBush.openCustomTemplateEditor` | 配置自定义终端模板（可视化编辑器） |
| `readOnBush.import` | 导入单本书籍 |
| `readOnBush.importDirectory` | 按目录导入书籍 |
| `readOnBush.refreshBookList` | 刷新书架 |
| `readOnBush.sortBookList` | 排序书架 |
| `readOnBush.switchBookListGroupBy` | 切换书架分组方式 |
| `readOnBush.setBookCategory` | 设置书籍分类 |
| `readOnBush.clearBookCategory` | 清除书籍分类 |
| `readOnBush.createCategory` | 新建分类 |
| `readOnBush.renameCategory` | 重命名分类 |
| `readOnBush.openBookOutline` | 打开书籍章节目录 |
| `readOnBush.epub.next` | EPUB 读书：下一页 |
| `readOnBush.epub.prev` | EPUB 读书：上一页 |
| `readOnBush.epub.jumpChapter` | EPUB 读书：跳转章节 |
| `readOnBush.epub.viewImage` | EPUB 读书：查看图片 |
| `readOnBush.epub.stop` | EPUB 读书：停止 |
| `readOnBush.pdf.next` | PDF 读书：下一页 |
| `readOnBush.pdf.prev` | PDF 读书：上一页 |
| `readOnBush.pdf.jumpPage` | PDF 读书：跳转页面 |
| `readOnBush.pdf.viewImage` | PDF 读书：查看图片 |
| `readOnBush.pdf.stop` | PDF 读书：停止 |
