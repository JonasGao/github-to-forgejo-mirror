class GitHubForgejoMirror {
  constructor() {
    this.isInitialized = false;
    this.init();
  }

  async init() {
    if (this.isInitialized || !this.isRepoPage()) return;
    
    this.config = await this.getConfig();
    if (!this.config) {
        console.warn('Forgejo configuration not found. Please set it up in the extension options.');
        return;
    }

    this.createMirrorButton();
    this.isInitialized = true;
  }

  isRepoPage() {
    return /^\/[^/]+\/[^/]+\/?$/.test(window.location.pathname);
  }

  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['forgejoUrl', 'forgejoToken', 'forgejoUser'], (data) => {
        if (data.forgejoUrl && data.forgejoToken && data.forgejoUser) {
          resolve(data);
        } else {
          resolve(null);
        }
      });
    });
  }

  createMirrorButton() {
    const headerActions = document.querySelector('ul.pagehead-actions');
    if (!headerActions) {
        console.error('Header actions not found');
        return;
    }

    const btnContainer = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'forgejo-mirror-btn';
    btn.innerHTML = `
      <svg class="octicon" viewBox="0 0 16 16" width="16" height="16">
        <path fill-rule="evenodd" d="M15 0a1 1 0 01.707 1.707L12.45 4.964a7.5 7.5 0 11-9.486 0L.707 1.707A1 1 0 012.12.293l2.787 2.787a6 6 0 119.186 0l2.787-2.787A1 1 0 0115 0z"/>
      </svg>
      Mirror to Forgejo
    `;

    btn.addEventListener('click', () => this.handleMirrorClick());
    btnContainer.appendChild(btn);
    headerActions.insertBefore(btnContainer, headerActions.firstChild);
  }

  async handleMirrorClick() {
    const btn = document.querySelector('.forgejo-mirror-btn');
    if (!btn) return;

    try {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creating mirror...';

      const [owner, repo] = window.location.pathname.slice(1).split('/');
      const githubUrl = `https://github.com/${owner}/${repo}.git`;

      const response = await this.createForgejoMirror(githubUrl, repo);
      
      if (response.ok) {
        const data = await response.json();
        this.showNotification('success', 'Repository mirrored successfully!');
        window.open(`${this.config.forgejoUrl}/${this.config.forgejoUser}/${repo}`, '_blank');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create mirror');
      }
    } catch (error) {
      this.showNotification('error', `Error: ${error.message}`);
    } finally {
      this.resetButton(btn);
    }
  }

  async createForgejoMirror(githubUrl, repoName) {
    return fetch(`${this.config.forgejoUrl}/api/v1/repos/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${this.config.forgejoToken}`
      },
      body: JSON.stringify({
        clone_addr: githubUrl,
        mirror: true,
        repo_name: repoName,
        service: 'github',
        wiki: true,
        labels: true,
        issues: true,
        pull_requests: true,
        releases: true,
        private: false
      })
    });
  }

  showNotification(type, message) {
    const notification = document.createElement('div');
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