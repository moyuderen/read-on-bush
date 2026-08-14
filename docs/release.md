# 发布流程

本文记录 Read On Bush VS Code 扩展的版本发布流程，覆盖：

- 更新版本号和变更日志
- 提交并推送 GitHub
- 创建并推送 Git tag
- 构建 VSIX 安装包
- 发布到 VS Code Marketplace

当前项目的发布对象：

- Marketplace Publisher：`moyuderen`
- Extension ID：`moyuderen.readOnBush`
- 主分支：`main`
- 远端：`origin`
- VSIX 文件名格式：`readOnBush-{version}.vsix`

## 一、发布前准备

### 1. 确认工作区干净

```bash
git status
```

发布前不应有未提交变更。如果有与本次发布无关的修改，先处理或暂存，避免混入发布提交。

### 2. 确认当前版本

```bash
node -p "require('./package.json').version"
node -p "require('./package-lock.json').version"
```

`package.json` 和 `package-lock.json` 的版本必须一致。

### 3. 确认 Git 推送方式

Git 提交和推送不依赖 `gh auth login`。只要 Git 远端配置的认证方式可用，就可以直接推送代码和 tag：

```bash
git remote -v
git push --dry-run origin main
```

常见情况：

- SSH 远端（例如 `git@github.com:...`）：使用本机 SSH key，不需要登录 GitHub CLI。
- HTTPS 远端：使用 Git Credential Manager、Personal Access Token 或其他已配置的凭据。

如果 dry-run 成功，后续可以直接执行 `git push origin main` 和 `git push origin v{version}`。如果推送失败，再根据错误信息配置 SSH key 或 HTTPS 凭据。

### 4. 确认 VS Code Marketplace 登录状态

验证当前 Publisher 的 PAT：

```bash
npx vsce verify-pat moyuderen
```

如果验证失败，重新登录：

```bash
npx vsce login moyuderen
```

输入 VS Code Marketplace 的 Personal Access Token。不要把 PAT 写入脚本、文档或 Git 仓库。

## 二、更新版本

假设本次发布版本为 `2.9.2`，先检查该版本是否已经存在：

```bash
git tag --list 'v2.9.2'
```

然后使用 npm 同步更新 `package.json` 和 `package-lock.json`：

```bash
VERSION=2.9.2
npm version "$VERSION" --no-git-tag-version
```

检查结果：

```bash
node -p "require('./package.json').version"
node -p "require('./package-lock.json').version"
```

如果 `npm version` 没有正确更新锁文件，应手动修正后再继续；不要让两个文件保持不同版本。

## 三、更新 CHANGELOG

在 `CHANGELOG.md` 的 `Unreleased` 下方增加新版本章节，日期使用实际发布日期：

```markdown
## [Unreleased]

## [2.9.2] - 2026-08-13

### Added

- 新增功能说明。

### Changed

- 变更说明。

### Fixed

- 修复说明。
```

只保留实际发生的变更，不要复制未发布内容。发布后可以将本版本的内容保留在对应版本章节，`Unreleased` 继续留空供下一版本使用。

## 四、发布前检查

### 1. 检查 JSON 和差异

```bash
python3 - <<'PY'
import json
for path in ('package.json', 'package-lock.json'):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    print(path, data.get('version'), data.get('packages', {}).get('', {}).get('version'))
PY

git diff --check
git diff --stat
```

确认差异中没有敏感信息，例如：

- `.env`
- PAT、Token、密码
- 私钥或凭据文件
- 本地绝对路径

### 2. 运行检查

```bash
npm run typecheck
npm run lint
```

可以运行完整测试：

```bash
npm test
```

`npm test` 会先编译并运行 lint；VS Code 集成测试可能需要下载对应版本的 VS Code。如果下载失败，应记录原因，不要误报为测试通过。

### 3. 构建 VSIX

```bash
npm run package
```

`package.json` 中的 `vscode:prepublish` 会自动执行 `npm run rebuild`，最终生成：

```text
readOnBush-2.9.2.vsix
```

检查安装包内容和大小：

