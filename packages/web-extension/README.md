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

1. Click the extension icon and click **Settings**. Until everything is set up, a checklist at the top links to each step, in the order they depend on each other.
2. Under **Sync server**, enter the server URL and the API token, then click **Save server**. Chrome asks for access to the server's origin. Accept it. If you set up Jira for your team, also enter the **admin token** (`SYNC_ADMIN_TOKEN`, ADR-0027). Only the service worker reads it.
3. With the admin token, **Jira accounts** shows: enter a Jira Cloud site, an email and an API token, then click **Connect**. The server signs in to Jira before it saves the account, and never shows the token again. Create the token at id.atlassian.com → Security → API tokens. Tickets are created as that account.
4. In **Sites**, open **Enable a site**, enter the site address and choose its workspace. With the admin token, choose **New workspace…** to name one and pick its Jira account and project; an existing workspace shows where its tickets go. Without the admin token, type the workspace name: the server's workspaces are suggested. Click **Enable site**. Chrome asks for access to the site. Accept it. Optionally select:
   - **Record steps**: each new comment saves the clicks and field changes that led to it, as Chrome DevTools Recorder steps (ADR-0025). Typed values are never saved.
   - **Record session**: each new comment links a replay of the last minutes (ADR-0021). Inputs are masked.

   Both are off by default.
5. Open or reload the site. The overlay starts and loads the workspace's comments.

To get the token, see "Environment variables" in the root `CLAUDE.md`. Do not put the token in a file in this repository.

A menu on the left lists the sections: Sync server, Sites, Workspaces and Jira accounts. It shows one section at a time, and the address keeps the section (`#sites`). Each row links to the row it uses: a site to its workspace, a workspace to its Jira account, an account to the workspaces that use it. A link opens the section that holds the row. The forms for a new Jira account and a new site open from their section. Workspaces and where their tickets go are listed with the API token alone, so a teammate without the admin token sees them read only. "Your sites" counts only the sites enabled in this browser.

To send a workspace's tickets elsewhere, click **Edit** next to it under **Workspaces**. Only new tickets move: a ticket is always read through the account that created it.

To change a site's workspace or what it records, enable the site again with the new values. Open tabs of that site reload. To stop the overlay on a site, click **Disable** next to it. Open tabs of that site reload and the extension gives back its access to that site.

On a `localhost` site the host app owns the overlay and its sync (`initSync` with its own token, ADR-0020). The extension then only relays the enabled flag and the toolbar state; it starts no overlay and no sync of its own there.

Clicking the extension icon opens a small popup: its **Overlay on** switch turns the overlay on or off, and **Settings** opens the options page. When the site in the current tab is not enabled, the popup says so, and **Add this site** opens the **Enable a site** form with that site's address filled in, in the settings tab that is already open if there is one. Turning it off removes the overlay and stops its sync in every open tab. The badge shows **OFF** when it is off.

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

## Releases

The extension is versioned by [release-please](https://github.com/googleapis/release-please) from Conventional Commits. You do not edit the version or the changelog by hand.

1. Give the PR a Conventional Commit title. The `PR Title` check enforces it. PRs are squash-merged, so the title becomes the commit that release-please reads. A `fix` makes a patch release, a `feat` a minor one. A `!` after the type (`feat!:`) is a breaking change: while the version is below 1.0.0 it makes a minor release. `chore`, `docs`, `test` and `ci` make no release.
2. release-please keeps a Release PR open with the next version and its `CHANGELOG.md` entries. Only commits that change files under `packages/web-extension` count.
3. Merge the Release PR to release. It tags `web-extension-v<version>`, creates a GitHub release and attaches the Chrome ZIP. The settings page shows the installed version next to its title.

## Develop and test

```bash
pnpm --filter @react-grab/web-extension dev        # WXT dev mode
pnpm --filter @react-grab/web-extension test       # unit tests (vitest, fake-browser)
pnpm --filter @react-grab/web-extension test:e2e   # builds the e2e variant and runs Playwright
```

The Playwright tests load `dist/chrome-mv3-e2e`. That build has `host_permissions` for the test origins, because a test cannot click Chrome's permission prompt. The production build has no `host_permissions`.
