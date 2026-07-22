# Change Log

All notable changes to the "readOnBush" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

暂无。

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