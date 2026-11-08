// popup.js — 上下文感知控制面板
// 打开时读取当前激活 tab，判断是否为 GitHub 仓库页，然后呈现对应状态

let currentOwner = null;
let currentRepo = null;
let repoOwnerOnForgejo = null;

// DOM 元素
const repoPath = document.getElementById("repo-path");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const actionBtn = document.getElementById("action-btn");
const viewLink = document.getElementById("view-link");
const forgejoLink = document.getElementById("forgejo-link");
const emptyMsg = document.getElementById("empty-msg");
const opts = document.getElementById("opts");
const toast = document.getElementById("toast");
const configSelect = document.getElementById("config-select");
const connection = document.getElementById("connection");
const settingsLink = document.getElementById("settings-link");

// 选项元素
const optMirror = document.getElementById("opt-mirror");
const optWiki = document.getElementById("opt-wiki");
const optLabels = document.getElementById("opt-labels");
const optIssues = document.getElementById("opt-issues");
const optPR = document.getElementById("opt-pr");
const optReleases = document.getElementById("opt-releases");
const optPrivate = document.getElementById("opt-private");
const optOrg = document.getElementById("opt-org");
const optInterval = document.getElementById("opt-interval");

// 判断是否为 GitHub 仓库页
function isRepoPage(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;

    const match = u.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
    if (match) {
      const [, owner, repo] = match;
      if (repo.endsWith(".git")) {
        return { owner, repo: repo.slice(0, -4) };
      }
      return { owner, repo };
    }

    const treeMatch = u.pathname.match(/^\/([^/]+)\/([^/]+)\/(tree|blob|commits)\/([^/]+)/);
    if (treeMatch) {
      const [, owner, repo] = treeMatch;
      return { owner, repo };
    }

    return null;
  } catch (e) {
    return null;
  }
}

// 显示提示消息
function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

// 设置状态显示
function setStatus(dotClass, text) {
  statusDot.className = `dot ${dotClass}`;
  statusText.textContent = text;
}

// 从当前配置加载高级选项到 UI
async function loadOptionsToUI() {
  const { configurations = {}, activeConfig } = await chrome.storage.sync.get([
    "configurations",
    "activeConfig",
  ]);
  if (!activeConfig || !configurations[activeConfig]) return;

  const config = configurations[activeConfig];
  optMirror.checked = config.enableMirror !== false;
  optWiki.checked = config.enableWiki !== false;
  optLabels.checked = config.enableLabels !== false;
  optIssues.checked = !!config.enableIssues;
  optPR.checked = !!config.enablePullRequests;
  optReleases.checked = !!config.enableReleases;
  optPrivate.checked = config.private !== false;
  optOrg.checked = config.useOrganization !== false;
  optInterval.value = config.mirrorInterval || 8;
}

// 保存高级选项到激活配置
async function saveOptionsFromUI() {
  const { configurations = {}, activeConfig } = await chrome.storage.sync.get([
    "configurations",
    "activeConfig",
  ]);
  if (!activeConfig || !configurations[activeConfig]) return;

  const config = configurations[activeConfig];
  config.enableMirror = optMirror.checked;
  config.enableWiki = optWiki.checked;
  config.enableLabels = optLabels.checked;
  config.enableIssues = optIssues.checked;
  config.enablePullRequests = optPR.checked;
  config.enableReleases = optReleases.checked;
  config.private = optPrivate.checked;
  config.useOrganization = optOrg.checked;
  config.mirrorInterval = parseInt(optInterval.value) || 8;

  await chrome.storage.sync.set({ configurations });
}

// 加载配置选择器
async function loadConfigSelector() {
  const { configurations = {}, activeConfig } = await chrome.storage.sync.get([
    "configurations",
    "activeConfig",
  ]);

  configSelect.innerHTML = "";
  Object.keys(configurations).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === activeConfig;
    configSelect.appendChild(option);
  });

  if (!activeConfig) {
    connection.textContent = "未配置";
    return;
  }

  const config = configurations[activeConfig];
  if (config && config.forgejoUrl && config.forgejoToken && config.forgejoUser) {
    connection.textContent = `● ${config.forgejoUser}`;
  } else {
    connection.textContent = "未配置";
  }
}

