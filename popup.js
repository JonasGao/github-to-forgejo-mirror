document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');
  const settingsLink = document.getElementById('settings-link');

  // Open options page when clicking settings
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Check connection status
  try {
    const config = await new Promise((resolve) => {
      chrome.storage.sync.get(['forgejoUrl', 'forgejoToken', 'forgejoUser'], resolve);
    });

    if (!config.forgejoUrl || !config.forgejoToken || !config.forgejoUser) {
      status.textContent = 'Please configure your Forgejo settings';
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
      status.textContent = `Connected as: ${data.username}`;
      status.style.color = '#2ea44f';
    } else {
      throw new Error('Connection failed');
    }
  } catch (error) {
    status.textContent = 'Connection error. Please check your settings.';
    status.style.color = '#d73a49';
  }
});
