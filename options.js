document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  const successMessage = document.getElementById('success-message');
  const testButton = document.getElementById('test-connection');

  // Load saved settings
  chrome.storage.sync.get(['forgejoUrl', 'forgejoToken', 'forgejoUser'], (data) => {
    if (data.forgejoUrl) document.getElementById('forgejoUrl').value = data.forgejoUrl;
    if (data.forgejoToken) document.getElementById('forgejoToken').value = data.forgejoToken;
    if (data.forgejoUser) document.getElementById('forgejoUser').value = data.forgejoUser;
  });

  // Save settings
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const forgejoUrl = document.getElementById('forgejoUrl').value.replace(/\/$/, '');
    const forgejoToken = document.getElementById('forgejoToken').value;
    const forgejoUser = document.getElementById('forgejoUser').value;

    await chrome.storage.sync.set({
      forgejoUrl,
      forgejoToken,
      forgejoUser
    });

    successMessage.style.display = 'block';
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 3000);
  });

  // Test connection
  testButton.addEventListener('click', async () => {
    const forgejoUrl = document.getElementById('forgejoUrl').value.replace(/\/$/, '');
    const forgejoToken = document.getElementById('forgejoToken').value;
    
    testButton.disabled = true;
    testButton.textContent = 'Testing...';

    try {
      const response = await fetch(`${forgejoUrl}/api/v1/user`, {
        headers: {
          'Authorization': `token ${forgejoToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Connection successful! Connected as: ${data.username}`);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Connection failed');
      }
    } catch (error) {
      alert(`Connection failed: ${error.message}`);
    } finally {
      testButton.disabled = false;
      testButton.textContent = 'Test Connection';
    }
  });
});