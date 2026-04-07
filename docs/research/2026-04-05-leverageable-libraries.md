# Library Scan — Phase 3 JIRA Integration & Phase 4 Polish

> Researched: 2026-04-05. All npm download figures and publish dates are from that date.
> Purpose: Replace brittle hand-rolled code and assumption-backed stubs with verified, maintained libraries before Phase 3 implementation.

---

## Executive Summary

Three blocking issues found in the existing `2026-04-01-jira-integration-plan.md`:

| Issue | Severity | Fix |
|---|---|---|
| `jira.js` uses Axios → Node.js `http` transport, incompatible with Cloudflare Workers | **Blocker** | Drop `jira.js`, call JIRA REST API v3 directly with native `fetch` |
| `buildDescription` returns a plain string — JIRA v3 API requires an ADF object | **Blocker** | Add `marklassian` for markdown → ADF conversion |
| Kobalte portals hard-code `document.body` and have an open shadow DOM dismiss bug | **Risk** | Compose Solid's native `<Portal mount={shadowRoot}>` around Kobalte content with `forceMount={true}` |

---

## 1. JIRA Client — `jira.js` is not Workers-compatible

### Problem

`jira.js` (v5.x) lists `axios@^1.x` as a runtime dependency. In a Node.js context, Axios resolves to the `http`/`https` module as its transport. Cloudflare Workers does not have Node's `http`/`https`. The `nodejs_compat` flag does not cover this path.

No GitHub issues or PRs in the `MrRefactoring/jira.js` repo mention Cloudflare Workers, edge runtime, or fetch-based transport. The library targets "Node.js v20+ and modern browsers" — Workers is neither.

### Recommendation

**Drop `jira.js` entirely. Call the JIRA REST API v3 directly with native `fetch`.**

Workers has supported `FormData` + `Blob`/`File` for outgoing `fetch` since `compatibility_date = "2021-11-03"`. No third-party HTTP client is needed.

Auth header: `Authorization: Basic <base64(email:apiToken)>`

Key endpoints used in our plan:

```
GET  /rest/api/3/project/search          → list projects
GET  /rest/api/3/issuetype               → list issue types
GET  /rest/api/3/priority                → list priorities
POST /rest/api/3/issue                   → create issue (ADF description required)
POST /rest/api/3/issue/{key}/attachments → upload screenshot
  Headers: X-Atlassian-Token: no-check
  Body: FormData with field "file"
GET  /rest/api/3/issue/{key}?fields=status → poll status
```

For screenshot attachment:
```typescript
const form = new FormData();
form.append("file", new File([arrayBuffer], "screenshot.png", { type: "image/png" }));
// DO NOT set Content-Type manually — fetch sets boundary automatically
await fetch(`${baseUrl}/rest/api/3/issue/${key}/attachments`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${btoa(`${email}:${token}`)}`,
    "X-Atlassian-Token": "no-check",
  },
  body: form,
});
```

### Impact on existing plan

Task 1 (install `jira.js`) → removed.
Task 3 (`JiraService`) → rewrite using fetch, keep the same interface.
Task 4 (`inject-repos.ts`) → keep, but `JiraService` constructor is lighter (no `Version3Client`).

---

## 2. Description Format — JIRA v3 requires ADF, not plain text

### Problem

The `buildDescription` method in the existing plan returns a markdown string. The comment says "jira.js auto-converts plain text to ADF" — **this is wrong**.

The JIRA REST API v3 `description` field requires an ADF `Document` object:
```json
{ "version": 1, "type": "doc", "content": [...] }
```

Passing a plain string results in literal text stored without formatting. The `string | Document` union type in `jira.js` is a library-level escape hatch, not an auto-conversion feature.

### Library: `marklassian`

| Property | Value |
|---|---|
| npm | `marklassian` |
| Version | 1.2.1 |
| Weekly downloads | 27,051 |
| Last published | Mar 2026 (13 days before scan) |
| TypeScript | Built-in (no `@types/` needed) |
| Bundle size | 12.9 kB gzip |
| Dependencies | 1 (`marked`) |
| Cloudflare Workers safe | **Yes** — no Node built-ins |
| License | MIT |

**Do not use:**
- `md-to-adf` — abandoned 6 years ago, no TypeScript
- `adf-builder` — deprecated by Atlassian, not a markdown converter
- `@atlaskit/editor-markdown-transformer` — 29k downloads/week but pulls in the full Atlaskit + ProseMirror tree (~100+ kB gz), likely not Workers-safe

```typescript
import { markdownToADF } from "marklassian";

