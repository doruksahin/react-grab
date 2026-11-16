---
date: '2026-11-15'
references:
- ADR-0020
status: accepted
---

# ADR-0023 Run the overlay with sync on any site through the browser extension

## Context and Problem Statement

We want to use the overlay on any site we open, including deployed ones such as `https://cognograph.doruk.uk`, with comments, screenshots, recordings and Jira. We do not want to change that site's code.

Today the overlay reaches the sync server only through `initSync({ serverUrl, apiToken })` in a host app's dev build (ADR-0020). On any other site this fails four ways:

- **CORS.** Each new site must be added to the Worker's `ALLOWED_ORIGINS` and the Worker redeployed.
- **Token exposure.** The token sits in page JavaScript, where any script on the page can read it.
- **CSP.** A site with a strict Content-Security-Policy blocks a pasted or localhost script.
- **Manual setup.** Someone has to paste the code into the console on every visit.

`packages/web-extension` already injects the overlay into every page in the MAIN world, but it never calls `initSync`. It is built with `vite-plugin-web-extension`. That plugin's README says it will be deprecated in favour of WXT, its successor.

In the overlay, server calls are only partly behind a port:

- `StorageAdapter` (`features/sync/types.ts`) is domain-shaped and bound to one workspace. It covers comments, groups and uploads. Its only implementation is `createHttpAdapter`, which `connect()` builds directly.
- Jira calls, the site lookup, ticket polling and the authenticated screenshot GET import generated Orval functions or call `fetch` directly.
- The Orval mutator (`generated/custom-fetch.ts`) keeps the base URL and the token in module state.
- Orval 8.6.2's fetch client applies `JSON.stringify` to every body that is not form-data, url-encoded or plain text. So the screenshot and recording uploads, which are binary, use raw `fetch` on purpose.

## Considered Options

1. **Console snippet or bookmarklet, plus an `ALLOWED_ORIGINS` entry per site.** Keeps every problem above.
2. **The extension calls `initSync` in the MAIN world with the token.** The requests still carry the page's origin, so CORS still needs every site added, and the page can still read the token.
3. **The extension service worker as a generic fetch proxy.** The page sends a URL and a body, and the service worker adds the token. This solves CORS and hides the token. But Chrome's guidance warns against it: a content script must not be able to make the extension request an arbitrary URL. A swap at the Orval mutator would be exactly this kind of proxy.
4. **The service worker as a gateway for the overlay's domain ports.**
   - The overlay reaches the server only through two domain ports.
   - In the extension, a port call is forwarded by method name.
   - The service worker runs the HTTP implementation of the same ports, with the server URL, token and workspace taken from its own settings.

## Decision Outcome

**Option 4.** It removes all four problems, follows the browser vendor's guidance and needs no server change. The custom code is the gateway policy and the wiring. Build, messaging and storage come from libraries.

### Bounded contexts

| Context | Package | Owns |
|---|---|---|
| Overlay | `react-grab` | selections, comments, groups, Jira UI; the ports `StorageAdapter` and `JiraPort` |
| Sync transport | `react-grab/sync-http` (new subpath export, no Solid, no DOM) | the HTTP implementation of both ports, on the Orval client (ADR-0003) |
| Extension host | `web-extension` | settings, site trust, the gateway that holds the token |

### Overlay: domain ports, one HTTP implementation

- **`StorageAdapter`** stays the storage port. It gains `loadScreenshot(id, kind): Promise<Blob>`, so `useAuthenticatedImageUrl` calls the port instead of comparing URLs with `getApiBaseUrl()`.
- **`JiraPort`** is a new domain port. It covers site, issue types, priorities, labels, ticket status, create ticket, add comment and search users. The Jira calls in `core/index.tsx`, `sync-layer.ts` and `jira-create-form.tsx` take it as a dependency.
- Port methods return domain values or throw. `{ data, status, headers }`, `RequestInit` and `AbortSignal` never cross a port. These types cannot be structured-cloned, and status checks belong in the implementation.
- **`react-grab/sync-http`** holds `createHttpAdapter` and `createHttpJiraPort`. They take `{ serverUrl, apiToken, workspace }`, use the generated Orval functions, and share one request helper for URL and auth.
  - That helper replaces the module state in `custom-fetch.ts`.
  - The three binary calls (screenshot PUT and GET, recording PUT) use the same helper with a raw body, because Orval cannot send or read binary bodies here.
