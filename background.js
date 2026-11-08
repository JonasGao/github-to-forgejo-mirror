// Background service worker — 处理镜像相关的后台请求
// 镜像逻辑放在这里，popup 关闭后任务仍能继续

chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub to Forgejo Mirror extension installed');
});

// Handle uninstall
chrome.runtime.setUninstallURL('https://example.com/feedback');

// 从 chrome.storage.sync 获取激活配置
async function getActiveConfig() {
  const { configurations = {}, activeConfig } = await chrome.storage.sync.get([
    "configurations",
    "activeConfig",
  ]);
  if (!activeConfig || !configurations[activeConfig]) {
    return null;
  }
  const config = configurations[activeConfig];
  if (!config.forgejoUrl || !config.forgejoToken || !config.forgejoUser) {
    return null;
  }
  return { ...config, name: activeConfig };
}

// 确保 organization 存在（422 视为已存在）
async function ensureOrganizationExists(orgName, config) {
  const createResponse = await fetch(`${config.forgejoUrl}/api/v1/orgs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${config.forgejoToken}`,
    },
    body: JSON.stringify({
      username: orgName,
      visibility: config.private !== false ? "private" : "public",
    }),
  });

  if (createResponse.ok) {
    console.info(`Organization ${orgName} created successfully`);
    return true;
  }

  if (createResponse.status === 422) {
    console.info(`Organization ${orgName} already exists`);
    return true;
  }

  const error = await createResponse.json();
  throw new Error(error.message || `Failed to create organization: ${createResponse.status}`);
}

// 创建镜像
async function createMirror(owner, repoName, config) {
  const githubUrl = `https://github.com/${owner}/${repoName}.git`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `token ${config.forgejoToken}`,
  };
  let repoOwner = config.forgejoUser;

  // 使用组织结构：GitHub owner 不同于 Forgejo 用户时，先确保组织存在
  if (config.useOrganization !== false && owner !== config.forgejoUser) {
    await ensureOrganizationExists(owner, config);
    repoOwner = owner;
  }

  const body = {
    clone_addr: githubUrl,
    mirror: config.enableMirror !== false,
    mirror_interval: `${config.mirrorInterval || 8}h`,
    repo_name: repoName,
    repo_owner: repoOwner,
    service: "github",
    wiki: config.enableWiki !== false,
    labels: config.enableLabels !== false,
    issues: !!config.enableIssues,
    pull_requests: !!config.enablePullRequests,
    releases: !!config.enableReleases,
    private: config.private !== false,
  };
  if (config.githubToken) {
    body.auth_token = config.githubToken;
  }

  const response = await fetch(`${config.forgejoUrl}/api/v1/repos/migrate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return { success: true, repoOwner, repoName };
  }

  const error = await response.json();
  throw new Error(error.message || "Failed to create mirror");
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "CHECK_MIRROR_STATUS") {
        const { owner, repoName } = message;
        const config = await getActiveConfig();
        if (!config) {
          sendResponse({ status: "noconfig" });
          return;
        }

        const repoOwner = config.useOrganization !== false && owner !== config.forgejoUser
          ? owner
          : config.forgejoUser;

        const response = await fetch(
          `${config.forgejoUrl}/api/v1/repos/${repoOwner}/${repoName}`,
          { headers: { Authorization: `token ${config.forgejoToken}` } }
        );

        if (response.status === 404) {
          sendResponse({ status: "ready", configName: config.name, user: config.forgejoUser });
        } else if (response.ok) {
          // 已镜像，带上 Forgejo 仓库 URL 供 popup 跳转
          let repoHtmlUrl = null;
          try {
            const data = await response.json();
            if (data && data.html_url) {
              repoHtmlUrl = data.html_url;
            }
          } catch (e) {}
          sendResponse({
            status: "mirrored",
            configName: config.name,
            user: config.forgejoUser,
            forgejoUrl: repoHtmlUrl,
          });
        } else {
          sendResponse({ status: "error", configName: config.name, user: config.forgejoUser });
        }
        return;
      }

      if (message.type === "CREATE_MIRROR") {
        const { owner, repoName } = message;
        const config = await getActiveConfig();
        if (!config) {
          sendResponse({ success: false, error: "Configuration not found. Please set up the extension options." });
          return;
        }

        await createMirror(owner, repoName, config);
        sendResponse({ success: true });
        return;
      }

      sendResponse({ error: "Unknown message type" });
    } catch (error) {
      console.error("Background error:", error);
      sendResponse({ error: error.message });
    }
  })();

  // 返回 true 表示异步响应
  return true;
});
