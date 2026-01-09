# GitHub to Forgejo Mirror Extension - Copilot Instructions

This is a Chrome browser extension (Manifest V3) that enables users to easily mirror GitHub repositories to Forgejo instances with a single click. The extension is built with vanilla JavaScript without any build tools or frameworks.

## Project Type and Structure

This is a pure frontend browser extension with no build process or external dependencies. All code is directly loaded by Chrome's extension system.

### Key Files:
- `manifest.json` - Extension manifest defining permissions, scripts, and entry points
- `content.js` - Content script injected into GitHub pages to add mirror functionality
- `background.js` - Service worker handling extension lifecycle events
- `options.html` / `options.js` - Configuration page for managing Forgejo connections
- `popup.html` / `popup.js` - Extension popup showing connection status
- `styles.css` - Styles injected into GitHub pages

## Development Setup

**No build steps required!** This is a plain JavaScript extension.

### Installation for Development:
1. Open Chrome/Chromium browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the project root directory
5. The extension will be immediately available

### Testing:
- Manual testing is the primary method
- Visit GitHub repository pages to test the mirror button functionality
- Use the browser's Developer Tools Console to view logs from `content.js`
- Test configuration changes in the extension options page

### Debugging:
- Content script logs: Open any GitHub repo page and press F12
- Background script logs: Go to `chrome://extensions/` → Details → Service worker → Inspect
- Popup logs: Right-click extension icon → Inspect popup
- Options page logs: Right-click extension icon → Manage extension → Inspect views: options.html

## Code Standards and Conventions

### JavaScript Style:
- Use ES6+ features (classes, arrow functions, async/await, template literals)
- Use descriptive variable and function names
- Add comments in Chinese for complex logic (project uses Chinese comments)
- Use `console.debug`, `console.info`, `console.warn`, and `console.error` appropriately for logging
- Prefer `const` and `let` over `var`

### Chrome Extension Best Practices:
- Use Manifest V3 APIs (not V2)
- Use `chrome.storage.sync` for configuration persistence
- Always check permissions before making cross-origin requests
- Use `chrome.runtime.getURL()` for accessing extension resources
- Handle async storage operations with promises

### Code Organization:
- Keep single-responsibility classes (e.g., `GitHubForgejoMirror` in content.js)
- Use instance methods for class-specific functionality
- Use event delegation and proper cleanup for dynamic content
- Implement debouncing for frequent operations (e.g., URL change detection)

### GitHub Page Integration:
- Use GitHub's native CSS classes when possible (e.g., `btn`, `btn-sm`, `pagehead-actions`)
- Inject buttons using GitHub's existing DOM structure
- Match GitHub's visual style for seamless integration
- Handle GitHub's SPA navigation with MutationObserver

### API Patterns:
- Use `fetch` API for all HTTP requests
- Include proper error handling with try-catch blocks
- Always provide user feedback via notifications for async operations
- Check HTTP response status codes and handle errors appropriately

### Configuration Management:
- Support multiple configuration profiles
- Mark one configuration as "active" at a time
- Store configurations in `chrome.storage.sync` with structure:
  ```javascript
  {
    configurations: {
      "config-name": {
        forgejoUrl: "...",
        forgejoToken: "...",
        forgejoUser: "...",
        // other options
      }
    },
    activeConfig: "config-name"
  }
  ```

## Key Features to Preserve

1. **Button Injection**: Dynamically inject "Mirror to Forgejo" button on GitHub repo pages
2. **Multiple Configurations**: Support multiple Forgejo server configurations with one active
3. **Repository Status Check**: Check if repository already exists before enabling mirror button
4. **Organization Structure**: Optionally preserve GitHub organization structure in Forgejo
5. **Mirror Options**: Support configuring wiki, labels, issues, PRs, releases, private repos, mirror intervals
6. **Connection Testing**: Test Forgejo connection from options page
7. **SPA Navigation**: Handle GitHub's single-page app navigation properly

## Common Patterns in This Codebase

### Checking Repository Pages:
```javascript
isRepoPage() {
  const pathname = window.location.pathname;
  const repoPatterns = [
    /^\/[^/]+\/[^/]+\/?$/,
    /^\/[^/]+\/[^/]+\/tree\/[^/]+/,
    // etc.
  ];
  return repoPatterns.some(pattern => pattern.test(pathname));
}
```

### Getting Configuration:
```javascript
const config = await this.getConfig();
if (!config) {
  // Handle no configuration case
}
```

### Making API Calls to Forgejo:
```javascript
const response = await fetch(`${config.forgejoUrl}/api/v1/...`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `token ${config.forgejoToken}`
  },
  body: JSON.stringify(data)
});
```

### Showing User Notifications:
```javascript
this.showNotification("success", "Message here");
this.showNotification("error", "Error message");
```

## Testing Checklist

When making changes, verify:
- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Mirror button appears on GitHub repository pages
- [ ] Button doesn't appear on non-repository GitHub pages
- [ ] Configuration can be saved and loaded from options page
- [ ] Connection test works in options page
- [ ] Mirror operation creates repository on Forgejo
- [ ] Status check correctly identifies existing mirrors
- [ ] Notifications appear and disappear correctly
- [ ] Navigation between GitHub pages doesn't break the button
- [ ] Multiple configuration switching works correctly

## Security Considerations

- Never log or expose API tokens in console or error messages
- Store sensitive data only in `chrome.storage.sync`
- Validate all user inputs in configuration
- Use HTTPS for all Forgejo API communications
- Implement proper error handling to avoid leaking sensitive information
- Follow principle of least privilege for API token permissions

## Common Issues and Solutions

1. **Button not appearing**: Check if on a repository page, configuration exists, and is marked active
2. **Mirror failing**: Verify Forgejo URL accessibility, token permissions, and organization creation rights
3. **Button appearing multiple times**: Ensure proper initialization flag and duplicate checking
4. **Navigation issues**: Use MutationObserver with debouncing to handle GitHub's SPA navigation

## Future Enhancements

When adding new features, consider:
- Maintaining backward compatibility with existing configurations
- Adding appropriate user feedback for all operations
- Following existing code style and patterns
- Testing across different GitHub page types
- Documenting new configuration options in README
