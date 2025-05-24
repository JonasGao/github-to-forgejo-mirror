chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub to Forgejo Mirror extension installed');
});

// Handle uninstall
chrome.runtime.setUninstallURL('https://example.com/feedback');
