# GitHub to Forgejo Mirror

一个基于 Chrome Manifest V3 的浏览器扩展，用于在 GitHub 仓库页面一键镜像到 Forgejo。

- 在 GitHub 的仓库页面右上角注入按钮：`Mirror to Forgejo`
- 支持配置多个 Forgejo 连接并切换“活动”配置
- 支持镜像选项：Wiki、Labels、Issues、PRs、Releases、私有仓库、镜像间隔等
- 可选保持 GitHub 组织结构（自动在 Forgejo 创建同名组织）

## 安装

1. 打开 Chrome/Chromium 系浏览器，进入 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”，选择本项目根目录
4. 安装完成后，工具栏会出现扩展图标

## 使用

1. 先进入扩展的设置页填写 Forgejo 连接信息：
   - 在浏览器工具栏点击扩展图标，弹窗中点击“Open Settings”（或在扩展详情中点击“扩展选项”）
   - 在 `Options` 页中创建或编辑配置，至少需要：
     - Forgejo Server URL（如 `https://forgejo.example.com`）
     - Forgejo API Token（需要具备 `repo` 权限）
     - Username（你的 Forgejo 用户名）
     - 可选：GitHub API Token（用于访问私有仓库）
   - 可配置项：是否镜像、镜像间隔（小时）、是否包含 Wiki/Labels/Issues/PRs/Releases、是否私有、是否沿用组织结构
   - 支持多个配置，勾选某个配置为 `Active` 即为当前使用的配置
   - 可点击 `Test Connection` 测试 Forgejo 连接

2. 打开任意 GitHub 仓库页面（例如 `https://github.com/<owner>/<repo>`）
   - 页面右上角会出现 `Mirror to Forgejo` 按钮
   - 点击按钮后，扩展会调用 Forgejo 的迁移 API 创建镜像仓库
   - 成功/失败会在页面右下角弹出通知

## 权限说明

- `activeTab`：用于在 GitHub 仓库页注入按钮
- `storage`：用于保存扩展配置（包含多个配置组与当前激活配置）
- `host_permissions`：
  - `https://github.com/*`：匹配 GitHub 仓库页
  - `<all_urls>`：用于向 Forgejo 服务器发起请求（基于你在选项页中填写的 URL）

## 目录结构

```
./
├─ icons/                扩展图标
├─ background.js         Service Worker（安装/卸载等事件）
├─ content.js            内容脚本，在 GitHub 仓库页注入按钮并处理镜像逻辑
├─ manifest.json         扩展清单（Manifest V3）
├─ options.html          扩展设置页 UI
├─ options.js            设置页脚本，支持多配置组、测试连接与持久化存储
├─ popup.html            工具栏弹窗 UI（显示连接状态、切换活动配置、跳转设置页）
├─ popup.js              弹窗脚本
├─ styles.css            内容脚本注入的样式（按钮、通知等）
└─ README.md             项目说明文档（本文件）
```

## 核心工作流

- 内容脚本 `content.js`
  - 仅在仓库相关路径匹配时初始化（`/:owner/:repo`、`/tree/:branch`、`/blob/:branch`、`/commits/:branch`）
  - 从 `chrome.storage.sync` 读取当前 `activeConfig` 与其配置项
  - 创建并挂载 `Mirror to Forgejo` 按钮，点击后：
    - 如勾选“沿用组织结构”，会先尝试通过 Forgejo API 创建同名组织（若已存在返回 422 则视为成功）
    - 调用 Forgejo 迁移 API：`POST /api/v1/repos/migrate`，设置镜像选项
    - 根据返回结果在页面显示成功/失败通知

- 选项页 `options.html` / `options.js`
  - 支持新增、重命名、删除配置组
  - 支持选择 `Active` 配置，并将其他配置自动取消激活
  - 一键测试与 Forgejo 的连接（`GET /api/v1/user`）

- 弹窗页 `popup.html` / `popup.js`
  - 显示当前连接状态（基于 `GET /api/v1/user`）
  - 从下拉选择框切换 `Active` 配置

## 隐私与安全

- Forgejo/GitHub Token 仅保存在你的浏览器 `chrome.storage.sync` 中
- 扩展不会向除你配置的 Forgejo 服务器以外的第三方发送这些令牌
- 建议为 Forgejo 创建最小权限的 Token（至少需要 `repo` 权限）

## 开发

- 本项目为纯前端扩展，无需构建步骤，直接“加载已解压的扩展程序”即可开发与调试
- 关键文件：
  - `manifest.json`：声明 `content_scripts` 匹配 `https://github.com/*/*`，注入 `content.js` 与 `styles.css`
  - `background.js`：注册 `onInstalled` 事件与卸载回访链接
  - `options.html` / `options.js`：多配置管理、测试连接、持久化
  - `popup.html` / `popup.js`：状态检测与活动配置切换

### 调试建议

- 打开 GitHub 仓库页面，按 F12 查看 Console 日志（`content.js` 有较多初始化与错误日志）
- 如果按钮未出现，确认：
  - 是否在仓库相关页面路径
  - 选项页是否已配置且设置了 Active 配置
  - `host_permissions` 是否允许访问你配置的 Forgejo URL（默认 `<all_urls>` 可用）
- 迁移失败时检查：
  - Forgejo URL 是否正确且可从本机访问
  - Token 权限是否充足
  - 目标组织是否可创建/是否已存在

## 许可

暂未声明许可证，如需开源请添加 `LICENSE` 文件并声明协议。
