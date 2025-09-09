document.addEventListener("DOMContentLoaded", async () => {
  const configGroupsContainer = document.getElementById("config-groups");
  const addGroupButton = document.getElementById("add-group");
  const newConfigNameInput = document.getElementById("new-config-name");
  const configTemplate = document.getElementById("config-group-template");

  // Load all configurations
  const { configurations = {}, activeConfig } = await chrome.storage.sync.get(["configurations", "activeConfig"]);

  // Function to create a new configuration group
  function createConfigGroup(name, config = {}) {
    const configElement = configTemplate.content.cloneNode(true);
    const configGroup = configElement.querySelector(".config-group");
    configGroup.dataset.name = name;

    // Collapse/Expand support
    const collapseBtn = configGroup.querySelector(".collapse-btn");
    const groupBody = configGroup.querySelector(".config-group-body");
    // Initialize collapsed state
    if (config && config.collapsed) {
      configGroup.classList.add("collapsed");
      if (collapseBtn) collapseBtn.setAttribute("aria-expanded", "false");
    } else {
      if (collapseBtn) collapseBtn.setAttribute("aria-expanded", "true");
    }
    if (collapseBtn) {
      collapseBtn.addEventListener("click", async () => {
        const isCollapsed = configGroup.classList.toggle("collapsed");
        collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
        // Persist collapsed state to storage
        const { configurations } = await chrome.storage.sync.get("configurations");
        if (configurations && configurations[name]) {
          configurations[name].collapsed = isCollapsed;
          await chrome.storage.sync.set({ configurations });
        }
      });
    }

    // Set group name and handle rename
    const nameInput = configGroup.querySelector(".config-name-edit");
    nameInput.value = name;
    nameInput.readOnly = true;

    const renameButton = configGroup.querySelector(".rename-config");
    renameButton.addEventListener("click", async () => {
      if (nameInput.readOnly) {
        // Enter edit mode
        nameInput.readOnly = false;
        nameInput.focus();
        nameInput.select();
        renameButton.textContent = "Save";
      } else {
        // Save new name
        const newName = nameInput.value.trim();
        const oldName = configGroup.dataset.name;
        
        if (!newName) {
          alert("Configuration name cannot be empty");
          nameInput.value = oldName;
          return;
        }

        if (newName === oldName) {
          nameInput.readOnly = true;
          renameButton.textContent = "Rename";
          return;
        }

        const { configurations, activeConfig } = await chrome.storage.sync.get(["configurations", "activeConfig"]);
        if (configurations[newName]) {
          alert("A configuration with this name already exists");
          nameInput.value = oldName;
          return;
        }

        // Update configuration storage
        configurations[newName] = configurations[oldName];
        delete configurations[oldName];

        // Update active config if needed
        if (activeConfig === oldName) {
          await chrome.storage.sync.set({ activeConfig: newName });
        }

        await chrome.storage.sync.set({ configurations });

        // Update DOM
        configGroup.dataset.name = newName;
        nameInput.readOnly = true;
        renameButton.textContent = "Rename";
      }
    });

    // Set active state
    const isActiveSwitch = configGroup.querySelector(".is-active");
    isActiveSwitch.checked = config.isActive || false;
    isActiveSwitch.addEventListener("change", async (e) => {
      const { configurations } = await chrome.storage.sync.get("configurations");
      configurations[name].isActive = e.target.checked;
      if (e.target.checked) {
        // Deactivate other configurations
        Object.keys(configurations).forEach(key => {
          if (key !== name) {
            configurations[key].isActive = false;
          }
        });
        // Update UI for other groups
        document.querySelectorAll(".config-group").forEach(group => {
          if (group.dataset.name !== name) {
            group.querySelector(".is-active").checked = false;
          }
        });
        // Set as active configuration
        await chrome.storage.sync.set({ activeConfig: name });
      }
      await chrome.storage.sync.set({ configurations });
    });

    // Set form values
    if (config) {
      configGroup.querySelector(".forgejo-url").value = config.forgejoUrl || "";
      configGroup.querySelector(".forgejo-token").value = config.forgejoToken || "";
      configGroup.querySelector(".forgejo-user").value = config.forgejoUser || "";
      configGroup.querySelector(".github-token").value = config.githubToken || "";
      configGroup.querySelector(".enable-mirror").checked = config.enableMirror !== false;
      configGroup.querySelector(".mirror-interval").value = config.mirrorInterval || "8";
      configGroup.querySelector(".enable-wiki").checked = config.enableWiki !== false;
      configGroup.querySelector(".enable-labels").checked = config.enableLabels !== false;
      configGroup.querySelector(".enable-issues").checked = !!config.enableIssues;
      configGroup.querySelector(".enable-pull-requests").checked = !!config.enablePullRequests;
      configGroup.querySelector(".enable-releases").checked = !!config.enableReleases;
      configGroup.querySelector(".private").checked = config.private !== false;
      configGroup.querySelector(".use-organization").checked = config.useOrganization !== false;
    }

    // Handle form submission
    const form = configGroup.querySelector(".settings-form");
    const successMessage = configGroup.querySelector(".success-message");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const newConfig = {
        forgejoUrl: form.querySelector(".forgejo-url").value.replace(/\/$/, ""),
        forgejoToken: form.querySelector(".forgejo-token").value,
        forgejoUser: form.querySelector(".forgejo-user").value,
        githubToken: form.querySelector(".github-token").value,
        enableMirror: form.querySelector(".enable-mirror").checked,
        mirrorInterval: parseInt(form.querySelector(".mirror-interval").value) || 8,
        enableWiki: form.querySelector(".enable-wiki").checked,
        enableLabels: form.querySelector(".enable-labels").checked,
        enableIssues: form.querySelector(".enable-issues").checked,
        enablePullRequests: form.querySelector(".enable-pull-requests").checked,
        enableReleases: form.querySelector(".enable-releases").checked,
        private: form.querySelector(".private").checked,
        useOrganization: form.querySelector(".use-organization").checked,
        isActive: configGroup.querySelector(".is-active").checked,
        collapsed: configGroup.classList.contains("collapsed")
      };

      const { configurations } = await chrome.storage.sync.get("configurations");
      configurations[name] = newConfig;
      await chrome.storage.sync.set({ configurations });

      successMessage.style.display = "block";
      setTimeout(() => {
        successMessage.style.display = "none";
      }, 3000);
    });

    // Test connection button
    const testButton = configGroup.querySelector(".test-connection");
    testButton.addEventListener("click", async () => {
      const forgejoUrl = configGroup.querySelector(".forgejo-url").value.replace(/\/$/, "");
      const forgejoToken = configGroup.querySelector(".forgejo-token").value;

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

    // Delete button
    const deleteButton = configGroup.querySelector(".delete-group");
    deleteButton.addEventListener("click", async () => {
      if (confirm(`Are you sure you want to delete the configuration "${name}"?`)) {
        const { configurations, activeConfig } = await chrome.storage.sync.get(["configurations", "activeConfig"]);
        delete configurations[name];

        // If the active config is being deleted, set a new active config
        if (activeConfig === name) {
          const firstConfig = Object.keys(configurations)[0];
          if (firstConfig) {
            configurations[firstConfig].isActive = true;
            await chrome.storage.sync.set({ activeConfig: firstConfig });
          } else {
            await chrome.storage.sync.remove("activeConfig");
          }
        }

        await chrome.storage.sync.set({ configurations });
        configGroup.remove();
      }
    });

    return configGroup;
  }

  // Add new configuration group
  addGroupButton.addEventListener("click", async () => {
    const name = newConfigNameInput.value.trim();
    if (!name) {
      alert("Please enter a name for the new configuration");
      return;
    }

    const { configurations = {} } = await chrome.storage.sync.get("configurations");
    if (configurations[name]) {
      alert("A configuration with this name already exists");
      return;
    }

    const isFirstConfig = Object.keys(configurations).length === 0;
    const newConfig = {
      isActive: isFirstConfig,
      collapsed: false
    };

    configurations[name] = newConfig;
    await chrome.storage.sync.set({ configurations });
    if (isFirstConfig) {
      await chrome.storage.sync.set({ activeConfig: name });
    }

    configGroupsContainer.appendChild(createConfigGroup(name, newConfig));
    newConfigNameInput.value = "";
  });

  // Load existing configurations
  Object.entries(configurations).forEach(([name, config]) => {
    configGroupsContainer.appendChild(createConfigGroup(name, config));
  });

  // Migration of old configuration if it exists
  const oldConfig = await chrome.storage.sync.get([
    "forgejoUrl",
    "forgejoToken",
    "forgejoUser",
    "githubToken",
    "enableMirror",
    "mirrorInterval",
    "enableWiki",
    "enableLabels",
    "enableIssues",
    "enablePullRequests",
    "enableReleases",
    "private",
    "useOrganization"
  ]);

  if (oldConfig.forgejoUrl && Object.keys(configurations).length === 0) {
    const defaultName = "Default Configuration";
    const migratedConfig = {
      ...oldConfig,
      isActive: true
    };
    
    configurations[defaultName] = migratedConfig;
    await chrome.storage.sync.set({ 
      configurations,
      activeConfig: defaultName
    });
    
    // Clear old configuration
    await chrome.storage.sync.remove([
      "forgejoUrl",
      "forgejoToken",
      "forgejoUser",
      "githubToken",
      "enableMirror",
      "mirrorInterval",
      "enableWiki",
      "enableLabels",
      "enableIssues",
      "enablePullRequests",
      "enableReleases",
      "private",
      "useOrganization"
    ]);

    configGroupsContainer.appendChild(createConfigGroup(defaultName, migratedConfig));
  }
});
