# AGENTS.md

Chrome extension (Manifest V3) that injects a "Mirror to Forgejo" button on GitHub repo pages and calls Forgejo's migration API. Pure vanilla JavaScript — no build, no dependencies, no test or lint tooling.

## Verifying changes

There is no automated build or test. The only way to verify is to load the extension unpacked:

1. `chrome://extensions/` → enable Developer mode → "Load unpacked" → select this repo root.
2. After any file edit, click the reload icon on the extension card in `chrome://extensions/`, then reload the GitHub tab.
3. Logs live in three separate consoles — pick the right one:
   - `content.js`: F12 on any GitHub repo page.
   - `background.js`: `chrome://extensions/` → Details → "Service worker".
   - `popup.js` / `options.js`: right-click the popup → Inspect; options page via Details → "Extension options".

There is no offline/smoke-test harness. Manual testing against a real Forgejo instance (configured in the Options page with an active profile) is required to exercise the mirror flow.

## Architecture

Single content-script class `GitHubForgejoMirror` in `content.js` (instantiated at file end). Everything hangs off it.

- Injection target: `ul.pagehead-actions` (GitHub repo header). The button reuses GitHub's native `btn btn-sm` classes plus the custom `forgejo-mirror` class — do not add custom button styling; `styles.css` only styles the notification toasts and spinner.
- SPA handling: GitHub is a single-page app, so a `MutationObserver` + 200ms debounce (`setupUrlChangeListener`) re-runs `checkAndInit` on navigation. `isInitialized` is reset when the URL changes. Guard `this._checkingRepository` prevents duplicate status checks.
- Repo-page detection (`isRepoPage`) matches only `/owner/repo`, `/tree/...`, `/blob/...`, `/commits/...`. The button will not appear on other GitHub pages — this is intentional.
- Config shape: `chrome.storage.sync` holds `{ configurations: { <name>: {...} }, activeConfig: "<name>" }`. `getConfig()` returns `null` unless the active config has `forgejoUrl`, `forgejoToken`, and `forgejoUser`. It also applies defaults (e.g. `enableMirror`, `private`, `useOrganization` default true; `enableIssues`/`enablePullRequests`/`enableReleases` default false).
- Mirror call: `POST /api/v1/repos/migrate` with `clone_addr` = `https://github.com/<owner>/<repo>.git`. When `useOrganization` is set and the GitHub owner differs from the Forgejo user, `ensureOrganizationExists` creates the org first — a `422` is treated as success (org already exists).
- Status pre-check: `GET /api/v1/repos/<repoOwner>/<repo>`; 404 → "Ready to mirror", 200 → button disabled ("Already mirrored").

## Gotchas

- `manifest.json` `content_scripts.matches` is `https://github.com/*` (the README says `/*/*` — trust the manifest).
- `icons/forgejo.png` is referenced via `chrome.runtime.getURL` and must stay listed under `web_accessible_resources`.
- Token values are secrets: never log them or include them in error messages. They live only in `chrome.storage.sync`.
- Comments are written in Chinese; identifiers/log strings are English. Keep this convention.
- No LICENSE file exists yet.

## Existing instruction docs

`QWEN.md` and `.github/copilot-instructions.md` cover the same ground in more detail (English and Chinese respectively). Refer to them for the full feature list and file map; this file only records what agents tend to get wrong.

## Agent skills

### Issue tracker

GitHub Issues, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
