class GitHubForgejoMirror {  constructor() {
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
    };    // 监听 URL 和内容变化
    const observer = new MutationObserver((mutations) => {
      const shouldCheck = mutations.some((mutation) => {
        if (mutation.type === "childList") {
          // 检查是否是导航引起的 DOM 变化
          const isNavigation = document.location.href !== this.lastUrl;
          if (isNavigation) {
            this.lastUrl = document.location.href;
            this.isInitialized = false; // 重置初始化状态
            console.debug("Navigation detected, resetting initialization state");
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

    console.debug("Checking button status...", { headerActions, existingButton });
    
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

    this.config = await this.getConfig();
    if (!this.config) {
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
  }  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        [
          "forgejoUrl",
          "forgejoToken", 
          "forgejoUser",
          "githubToken",
          "enableMirror",
          "enableWiki",
          "enableLabels",
          "enableIssues",
          "enablePullRequests", 
          "enableReleases",
          "private"
        ],
        (data) => {
          if (data.forgejoUrl && data.forgejoToken && data.forgejoUser) {
            // Set default values for migration options
            data.enableMirror = data.enableMirror !== false;
            data.enableWiki = data.enableWiki !== false;
            data.enableLabels = data.enableLabels !== false;
            data.enableIssues = data.enableIssues !== false;
            data.enablePullRequests = data.enablePullRequests !== false;
            data.enableReleases = data.enableReleases !== false;
            data.private = data.private !== false;
            resolve(data);
          } else {
            resolve(null);
          }
        }
      );
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
    btn.innerHTML = `
      <svg class="octicon" viewBox="0 0 16 16" width="16" height="16">
        <path fill-rule="evenodd" d="M15 0a1 1 0 01.707 1.707L12.45 4.964a7.5 7.5 0 11-9.486 0L.707 1.707A1 1 0 012.12.293l2.787 2.787a6 6 0 119.186 0l2.787-2.787A1 1 0 0115 0z"/>
      </svg>
      Mirror to Forgejo
    `;

    btn.addEventListener("click", () => this.handleMirrorClick());
    btnContainer.appendChild(btn);
    headerActions.insertBefore(btnContainer, headerActions.firstChild);
  }

  async handleMirrorClick() {
    const btn = document.querySelector(".forgejo-mirror-btn");
    if (!btn) return;

    try {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creating mirror...';

      const [owner, repo] = window.location.pathname.slice(1).split("/");
      const githubUrl = `https://github.com/${owner}/${repo}.git`;

      const response = await this.createForgejoMirror(githubUrl, repo);

      if (response.ok) {
        this.showNotification("success", "Repository mirrored successfully!");
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

  async createForgejoMirror(githubUrl, repoName) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `token ${this.config.forgejoToken}`,
    };    const body = {
      clone_addr: githubUrl,
      mirror: this.config.enableMirror !== false,
      repo_name: repoName,
      service: "github",
      wiki: this.config.enableWiki !== false,
      labels: this.config.enableLabels !== false,
      issues: !!this.config.enableIssues,
      pull_requests: !!this.config.enablePullRequests,
      releases: !!this.config.enableReleases,
      private: this.config.private !== false,
    };

    if (this.config.githubToken) {
      body.auth_token = this.config.githubToken;
    }

    return fetch(`${this.config.forgejoUrl}/api/v1/repos/migrate`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
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
    btn.innerHTML = `
      <svg class="octicon" viewBox="0 0 16 16" width="16" height="16">
        <path fill-rule="evenodd" d="M15 0a1 1 0 01.707 1.707L12.45 4.964a7.5 7.5 0 11-9.486 0L.707 1.707A1 1 0 012.12.293l2.787 2.787a6 6 0 119.186 0l2.787-2.787A1 1 0 0115 0z"/>
      </svg>
      Mirror to Forgejo
    `;
  }
}

new GitHubForgejoMirror();