```bash
npx vsce ls --tree
ls -lh readOnBush-2.9.2.vsix
```

`.vsix` 已被 `.gitignore` 忽略，不应直接提交到仓库；它只作为 Marketplace 发布包和本地安装验证使用。

## 五、提交发布变更

确认只包含本次发布相关文件后：

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `README.md`（本次版本包含用户可见功能、配置或命令变更时必须纳入）

如果本次没有用户可见变化，README 可以不修改；如果有用户可见变化，发布前必须同步更新功能说明、使用方式和配置项。

```bash
git status --short
git add package.json package-lock.json CHANGELOG.md README.md
git commit -m "$(cat <<'EOF'
chore(release): 发布 v2.9.2

更新扩展版本号与变更日志，准备发布新版本。

Co-Authored-By: moyuderen
EOF
)"
```

提交后检查：

```bash
git status
git log -1 --oneline
```

如果提交前发现工作区还有其他变更，不要使用 `git add -A` 或 `git add .`，应按文件名精确添加。

## 六、推送 GitHub 主分支和 Tag

先推送发布提交：

```bash
git push origin main
```

创建带注释的 tag 并推送：

```bash
VERSION=2.9.2
git tag -a "v$VERSION" -m "发布 v$VERSION"
git push origin "v$VERSION"
```

验证：

```bash
git status
git tag --list "v$VERSION"
git ls-remote --tags origin "refs/tags/v$VERSION"
```

如果 tag 已经推送，不要重复创建同名 tag；需要先确认是否应删除或修正远端 tag。已发布版本一般不建议复用或强制移动 tag。

## 七、发布到 VS Code Marketplace

Marketplace 发布只需要两步：先登录 Publisher，再直接发布当前版本。`vsce publish` 会读取 `package.json` 中的版本号，并自动执行打包，不需要手动指定 VSIX 文件。

### 第一次发布或凭据失效时登录

```bash
npx vsce login moyuderen
```

按提示输入 VS Code Marketplace 的 Personal Access Token。PAT 只保存在本机凭据存储中，不要写入脚本、文档或 Git 仓库。

### 发布当前版本

```bash
npx vsce publish
```

该命令会自动完成：

1. 执行 `vscode:prepublish`，重新编译项目。
2. 使用 `package.json` 的版本号构建 VSIX。
3. 将扩展发布到 `moyuderen.readOnBush`。

成功后会看到类似输出：

```text
Published moyuderen.readOnBush v2.9.2.
```

如果只想先构建、不发布，可以执行：

```bash
npm run package
```

Marketplace 页面：

<https://marketplace.visualstudio.com/items?itemName=moyuderen.readOnBush>

发布后可能需要几分钟才能在 Marketplace 页面显示最新版本。

## 八、发布后验证

```bash
git status
git log --oneline -3
git describe --tags --always
```

确认以下内容：

- 工作区干净。
- `main` 已推送到远端。
- `v{version}` tag 已存在且指向发布提交。
- Marketplace 页面显示新版本。
- `package.json`、`package-lock.json` 和 VSIX 版本一致。

建议在 VS Code 中通过以下方式验证安装包：

```bash
code --install-extension "readOnBush-$VERSION.vsix"
```

如果本机没有 `code` 命令，也可以在 VS Code 中使用“从 VSIX 安装…”完成验证。

## 九、常见问题

### Marketplace PAT 无效

验证：

```bash
npx vsce verify-pat moyuderen
```

重新登录：

```bash
npx vsce login moyuderen
```

PAT 只保存在本机凭据存储中，不要提交到项目。

### 版本号不一致

检查：

```bash
node -p "require('./package.json').version"
node -p "require('./package-lock.json').version"
```

如果不一致，重新执行：

```bash
npm version "$VERSION" --no-git-tag-version
```

### 发布包中出现不该包含的文件

先查看：

```bash
npx vsce ls --tree
```

再检查 `.vscodeignore` 和 `package.json` 的发布配置。不要直接修改生成的 VSIX；应修改源配置后重新执行 `npm run package`。

不要在没有确认的情况下删除已发布版本或移动远端 tag。