// In JiraService.buildDescription — return type changes to object
private buildDescription(userDescription: string, comments: ...[]): object {
  const markdown = [
    userDescription,
    "---",
    "## Selections",
    ...comments.map((c, i) => [
      `### ${i + 1}. ${c.componentName ?? c.elementName} <${c.tagName}>`,
      c.commentText ?? "",
      c.elementSelectors?.[0] ? `Selector: \`${c.elementSelectors[0]}\`` : "",
    ].filter(Boolean).join("\n")),
    "_Created by react-grab_",
  ].join("\n\n");

  return markdownToADF(markdown);
}
```

The returned object is passed directly to the JIRA API as `fields.description`.

**References:**
- https://www.npmjs.com/package/marklassian
- https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/

---

## 3. Shadow DOM — Kobalte portal limitation (Phase 3/4)

### Problem

Kobalte's `*.Portal` sub-components (Dialog, Select, Popover, DropdownMenu, Tooltip) hard-code `document.body` as their mount target. There is no `mount`, `container`, or `root` prop.

**Open bug — Kobalte Issue #445:** When a Kobalte trigger lives inside a shadow root, clicking it causes the overlay to close and reopen immediately. Root cause: `DismissableLayer` uses trigger ref exclusion to prevent dismiss-on-click, but Shadow DOM reports the shadow host as `event.target`, breaking the exclusion check. **Unresolved as of Oct 2025.**

corvu has the same portal limitation (hardcoded `document.body`), with no known open bugs but also no documented Shadow DOM support.

### Workaround

Use Kobalte (or corvu) content components with `forceMount={true}` and wrap them in Solid's native `<Portal>`, which has a `mount` prop that accepts any `Node`:

```tsx
import { Portal } from "solid-js/web";

// shadowRoot is the shadow root reference injected via context
<Portal mount={shadowRoot}>
  <Select.Content forceMount={true}>
    {/* ... */}
  </Select.Content>
</Portal>
```

This keeps Kobalte's accessibility tree and keyboard navigation intact while directing the portal to the correct shadow root. The dismiss bug (Issue #445) still needs a separate workaround — the current best option from the issue thread is `disableOutsidePointerEvents={true}` on the content component, or manually patching the `DismissableLayer` event target check.

**Log this as an assumption update:** A-004 should be updated to reflect this specific workaround and the open issue number.

### References
- https://github.com/kobaltedev/kobalte/issues/445
- https://corvu.dev/docs/utilities/focus-trap/

---

## 4. Positioning — `@floating-ui/dom` in Shadow DOM

### Problem

`@floating-ui/dom` has a known Shadow DOM `offsetParent` bug: when the anchor element is inside a shadow root, `offsetParent` lookup returns incorrect results (Chrome 109+, Safari, Firefox all implement the spec which triggers this).

### Fix

Two options, simplest first:

1. **`strategy: 'fixed'`** — bypasses `offsetParent` entirely. Works for most cases. Use this as the default for all floating elements inside the shadow root.

2. **`composed-offset-position` ponyfill** — for cases where `fixed` positioning doesn't work (e.g., scroll containers). Override the platform's `getOffsetParent` with the ponyfill. Works for open shadow roots (which is our case — web extension content scripts use open shadow roots by convention).

```typescript
import { computePosition, platform } from "@floating-ui/dom";
import { offsetParent } from "composed-offset-position";

computePosition(anchor, floating, {
  strategy: "fixed", // prefer this first
  platform: {
    ...platform,
    // fallback if fixed is insufficient:
    getOffsetParent: (el) => offsetParent(el),
  },
});
```

**References:**
- https://floating-ui.com/docs/platform (Shadow DOM section)
- https://www.npmjs.com/package/composed-offset-position

---

## 5. Focus Trap (Phase 4)

### Clarification

`@solid-primitives/focus-trap` **does not exist** — the solid-primitives collection has `active-element`, `autofocus`, and `keyboard` but no focus trap.

### Library: `solid-focus-trap`

| Property | Value |
|---|---|
| npm | `solid-focus-trap` |
| Maintained by | corvu team |
| Shadow DOM (open root) | **Works** — `event.composedPath()` traverses open shadow roots |
| Shadow DOM (closed root) | Needs manual `getShadowRoot` callback (not our case) |

Our shadow root is open (standard for web extensions), so `solid-focus-trap` works without special config.

**References:**
- https://www.npmjs.com/package/solid-focus-trap
- https://corvu.dev/docs/utilities/focus-trap/

---

## 6. Action Items Before Phase 3

| Item | File to update | Change |
|---|---|---|
| Remove `jira.js` from plan | `docs/plans/2026-04-01-jira-integration-plan.md` | Replace Task 1 and Task 3 with fetch-based approach |
| Add `marklassian` to plan | `docs/plans/2026-04-01-jira-integration-plan.md` | `buildDescription` returns ADF object, not string |
| Update A-004 | `docs/assumptions.md` | Kobalte workaround: `forceMount` + Solid `<Portal mount>`, Issue #445 |
| Add to risks | `docs/risks.md` | Kobalte Issue #445 (dismiss loop) has no upstream fix ETA |
| New assumption | `docs/assumptions.md` | `strategy: 'fixed'` resolves floating-ui shadow DOM positioning for our case |
