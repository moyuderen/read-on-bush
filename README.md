# Read On Bush

Read On Bush 是一个适合在 VS Code 中低调阅读 txt 小说的扩展。你可以把阅读内容展示在状态栏，也可以打开“终端伪装”窗口，把正文混入构建日志、Claude Code CLI 或服务日志风格的输出中；同时内置书架管理、目录批量导入、分类/目录分组、进度跳转和快捷键阅读模式。

> 当前支持 `.txt` 与 `.epub` 文件。

## 功能亮点

- **状态栏阅读**：在 VS Code 状态栏显示当前阅读片段，支持上一行、下一行、跳转和进度展示。
- **终端伪装阅读**：在终端样式的 Webview 中阅读，可选择构建日志、Claude Code CLI、后端服务日志等伪装风格。
- **多显示位置**：阅读内容可仅显示在状态栏、仅显示在终端伪装窗口，或两处同时显示。
- **书架管理**：支持导入单本 txt、按目录批量导入、刷新书架、删除、重命名、设置/清除分类。
- **书架整理**：支持排序，并可按无分组、分类、文件目录三种方式展示书架。
- **阅读体验配置**：可配置状态栏片段长度、终端正文宽度/行数、状态栏前缀、是否显示进度、默认是否启用阅读快捷键等。
- **快捷键模式切换**：通过 Reading / Coding 模式切换阅读快捷键，避免编码时和常用快捷键冲突。

## 1. 使用指南

### 1.1 安装 Read On Bush

安装成功后，活动栏会显示 Read On Bush 图标；进入书架视图后，可以从标题栏按钮导入书籍或刷新书架。

