# GitHub to Forgejo Mirror

一个基于 Chrome Manifest V3 的浏览器扩展，用于在扩展弹窗中一键将 GitHub 仓库镜像到 Forgejo。

## 主要特性

- **纯弹窗设计**：镜像操作集中在扩展弹窗内，不依赖 GitHub 页面结构，天然免疫 GitHub 改版
- **上下文感知**：弹窗自动识别当前标签页是否为 GitHub 仓库页，并显示对应状态
- 支持配置多个 Forgejo 连接并快速切换"活动"配置
- 智能检测仓库是否已镜像，避免重复创建
- 支持自定义镜像选项：Wiki、Labels、Issues、PRs、Releases、私有仓库、镜像间隔等
- 可选保持 GitHub 组织结构（自动在 Forgejo 创建同名组织）
- 镜像逻辑运行在后台 Service Worker，弹窗关闭后任务仍能继续

## 安装

1. 打开 Chrome/Chromium 系浏览器，进入 `chrome://extensions/`
2. 打开右上角"开发者模式"
3. 点击"加载已解压的扩展程序"，选择本项目根目录
4. 安装完成后，工具栏会出现扩展图标

## 使用

1. 先进入扩展的设置页填写 Forgejo 连接信息：
   - 在浏览器工具栏点击扩展图标，弹窗中点击右下角的 `⚙`（或在扩展详情中点击"扩展选项"）
   - 在 `Options` 页中创建或编辑配置，至少需要：
     - Forgejo Server URL（如 `https://forgejo.example.com`）
     - Forgejo API Token（需要具备 `repo` 权限）
     - Username（你的 Forgejo 用户名）
     - 可选：GitHub API Token（用于访问私有仓库）
   - 可配置项：是否镜像、镜像间隔（小时）、是否包含 Wiki/Labels/Issues/PRs/Releases、是否私有、是否沿用组织结构
   - 支持多个配置，勾选某个配置为 `Active` 即为当前使用的配置
   - 可点击 `Test Connection` 测试 Forgejo 连接

2. 打开任意 GitHub 仓库页面（例如 `https://github.com/<owner>/<repo>`），点击工具栏扩展图标
   - 弹窗会自动识别当前仓库，显示 `owner/repo` 与镜像状态
   - 状态说明：
     - `可以镜像`：仓库尚未镜像，可点击主按钮执行镜像
     - `已在 Forgejo 存在`：仓库已存在，按钮禁用，并提供"在 Forgejo 查看"链接
     - `未配置 Forgejo`：未配置连接，主按钮变为"去配置 Forgejo"
     - `非仓库页`：当前标签页不是 GitHub 仓库页，弹窗给出提示
   - 高级选项（镜像开关、间隔、Wiki/Labels/Issues/PRs/Releases、私有、组织结构）默认折叠，点开可调整并保存到当前配置
   - 点击主按钮后，扩展通过后台 Service Worker 调用 Forgejo 迁移 API 创建镜像
   - 成功/失败会在弹窗内显示提示，成功后自动刷新状态

## 权限说明

- `activeTab`：用于读取当前激活标签页的 URL，判断是否为 GitHub 仓库页
- `storage`：用于保存扩展配置（包含多个配置组与当前激活配置）
- `host_permissions`：
  - `<all_urls>`：用于向 Forgejo 服务器发起请求（基于你在选项页中填写的 URL）

## 目录结构

```
./
├─ icons/                扩展图标
├─ background.js         Service Worker（镜像状态检查与创建镜像等后台逻辑）
├─ manifest.json         扩展清单（Manifest V3）
├─ options.html          扩展设置页 UI
├─ options.js            设置页脚本，支持多配置组、测试连接与持久化存储
├─ popup.html            工具栏弹窗 UI（上下文感知控制面板）
├─ popup.js              弹窗脚本（读取当前仓库、判断状态、触发镜像）
└─ README.md             项目说明文档（本文件）
```

## 核心工作流

- 后台 `background.js`（Service Worker）
  - `CHECK_MIRROR_STATUS`：读取当前 `activeConfig`，通过 `GET /api/v1/repos/:owner/:repo` 判断仓库是否已镜像
  - `CREATE_MIRROR`：如勾选"沿用组织结构"，先通过 Forgejo API 创建同名组织（若已存在返回 422 则视为成功），再调用 `POST /api/v1/repos/migrate` 创建镜像
  - 镜像逻辑放在后台，弹窗关闭后任务仍能继续执行

- 弹窗页 `popup.html` / `popup.js`
  - 通过 `chrome.tabs.query` 读取当前激活标签页 URL，解析 `owner/repo` 并判断是否为 GitHub 仓库页
  - 根据当前状态渲染头部渐变区、主行动按钮、状态点与提示
  - 高级选项默认折叠，修改后保存到当前激活配置
  - 底部可在多个配置间切换，并提供跳转设置页的入口

- 选项页 `options.html` / `options.js`
  - 支持新增、重命名、删除配置组
  - 支持选择 `Active` 配置，并将其他配置自动取消激活
  - 一键测试与 Forgejo 的连接（`GET /api/v1/user`）
  - 支持配置组的折叠/展开，并记忆状态

## 隐私与安全

- Forgejo/GitHub Token 仅保存在你的浏览器 `chrome.storage.sync` 中
- 扩展不会向除你配置的 Forgejo 服务器以外的第三方发送这些令牌
- 建议为 Forgejo 创建最小权限的 Token（至少需要 `repo` 权限）

## 开发

- 本项目为纯前端扩展，无需构建步骤，直接"加载已解压的扩展程序"即可开发与调试
- 关键文件：
  - `manifest.json`：声明弹窗入口、`activeTab`/`storage` 权限与后台 Service Worker
  - `background.js`：镜像状态检查与创建镜像的后台逻辑
  - `options.html` / `options.js`：多配置管理、测试连接、持久化
  - `popup.html` / `popup.js`：上下文感知控制面板

### 调试建议

- 弹窗逻辑：右键点击扩展图标选择"检查弹出窗口"
- 后台逻辑：在 `chrome://extensions/` 页面点击扩展卡片上的"Service Worker"查看日志
- 选项页面：在扩展详情中点击"扩展选项"
- 如果弹窗提示"未配置"，确认选项页是否已配置且设置了 Active 配置
- 如果提示"非仓库页"，确认当前标签页是否为 GitHub 仓库页
- 迁移失败时检查：
  - Forgejo URL 是否正确且可从本机访问
  - Token 权限是否充足
  - 目标组织是否可创建/是否已存在

## 技术特点

- **纯 JavaScript 实现**：无需构建工具，使用原生 ES6+ 语法
- **Manifest V3**：采用最新的 Chrome 扩展标准
- **纯弹窗架构**：不注入 GitHub 页面，免疫 GitHub 改版
- **上下文感知**：自动识别当前仓库并显示镜像状态
- **后台 Service Worker**：镜像逻辑运行在后台，弹窗关闭不中断
- **智能状态管理**：自动检测仓库镜像状态，防止重复创建
- **多配置支持**：可配置多个 Forgejo 实例并快速切换

## 许可

暂未声明许可证，如需开源请添加 `LICENSE` 文件并声明协议。
