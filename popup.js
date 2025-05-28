document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');
  const settingsLink = document.getElementById('settings-link');
  const configSelect = document.getElementById('config-select');

  // Open options page when clicking settings
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  async function refreshStatus(config) {
    try {
      if (!config || !config.forgejoUrl || !config.forgejoToken || !config.forgejoUser) {
        status.textContent = configSelect.value ? 
          `Please configure your Forgejo settings for "${configSelect.value}"` :
          'Please configure your Forgejo settings';
        status.style.color = '#d73a49';
        return;
      }

      const response = await fetch(`${config.forgejoUrl}/api/v1/user`, {
        headers: {
          'Authorization': `token ${config.forgejoToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        status.textContent = `Connected as: ${data.username} (${configSelect.value})`;
        status.style.color = '#2ea44f';
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      status.textContent = 'Connection error. Please check your settings.';
      status.style.color = '#d73a49';
    }
  }

  // Load configurations and setup selector
  const { configurations = {}, activeConfig } = await new Promise((resolve) => {
    chrome.storage.sync.get(['configurations', 'activeConfig'], resolve);
  });

  // Populate configuration selector
  Object.keys(configurations).forEach(configName => {
    const option = document.createElement('option');
    option.value = configName;
    option.textContent = configName;
    option.selected = configName === activeConfig;
    configSelect.appendChild(option);
  });

  // Handle configuration changes
  configSelect.addEventListener('change', async () => {
    const newActiveConfig = configSelect.value;
    await chrome.storage.sync.set({ activeConfig: newActiveConfig });

    // Update configurations to mark the selected one as active
    const { configurations } = await chrome.storage.sync.get('configurations');
    Object.keys(configurations).forEach(key => {
      configurations[key].isActive = key === newActiveConfig;
    });
    await chrome.storage.sync.set({ configurations });

    // Refresh status with new configuration
    await refreshStatus(configurations[newActiveConfig]);
  });

  // Initial status check
  if (activeConfig && configurations[activeConfig]) {
    await refreshStatus(configurations[activeConfig]);
  } else {
    status.textContent = 'Please configure your Forgejo settings';
    status.style.color = '#d73a49';
  }
});