- **`initSync`** accepts optional `storage` and `jira` ports. When they are absent, it builds the HTTP ones from `serverUrl` and `apiToken`, so host apps (ADR-0020) are unchanged.

### Extension: WXT, typed messaging, typed storage

| Concern | Choice | Source |
|---|---|---|
| Build, manifest, entrypoints, options page | WXT 0.21 + `vite-plugin-solid`. `@wxt-dev/module-solid` adds a solid-js auto-import even with imports off, which broke the overlay bundle | vite-plugin-web-extension README; wxt.dev |
| Per-site injection | `defineContentScript({ registration: "runtime", world: "MAIN" })`, registered when a site is enabled; `optional_host_permissions` requested then | WXT content scripts guide; Chrome `scripting`, `permissions` |
| MAIN ↔ ISOLATED | `@webext-core/messaging` CustomEvent messenger, with a fixed namespace. It works only within one document, so iframes cannot send. The window messenger was rejected: version 4.0.1 never checks `event.source`. A `Blob` passes (verified in the extension E2E test) | webext-core.aklinker1.io/messaging |
| ISOLATED ↔ service worker | `@webext-core/messaging` extension messenger, with `"message_serialization": "structured_clone"` and `minimum_chrome_version: "148"` | Chrome *Structured clone messaging* |
| Settings | `@wxt-dev/storage` items in `storage.local`: server URL, token, and a map from site origin to `{ workspace, jiraProjectKey }` | wxt.dev/storage |

- **Protocol.** The message protocol type is derived from the two port interfaces (method → parameters and return type). It is not written by hand. The allowlist is the ports' method names.
- **Gateway policy (service worker):**
  - **Sender:** `sender.id === browser.runtime.id`. The origin comes from `sender.origin` and must be an enabled site. Top frame only: `allFrames` is off.
  - **Workspace:** taken from the settings for that origin. The service worker builds `createHttpAdapter({ serverUrl, apiToken, workspace })` per request, so the protocol has no workspace or URL field.
  - **Settings:** read on every request, never cached in module state. An MV3 service worker restarts often, and a rotated token must take effect at once.
  - **Server URL:** it is a setting, so its origin is requested as an optional host permission. Requests from the service worker then need no CORS.
- **Lifecycle:**
  - **Disabling a site** unregisters its script and removes its permission (`permissions.onRemoved` is also handled). Tabs already open keep the injected script, but the gateway refuses their calls.
  - **Changing a site's workspace** tells that site's open tabs to reload.
- **Manifest:** the static `content_scripts` and `host_permissions: ["<all_urls>"]` are removed.
- **Token access:**
  - Only the service worker reads the token.
  - The ISOLATED relay is extension code, not page code, so it would not leak the token even if it could read `storage.local`.
  - Restricting `storage.local` with `setAccessLevel` is checked against Chrome's reference in step 3 and applied if supported.
- **Existing extension messages** (toggle, toolbar state) move to the same messengers, and the hand-written `postMessage` bridge is removed.

### Hardening found in review (step 3)

- **Path parameters.** Orval encodes every path parameter (`urlEncodeParameters`, Orval 8.44.0, pinned because 8.46 needs TypeScript 6). The request helpers also refuse `.` and `..` segments, which `encodeURIComponent` leaves unchanged. Without this, a page could reach another workspace with `../`.
- **Arguments.** The gateway validates every argument with one zod tuple per port method. These are built from the Orval-generated zod schemas and exported by `react-grab/sync-http`. The same records are the method allowlist.
- **Jira project.** The gateway always passes the site's `jiraProjectKey`, whatever the page sends.
- **Server URL.** It must be https; http is allowed only for localhost, 127.0.0.1 and [::1]. Userinfo, query and fragment are refused.
- **Localhost.** The extension starts no overlay and no sync of its own on localhost; the host app owns both (ADR-0020). Adopting a host app's overlay later cannot stop the extension's own `initSync` copy.
- **Settings writes.** The service worker is the only writer and uses one serial queue, which script registration shares.

