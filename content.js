class GitHubForgejoMirror {
  constructor() {
    this.isInitialized = false;
    this.lastUrl = document.location.href;
    this.init();

    this.setupUrlChangeListener();
  }

  setupUrlChangeListener() {
    // 使用防抖函数来限制检查频率
    let debounceTimer;
    const debouncedCheck = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.checkAndInit();
      }, 200);
    }; // 监听 URL 和内容变化
    const observer = new MutationObserver((mutations) => {
      const shouldCheck = mutations.some((mutation) => {
        if (mutation.type === "childList") {
          // 检查是否是导航引起的 DOM 变化
          const isNavigation = document.location.href !== this.lastUrl;
          if (isNavigation) {
            this.lastUrl = document.location.href;
            this.isInitialized = false; // 重置初始化状态
            console.debug(
              "Navigation detected, resetting initialization state"
            );
          }
          return true;
        }
        return false;
      });
      if (shouldCheck) {
        debouncedCheck();
      }
    });

    // 配置观察器
    const observerConfig = {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    };

    observer.observe(document, observerConfig);

    // 初始检查
    debouncedCheck();
  }

  async checkAndInit() {
    if (!this.isRepoPage()) {
      console.info("Not a repository page, skipping initialization.");
      return;
    }

    const headerActions = document.querySelector("ul.pagehead-actions");
    const existingButton = document.querySelector(".forgejo-mirror-btn");

    console.debug("Checking button status...", {
      headerActions,
      existingButton,
    });

    // 只在没有按钮时创建新按钮
    if (headerActions && !existingButton) {
      console.info("No existing button found, initializing...");
      await this.init();
    } else {
      console.info("Button already exists, skipping initialization.");
    }
  }

  async init() {
    if (this.isInitialized) {
      console.info("Forgejo mirror is already initialized.");
      return;
    }

    // 检查是否有基本配置
    const config = await this.getConfig();
    if (!config) {
      console.warn(
        "Forgejo configuration not found. Please set it up in the extension options."
      );
      return;
    }

    // 提前标记
    this.isInitialized = true;
    this.createMirrorButton();
  }

  isRepoPage() {
    // 匹配以下格式的 URL:
    // /:owner/:repo
    // /:owner/:repo/tree/:branch
    // /:owner/:repo/commits/:branch
    // /:owner/:repo/blob/:branch
    const pathname = window.location.pathname;
    const repoPatterns = [
      /^\/[^/]+\/[^/]+\/?$/, // 仓库主页
      /^\/[^/]+\/[^/]+\/tree\/[^/]+/, // 分支文件浏览
      /^\/[^/]+\/[^/]+\/blob\/[^/]+/, // 文件查看
      /^\/[^/]+\/[^/]+\/commits\/[^/]+/, // 提交历史
    ];

    return repoPatterns.some((pattern) => pattern.test(pathname));
  }

  getButtonHTML(statusText = "🔄 Checking...", showSpinner = false) {
    const iconUrl = chrome.runtime.getURL("icons/forgejo.png");
    const spinnerHTML = showSpinner ? '<span class="spinner"></span> ' : '';
    return `
      <img class="forgejo-icon" src="${iconUrl}" width="16" height="16" alt="Forgejo" style="vertical-align: text-bottom; margin-right: 4px;" />
      ${spinnerHTML}<span class="forgejo-status-indicator">${statusText}</span>
    `;
  }

  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["configurations", "activeConfig"], (data) => {
        const { configurations = {}, activeConfig } = data;
        if (!activeConfig || !configurations[activeConfig]) {
          resolve(null);
          return;
        }

        const config = configurations[activeConfig];
        if (config.forgejoUrl && config.forgejoToken && config.forgejoUser) {
          // Set default values for migration options
          config.enableMirror = config.enableMirror !== false;
          config.mirrorInterval = typeof config.mirrorInterval === "number" ? config.mirrorInterval : 8;
          config.enableWiki = config.enableWiki !== false;
          config.enableLabels = config.enableLabels !== false;
          config.enableIssues = !!config.enableIssues;
          config.enablePullRequests = !!config.enablePullRequests;
          config.enableReleases = !!config.enableReleases;
          config.private = config.private !== false;
          config.useOrganization = config.useOrganization !== false;
          resolve(config);
        } else {
          resolve(null);
        }
      });
    });
  }

  createMirrorButton() {
    const headerActions = document.querySelector("ul.pagehead-actions");
    if (!headerActions) {
      console.info("Header actions not found");
      return;
    }

    const btnContainer = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "forgejo-mirror-btn";
    btn.innerHTML = this.getButtonHTML();

    btn.addEventListener("click", () => this.handleMirrorClick());
    btnContainer.appendChild(btn);
    
    headerActions.insertBefore(btnContainer, headerActions.firstChild);
    
    // Check if repository exists and update button status
    this.checkRepositoryExists();
  }

  async checkRepositoryExists() {
    // Prevent multiple concurrent checks
    if (this._checkingRepository) return;
    this._checkingRepository = true;
    
    const btn = document.querySelector(".forgejo-mirror-btn");
    if (!btn) {
      this._checkingRepository = false;
      return;
    }
    
    const statusIndicator = btn.querySelector(".forgejo-status-indicator");
    if (!statusIndicator) {
      this._checkingRepository = false;
      return;
    }
    
    try {
      const config = await this.getConfig();
      if (!config) {
        statusIndicator.textContent = "⚙ No config";
        statusIndicator.style.color = "#d73a49";
        btn.disabled = true;
        this._checkingRepository = false;
        return;
      }
      
      const [owner, repo] = window.location.pathname.slice(1).split("/");
      const repoOwner = config.useOrganization && owner !== config.forgejoUser ? owner : config.forgejoUser;
      
      // Check if repository exists on Forgejo
      const response = await fetch(`${config.forgejoUrl}/api/v1/repos/${repoOwner}/${repo}`, {
        headers: {
          Authorization: `token ${config.forgejoToken}`
        }
      });
      
      if (response.ok) {
        // Repository already exists - disable the button
        statusIndicator.textContent = "✓ Already mirrored";
        statusIndicator.style.color = "#2ea44f";
        btn.disabled = true;
      } else if (response.status === 404) {
        // Repository doesn't exist - enable button and ready status
        statusIndicator.textContent = "✨ Ready to mirror";
        statusIndicator.style.color = "#0366d6";
        btn.disabled = false;
      } else {
        // Error checking - show button but with error status
        statusIndicator.textContent = "⚠ Error checking";
        statusIndicator.style.color = "#d73a49";
        btn.disabled = false;
      }
    } catch (error) {
      console.error("Error checking repository existence:", error);
      statusIndicator.textContent = "⚠ Error checking";
      statusIndicator.style.color = "#d73a49";
      btn.disabled = false;
    } finally {
      this._checkingRepository = false;
    }
  }

  async handleMirrorClick() {
    const btn = document.querySelector(".forgejo-mirror-btn");
    if (!btn) return;

    try {
      btn.disabled = true;
      btn.innerHTML = this.getButtonHTML("Creating mirror...", true);

      // Get the latest configuration
      const config = await this.getConfig();
      if (!config) {
        throw new Error(
          "Configuration not found. Please set up the extension options."
        );
      }

      const [owner, repo] = window.location.pathname.slice(1).split("/");
      const githubUrl = `https://github.com/${owner}/${repo}.git`;
      const response = await this.createForgejoMirror(
        githubUrl,
        owner,
        repo,
        config
      );

      if (response.ok) {
        this.showNotification("success", "Repository mirrored successfully!");
        // After successful mirror, check repository status again
        setTimeout(() => this.checkRepositoryExists(), 1000);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to create mirror");
      }
    } catch (error) {
      this.showNotification("error", `Error: ${error.message}`);
    } finally {
      this.resetButton(btn);
    }
  }

  async createForgejoMirror(githubUrl, owner, repoName, config) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `token ${config.forgejoToken}`,
    };
    let repoOwner = config.forgejoUser;

    // Check if we should use organization structure
    if (config.useOrganization !== false && owner !== config.forgejoUser) {
      try {
        await this.ensureOrganizationExists(owner, config);
        repoOwner = owner;
      } catch (error) {
        console.error("Failed to ensure organization exists:", error);
        throw error;
      }
    }

    const body = {
      clone_addr: githubUrl,
      mirror: config.enableMirror !== false,
      mirror_interval: `${config.mirrorInterval}h`,
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

    return fetch(`${config.forgejoUrl}/api/v1/repos/migrate`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  async ensureOrganizationExists(orgName, config) {
    try {
      // Try to create the organization directly
      const createResponse = await fetch(`${config.forgejoUrl}/api/v1/orgs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `token ${config.forgejoToken}`,
        },
        body: JSON.stringify({
          username: orgName,
          visibility: config.private ? "private" : "public",
        }),
      });

      if (createResponse.ok) {
        console.info(`Organization ${orgName} created successfully`);
        return true;
      }

      // If creation fails with 422, it likely means the org already exists
      if (createResponse.status === 422) {
        console.info(`Organization ${orgName} already exists`);
        return true;
      }

      // For other error status codes, throw an error
      const error = await createResponse.json();
      throw new Error(
        error.message ||
          `Failed to create organization: ${createResponse.status}`
      );
    } catch (error) {
      throw new Error(`Organization error: ${error.message}`);
    }
  }

  showNotification(type, message) {
    const notification = document.createElement("div");
    notification.className = `forgejo-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  resetButton(btn) {
    btn.disabled = false;
    btn.innerHTML = this.getButtonHTML();
  }
}

new GitHubForgejoMirror();
