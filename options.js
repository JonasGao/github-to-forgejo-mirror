document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settings-form");
  const successMessage = document.getElementById("success-message");
  const testButton = document.getElementById("test-connection");

  // Load saved settings
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
      "private",
      "useOrganization",
    ],
    (data) => {
      if (data.forgejoUrl)
        document.getElementById("forgejoUrl").value = data.forgejoUrl;
      if (data.forgejoToken)
        document.getElementById("forgejoToken").value = data.forgejoToken;
      if (data.forgejoUser)
        document.getElementById("forgejoUser").value = data.forgejoUser;
      if (data.githubToken)
        document.getElementById("githubToken").value = data.githubToken;

      // 设置复选框状态，部分选项默认开启
      document.getElementById("enableMirror").checked =
        data.enableMirror !== false;
      document.getElementById("enableWiki").checked = data.enableWiki !== false;
      document.getElementById("enableLabels").checked =
        data.enableLabels !== false;
      document.getElementById("enableIssues").checked = !!data.enableIssues;
      document.getElementById("enablePullRequests").checked =
        !!data.enablePullRequests;
      document.getElementById("enableReleases").checked = !!data.enableReleases;
      document.getElementById("private").checked = data.private !== false;
      document.getElementById("useOrganization").checked =
        data.useOrganization !== false;
    }
  );

  // Save settings
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const forgejoUrl = document
      .getElementById("forgejoUrl")
      .value.replace(/\/$/, "");
    const forgejoToken = document.getElementById("forgejoToken").value;
    const forgejoUser = document.getElementById("forgejoUser").value;
    const githubToken = document.getElementById("githubToken").value;
    const enableMirror = document.getElementById("enableMirror").checked;
    const enableWiki = document.getElementById("enableWiki").checked;
    const enableLabels = document.getElementById("enableLabels").checked;
    const enableIssues = document.getElementById("enableIssues").checked;
    const enablePullRequests =
      document.getElementById("enablePullRequests").checked;
    const enableReleases = document.getElementById("enableReleases").checked;
    const isPrivate = document.getElementById("private").checked;
    const useOrganization = document.getElementById("useOrganization").checked;

    await chrome.storage.sync.set({
      forgejoUrl,
      forgejoToken,
      forgejoUser,
      githubToken,
      enableMirror,
      enableWiki,
      enableLabels,
      enableIssues,
      enablePullRequests,
      enableReleases,
      private: isPrivate,
      useOrganization,
    });

    successMessage.style.display = "block";
    setTimeout(() => {
      successMessage.style.display = "none";
    }, 3000);
  });

  // Test connection
  testButton.addEventListener("click", async () => {
    const forgejoUrl = document
      .getElementById("forgejoUrl")
      .value.replace(/\/$/, "");
    const forgejoToken = document.getElementById("forgejoToken").value;

    testButton.disabled = true;
    testButton.textContent = "Testing...";

    try {
      const response = await fetch(`${forgejoUrl}/api/v1/user`, {
        headers: {
          Authorization: `token ${forgejoToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Connection successful! Connected as: ${data.username}`);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Connection failed");
      }
    } catch (error) {
      alert(`Connection failed: ${error.message}`);
    } finally {
      testButton.disabled = false;
      testButton.textContent = "Test Connection";
    }
  });
});