### Trust boundary

Every script on an enabled site runs in the same MAIN world as the overlay, including third-party tags. Any of them can send the namespaced messages. On that site they can then:

- read and change the site's workspace;
- create Jira tickets.

They cannot:

- read the token;
- choose a URL;
- reach another site's workspace.

So we enable only sites we trust. Per-site capabilities (read-only, Jira allowed or not) are a later extension of the settings and need no change to the protocol.

### Scope

- Chrome only. WXT keeps a Firefox build cheap later (`gecko.id`, `sender.url` instead of `sender.origin`).
- The server is unchanged; the CORS allowlist stays as it is.
- **ADR-0020 amendment:** the token may also live in the extension's storage on the user's machine. It is still never in page JavaScript or a shipped bundle.

### Consequences

- **Good:**
  - Works on any site, including sites with a strict CSP, with no Worker change per site.
  - The page cannot read the token or choose a URL or workspace.
  - Every server call goes through two domain ports, so tests can replace them whole, as PRD-012 aims.
  - The extension moves to the maintained successor of its build tool.
- **Bad:**
  - New dependencies: WXT, `@wxt-dev/module-solid`, `@webext-core/messaging`, `@wxt-dev/storage`.
  - The extension joins `build`, `lint`, `typecheck` and CI.
  - Chrome 148 or newer is required.
- **Neutral:**
  - `react-grab` gets a second tsup entry, `sync-http`.
  - Moving `jiraProjectKey` into the server's workspace data would leave the extension holding only the site-to-workspace map. That change is not part of this ADR.

### Rollout

Each step is reviewed for SRP, DRY and layers, and the findings are fixed, before the next step starts.

1. **Overlay ports:**
   - `JiraPort`, plus `loadScreenshot` on `StorageAdapter`;
   - `react-grab/sync-http` with the shared request helper;
   - `initSync({ storage?, jira? })`;
   - a changeset.
   - `e2e/mocked/item-writes.spec.ts` (every request carries the token) and the sync tests stay green.
2. **Extension on WXT,** with today's behaviour: toggle and toolbar state on the new messengers. The extension is added to Turbo and CI.
3. **Settings, site trust and gateway:**
   - unit tests for the gateway policy;
   - one Playwright test that loads the extension (`launchPersistentContext`, `channel: "chromium"`) against the mocked server.
4. **Docs and live check:**
   - `architecture.yml` (package entry and feature, then `arch:codegen` and `arch:lint`);
   - the cheatsheet;
   - a live check on `cognograph.doruk.uk`.

All four steps are done (2026-11-16). The live check passed on `cognograph.doruk.uk`. The cheatsheet and `docs/features/getting-back-to-a-selection.md` describe the extension and the features built on it (ADR-0024 to ADR-0026).

### Sources

- Chrome, *Cross-origin network requests*: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Chrome, *Message passing*: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- Chrome, *Structured clone messaging*: https://developer.chrome.com/blog/structured-clone-messaging
- Chrome, `chrome.storage`: https://developer.chrome.com/docs/extensions/reference/api/storage
- vite-plugin-web-extension README (successor is WXT): https://github.com/aklinker1/vite-plugin-web-extension
- WXT content scripts (MAIN world, runtime registration): https://wxt.dev/guide/essentials/content-scripts
- `@webext-core/messaging`: https://webext-core.aklinker1.io/messaging/installation
- Orval 8.6.2 fetch generator, which stringifies non-form bodies: `node_modules/.pnpm/@orval+fetch@8.6.2*/dist/index.mjs`
- Playwright, *Chrome extensions*: https://playwright.dev/docs/chrome-extensions
- React DevTools dynamic content scripts: https://github.com/facebook/react/blob/main/packages/react-devtools-extensions/src/background/dynamicallyInjectContentScripts.js
