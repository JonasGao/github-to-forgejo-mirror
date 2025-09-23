# GitHub to Forgejo Mirror Extension Documentation

## Project Overview

This is a Chrome browser extension (Manifest V3) that enables users to easily mirror GitHub repositories to Forgejo instances with a single click. The extension injects a "Mirror to Forgejo" button on GitHub repository pages, allowing users to replicate their repositories on a Forgejo instance.

## Key Features

- Injects a "Mirror to Forgejo" button on GitHub repository pages
- Supports multiple Forgejo configuration profiles
- Configurable mirroring options including:
  - Wiki, Labels, Issues, PRs, Releases
  - Private repository support
  - Mirror interval settings
  - Organization structure preservation
- Connection testing functionality
- Status indicators in the extension popup

## Architecture

### File Structure

```
./
├─ icons/                Extension icons
├─ background.js         Service Worker (installation/uninstallation events)
├─ content.js            Content script that injects button on GitHub pages
├─ manifest.json         Extension manifest (Manifest V3)
├─ options.html          Extension options page UI
├─ options.js            Options page script for managing configurations
├─ popup.html            Toolbar popup UI (shows connection status, switches configs)
├─ popup.js              Popup script for status checking and config switching
├─ styles.css            Styles injected into GitHub pages for the button and notifications
└─ README.md             Project documentation (this file)
```

### Core Components

1. **Content Script (content.js)**:
   - Detects GitHub repository pages (matching `/owner/repo` patterns)
   - Injects a "Mirror to Forgejo" button into the page header
   - Handles the mirroring process by calling Forgejo's migration API
   - Manages configuration retrieval from storage
   - Provides user notifications

2. **Options Page (options.html + options.js)**:
   - Allows management of multiple Forgejo configuration profiles
   - Supports adding, renaming, deleting configurations
   - Provides testing for Forgejo connections
   - Configures mirroring options (wiki, labels, issues, etc.)

3. **Popup (popup.html + popup.js)**:
   - Shows current connection status
   - Allows switching between active configurations
   - Provides link to open options page

4. **Background Script (background.js)**:
   - Handles extension installation/uninstallation events

## Installation and Usage

### Installation Steps:
1. Open Chrome/Chromium browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select this project directory
5. Extension icon should appear in the toolbar

### Usage Steps:
1. Configure Forgejo connection details in the extension options page:
   - Forgejo Server URL (e.g., `https://forgejo.example.com`)
   - Forgejo API Token (with `repo` permissions)
   - Forgejo Username
   - Optional: GitHub API Token for private repositories
2. Choose which configuration to activate
3. Visit any GitHub repository page (e.g., `https://github.com/<owner>/<repo>`)
4. Click the "Mirror to Forgejo" button in the top right corner
5. Extension will call Forgejo's migration API to create the mirrored repository

## Technical Details

### Permissions Used:
- `storage`: For saving extension configurations
- `activeTab`: For injecting scripts on GitHub pages
- `host_permissions`: 
  - `https://github.com/*`: Access to GitHub repository pages
  - `<all_urls>`: Access to Forgejo servers

### Key Functions:

#### Content Script (`content.js`):
- `isRepoPage()`: Determines if current page is a GitHub repository page
- `getConfig()`: Retrieves active configuration from storage
- `createMirrorButton()`: Creates and inserts the mirror button
- `handleMirrorClick()`: Handles button click event and initiates mirroring
- `createForgejoMirror()`: Calls Forgejo's migration API
- `ensureOrganizationExists()`: Creates organization on Forgejo if needed
- `showNotification()`: Displays success/error messages to user

#### Configuration Management:
- Configurations are stored in `chrome.storage.sync`
- Each configuration includes:
  - Forgejo URL and credentials
  - Mirroring options (wiki, labels, etc.)
  - Repository settings (private, organization structure)
  - Activation status

### Browser Extension Flow:
1. Extension loads and registers content script for GitHub URLs
2. User navigates to a GitHub repository page
3. Content script detects repository page and injects "Mirror to Forgejo" button
4. User clicks the button
5. Content script retrieves active configuration
6. Script calls Forgejo's `/api/v1/repos/migrate` endpoint
7. Forgejo creates the mirrored repository
8. Success/failure is displayed to the user

## Development and Testing

### Debugging Tips:
- Open GitHub repository page and press F12 to view Console logs
- If button doesn't appear:
  - Ensure you're on a repository page with proper URL pattern
  - Check that configuration is properly set and marked as active
  - Verify host permissions allow access to your Forgejo URL
- If mirroring fails:
  - Check Forgejo URL is accessible
  - Ensure token has correct permissions
  - Verify target organization can be created

## Security Considerations

- Forgejo/GitHub tokens are stored locally in browser's `chrome.storage.sync`
- Extension only sends data to Forgejo servers specified in the configuration
- Recommend creating minimal-permission tokens for Forgejo

## License

License information not specified in the project. Consider adding a LICENSE file if open-sourcing.