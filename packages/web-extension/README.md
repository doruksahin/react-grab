# React Grab browser extension

The extension runs the React Grab overlay, with sync, on sites you enable. You do not have to change the site's code. The design is in [ADR-0023](../../decree/adr/0023-overlay-on-any-site-through-the-browser-extension.md).

Chrome 148 or newer is necessary.

## Install

1. Build the extension:

   ```bash
   pnpm extension:build
   ```

2. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select `packages/web-extension/dist/chrome-mv3`.

To make a ZIP for the Chrome Web Store, run `pnpm --filter @react-grab/web-extension package`. The ZIP goes to `dist/`.

## Configure

1. Right-click the extension icon and click **Options**.
2. Under **Sync server**, enter the server URL and the API token, then click **Save server**. Chrome asks for access to the server's origin. Accept it.
3. Under **Enable a site**, enter the site address, the workspace and the Jira project key, then click **Enable site**. Chrome asks for access to the site. Accept it.
4. Open or reload the site. The overlay starts and loads the workspace's comments.

To get the token, see "Environment variables" in the root `CLAUDE.md`. Do not put the token in a file in this repository.

To change a site's workspace, enable the site again with the new values. Open tabs of that site reload. To stop the overlay on a site, click **Disable** next to it. Open tabs of that site reload and the extension gives back its access to that site.

On a `localhost` site the host app owns the overlay and its sync (`initSync` with its own token, ADR-0020). The extension then only relays the enabled flag and the toolbar state; it starts no overlay and no sync of its own there.

Clicking the extension icon turns the overlay's enabled flag on or off. The badge shows **OFF** when it is off.

## How it works

| Part                              | Runs in                         | Does                                                                                                                                    |
| --------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/overlay/`                    | the page (MAIN world)           | starts the overlay and calls `initSync` with ports that send messages                                                                   |
| `src/relay/`                      | content script (ISOLATED world) | forwards only the allowed requests to the service worker                                                                                |
| `src/gateway/`, `src/background/` | service worker                  | checks the sender, reads the settings, calls the sync server with the token                                                             |
| `src/site-trust/`                 | service worker                  | registers the two content scripts for enabled sites only                                                                                |
| `src/settings/`                   | service worker and options page | stores the server URL, the token and the sites (validated with zod); site changes are written only by the service worker, one at a time |
| `src/options/`                    | options page                    | the settings UI (Solid)                                                                                                                 |

The page never gets the token. A script on an enabled site can send the same messages as the overlay. It can then read and change that site's workspace and create Jira tickets. It cannot read the token, choose a URL or reach another site's workspace. Enable only sites you trust.

## Develop and test

```bash
pnpm --filter @react-grab/web-extension dev        # WXT dev mode
pnpm --filter @react-grab/web-extension test       # unit tests (vitest, fake-browser)
pnpm --filter @react-grab/web-extension test:e2e   # builds the e2e variant and runs Playwright
```

The Playwright tests load `dist/chrome-mv3-e2e`. That build has `host_permissions` for the test origins, because a test cannot click Chrome's permission prompt. The production build has no `host_permissions`.