![Install](https://cdn.jsdelivr.net/gh/moyuderen/CDN@main/moyuderen/read-on-bush/install.png)

### 1.2 导入书籍

#### 导入 txt 文件

在书架视图点击 **Import**，选择一个或多个本地 `.txt` 文件后即可加入书架。

![Import book](https://cdn.jsdelivr.net/gh/moyuderen/CDN@main/moyuderen/read-on-bush/import-book.png)

#### 按目录批量导入

在书架视图点击 **Import Directory**，选择目录后会批量导入目录下的 txt 文件。导入后可以点击 **Refresh** 刷新书架。

![Refresh Book list](https://cdn.jsdelivr.net/gh/moyuderen/CDN@main/moyuderen/read-on-bush/refresh-booklist.jpg)

### 1.3 管理书架

在书架中的书籍上右键，可以进行：

- **Rename**：重命名书籍显示名称
- **Set Category**：设置分类
- **Clear Category**：清除分类
- **Delete**：从书架删除

书架标题栏还支持：

- **Sort**：排序书架
- **Group By**：切换分组方式，可选不分组、按分类分组、按文件目录分组
- **Refresh**：刷新书架

### 1.4 开始阅读

选择书架中的书籍后，阅读内容会按照配置展示在状态栏、终端伪装窗口或两处同时展示。

![How to read](https://cdn.jsdelivr.net/gh/moyuderen/CDN@main/moyuderen/read-on-bush/read.png)

常用操作：

- 点击状态栏阅读片段或执行命令 **状态栏读书：下一行** 翻到下一行
- 执行 **状态栏读书：上一行** 返回上一行
- 执行 **状态栏读书：跳转** 跳转到指定位置
- 使用 Reading / Coding 模式切换阅读快捷键是否生效

### 1.5 终端伪装阅读

执行命令 **Read On Bush: 打开终端伪装** 可以打开终端伪装窗口；执行 **Read On Bush: 切换终端伪装** 可以切换显示状态。

终端伪装支持三种输出风格：

- **buildLog**：构建 / Watch 日志样式
- **claudeCli**：Claude Code CLI 风格
- **serverLog**：后端服务日志样式

可以通过配置调整终端伪装中的正文行数和每行宽度；宽度设置为 `0` 时，会根据终端窗口宽度自动计算。

终端伪装窗口内也支持键盘操作和一键切换占位模板：

- 下一行：`Right` 或 `n`
- 上一行：`Left` 或 `p`
- 跳转：`j`
- 切换模板调试文案：`d`（真实内容 ↔ 当前模板调试内容）
- 快速切到模板占位：`q`
- 连续两次 `q q`：停止阅读

### 1.6 阅读 EPUB

除 txt 外，Read On Bush 也支持直接导入并阅读 `.epub`：

- 在书架视图点 **Import** 选择 `.epub`（或 **Import Directory** 批量导入），导入时会提取章节目录。
- 书架中的 epub 书可**展开**查看章节，点击章节即可跳转。
- 打开 epub 后会在专属的终端伪装窗口（默认名 `Claude Code`）中阅读，**与 txt 的伪装终端相互独立**，且不受 `displayTarget` 配置影响。
- 终端内按键：
  - 下一页：`Right` 或 `n`（跨章自动流入）
  - 上一页：`Left` 或 `p`
  - 跳转章节：`j`
  - 查看/关闭当前页图片：`i` 切换（仅当当前页含图片时，进度处会显示 `[图 i]` 标记）；图片窗口内**按任意键或点击**可一键关闭，便于旁有人时迅速隐蔽
  - 切换模板调试文案：`d`（真实内容 ↔ 模板占位）
  - 快速切到模板占位：`q`
  - 连续两次 `q q`：停止阅读
  - 模板占位下会自动关闭图片窗口，且 `i` 不会打开真实图片
- 进度按「第 N 章 · 全书 X%」展示；首次打开会解析并缓存全书（按文件修改时间失效），之后秒开。

## 2. 快捷键

快捷键只会在 `readOnBush.isReadingMode == true` 时生效。你可以通过状态栏的 Reading / Coding 模式按钮随时启用或禁用阅读快捷键。

### macOS

- 上一行：`Cmd+Left`
- 下一行：`Cmd+Right`

### Windows / Linux

- 上一行：`Ctrl+Left`
- 下一行：`Ctrl+Right`

## 3. 常用命令

| 命令 | 说明 |
| --- | --- |
| `readOnBush.prev` | 状态栏读书：上一行 |
| `readOnBush.next` | 状态栏读书：下一行 |
| `readOnBush.jump` | 状态栏读书：跳转 |
| `readOnBush.switchReadingMode` | 激活阅读快捷键 |
| `readOnBush.switchCodingMode` | 禁用阅读快捷键 |
| `readOnBush.openTerminalCamouflage` | 打开终端伪装 |
| `readOnBush.toggleTerminalCamouflage` | 切换终端伪装 |
| `readOnBush.import` | 导入单本书籍 |
| `readOnBush.importDirectory` | 按目录导入书籍 |
| `readOnBush.refreshBookList` | 刷新书架 |
| `readOnBush.sortBookList` | 排序书架 |
| `readOnBush.switchBookListGroupBy` | 切换书架分组方式 |

## 4. 配置项

可以在 VS Code 设置中搜索 `Read On Bush` 调整以下配置。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `readOnBush.lineWidth` | `45` | 状态栏每个阅读片段的最大字符数 |
| `readOnBush.defaultReadingMode` | `true` | 是否默认启用阅读快捷键 |
| `readOnBush.autoRefreshBookList` | `false` | 是否尝试自动刷新书架 |
| `readOnBush.statusBarPrefix` | `""` | 状态栏内容前缀 |
| `readOnBush.showProgress` | `true` | 是否显示阅读进度 |
| `readOnBush.displayTarget` | `statusBar` | 阅读内容显示位置：状态栏、终端伪装或两者同时显示 |
| `readOnBush.terminalCamouflageLineWidth` | `0` | 终端伪装中每行正文最大宽度，`0` 表示自动计算 |
| `readOnBush.terminalCamouflageLineCount` | `3` | 终端伪装中展示的正文行数 |
| `readOnBush.terminalCamouflageStyle` | `buildLog` | 终端伪装输出样式：`buildLog`、`claudeCli`、`serverLog` |
| `readOnBush.bookListGroupBy` | `none` | 书架分组方式：`none`、`category`、`directory` |

## 5. 阅读模式说明

Read On Bush 使用 Reading / Coding 两种模式控制快捷键：

- **Reading mode**：启用阅读快捷键，适合专注翻页阅读。
- **Coding mode**：禁用阅读快捷键，避免和编码时的快捷键冲突。

如果停止阅读，扩展会自动切换回 `Coding` 模式。