// 检查镜像状态（通过 background）
async function checkMirrorStatus() {
  if (!currentOwner || !currentRepo) return;

  setStatus("gray", "正在检查...");

  const response = await chrome.runtime.sendMessage({
    type: "CHECK_MIRROR_STATUS",
    owner: currentOwner,
    repoName: currentRepo,
  });

  if (response && response.error) {
    setStatus("red", "检查失败");
    actionBtn.textContent = "重试";
    actionBtn.disabled = false;
    actionBtn.dataset.mode = "retry";
    return;
  }

  const status = response.status;

  if (status === "noconfig") {
    setStatus("red", "未配置 Forgejo");
    actionBtn.textContent = "⚙ 去配置 Forgejo";
    actionBtn.disabled = false;
    actionBtn.dataset.mode = "config";
    connection.textContent = "未配置";
  } else if (status === "ready") {
    setStatus("green", "可以镜像");
    actionBtn.textContent = "镜像到 Forgejo";
    actionBtn.disabled = false;
    actionBtn.dataset.mode = "mirror";
    connection.textContent = `● ${response.user}`;
    viewLink.style.display = "none";
  } else if (status === "mirrored") {
    setStatus("blue", "已在 Forgejo 存在");
    actionBtn.textContent = "已镜像";
    actionBtn.disabled = true;
    actionBtn.classList.add("readonly");
    actionBtn.dataset.mode = "disabled";
    connection.textContent = `● ${response.user}`;
    repoOwnerOnForgejo = response.configName;
    viewLink.style.display = "block";
    if (response.forgejoUrl) {
      forgejoLink.href = response.forgejoUrl;
    }
  } else {
    setStatus("amber", "检查出错");
    actionBtn.textContent = "重试";
    actionBtn.disabled = false;
    actionBtn.dataset.mode = "retry";
  }
}

// 执行镜像
async function handleAction() {
  const mode = actionBtn.dataset.mode;

  if (mode === "config") {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (mode === "retry") {
    await checkMirrorStatus();
    return;
  }

  if (mode !== "mirror") return;

  // 禁用按钮，显示加载状态
  actionBtn.disabled = true;
  actionBtn.innerHTML = '<span class="spinner"></span>镜像中...';

  // 保存当前选项
  await saveOptionsFromUI();

  try {
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_MIRROR",
      owner: currentOwner,
      repoName: currentRepo,
    });

    if (response && response.success) {
      showToast("镜像创建成功！", "success");
      await checkMirrorStatus();
    } else {
      const error = response && response.error ? response.error : "未知错误";
      showToast(`镜像失败: ${error}`, "error");
      await checkMirrorStatus();
    }
  } catch (error) {
    showToast(`镜像失败: ${error.message}`, "error");
    await checkMirrorStatus();
  }
}

// 事件监听
actionBtn.addEventListener("click", handleAction);
settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

configSelect.addEventListener("change", async () => {
  const { configurations = {} } = await chrome.storage.sync.get("configurations");
  await chrome.storage.sync.set({
    activeConfig: configSelect.value,
  });
  await loadOptionsToUI();
  await loadConfigSelector();
  await checkMirrorStatus();
});

// 初始化
(async () => {
  await loadConfigSelector();
  await loadOptionsToUI();

  // 获取当前激活 tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const repoInfo = tab && tab.url ? isRepoPage(tab.url) : null;

  if (!repoInfo) {
    repoPath.textContent = "非 GitHub 仓库页";
    setStatus("amber", "非仓库页");
    actionBtn.style.display = "none";
    opts.style.display = "none";
    emptyMsg.style.display = "block";
    return;
  }

  currentOwner = repoInfo.owner;
  currentRepo = repoInfo.repo;
  repoPath.textContent = `${currentOwner}/${currentRepo}`;

  await checkMirrorStatus();
})();
