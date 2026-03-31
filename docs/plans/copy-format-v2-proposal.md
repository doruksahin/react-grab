# Copy Format v2 — Proposal

## Problem

Current copy format is flat and unaware of groups, reveal state, or element connectivity. "Copy All" copies everything unconditionally.

## New Copy Rule

**Copy only items where:**
1. `revealed === true`
2. Element is connected (not in `disconnectedItemIds`)

If no items match → copy nothing (button disabled or no-op).

---

## Clipboard: text/plain

### Multi-group (2+ groups with items)

```
## Default
[1] fix the padding
<div class="card" style="padding: 8px">
  <h2>Product</h2>
</div>

## Navigation
[2] check this link
<nav class="main-nav">
  <a href="/">Home</a>
</nav>

[3]
<button class="submit">Submit</button>
```

### Single group (skip header)

```
[1] fix the padding
<div class="card">...</div>

[2]
<button>Submit</button>
```

### Single item (skip header + numbering)

```
fix the padding

<div class="card">...</div>
```

### Rules

- `## GroupName` headers only when 2+ groups have items
- `[N] commentText` inline — comment on same line as number
- `[N]` without comment if `commentText` is empty
- Single item skips numbering entirely (current behavior preserved)
- Empty groups omitted
- Items ordered by creation time within each group

---

## Clipboard: text/html

Same content as text/plain, wrapped in `<pre><code>`. No change to wrapping logic, only the content changes.

---

## Clipboard: application/x-react-grab

### Current (flat, unused)

```json
{
  "version": "0.1.29",
  "content": "...",
  "entries": [...],
  "timestamp": 1711888888888
}
```

### Proposed (group-aware)

```json
{
  "version": "0.2.0",
  "groups": [
    {
      "name": "Default",
      "entries": [
        {
          "tagName": "div",
          "componentName": "CardContent",
          "content": "<div class='card'>...</div>",
          "commentText": "fix the padding"
        }
      ]
    },
    {
      "name": "Navigation",
      "entries": [
        {
          "tagName": "nav",
          "componentName": "NavBar",
          "content": "<nav>...</nav>",
          "commentText": "check this link"
        },
        {
          "tagName": "button",
          "componentName": "SubmitButton",
          "content": "<button>Submit</button>",
          "commentText": null
        }
      ]
    }
  ],
  "timestamp": 1711888888888
}
```

No top-level `content` or `entries`. Groups are the source of truth.

---

## MCP: POST /context

### Current

```json
{
  "content": ["<div>...</div>"],
  "prompt": "fix the padding"
}
```

### Proposed

```json
{
  "groups": [
    {
      "name": "Default",
      "entries": [
        {
          "componentName": "CardContent",
          "content": "<div>...</div>",
          "commentText": "fix the padding"
        }
      ]
    },
    {
      "name": "Navigation",
      "entries": [
        {
          "componentName": "NavBar",
          "content": "<nav>...</nav>",
          "commentText": "check this link"
        }
      ]
    }
  ]
}
```

No top-level `content` or `prompt`. Each entry has its own `commentText`.

### Server changes

- `agentContextSchema`: replace `content` + `prompt` with `groups` array
- `formatContext`: read from `groups[].entries[]` instead of flat `content[]`
- `get_element_context` tool: format output with group headers

### Formatted output to AI agent

```
## Default

[1] fix the padding
CardContent:
<div class="card">...</div>

## Navigation

[2] check this link
NavBar:
<nav>...</nav>

[3]
SubmitButton:
<button>Submit</button>
```

---

## UI Changes

### "Copy" button in dropdown header

- Label: `Copy (N)` where N = count of revealed + visible items
- Label: `Copy` when no filtering (all items revealed + visible)
- Disabled (grayed out) when N = 0

### Per-group copy button

- New button in `GroupCollapsible` header (alongside eye toggle)
- Copies only revealed + visible items in that group
- Same format but single-group (no `## GroupName` header)

---

## Files Affected

| File | Change |
|------|--------|
| `src/utils/copy-content.ts` | New `ReactGrabMetadata` format with `groups`, new `joinGroupedSnippets` |
| `src/utils/join-snippets.ts` | New `joinGroupedSnippets(groups)` function |
| `src/core/index.tsx` | `handleCommentsCopyAll` filters by revealed + connected, groups items |
| `src/components/comments-dropdown.tsx` | Copy button label shows count |
| `src/features/selection-groups/components/group-collapsible.tsx` | Per-group copy button |
| `packages/mcp/src/server.ts` | New `agentContextSchema`, updated `formatContext` |
| `packages/mcp/src/client.ts` | `onCopySuccess` sends grouped format |
| `packages/react-grab/e2e/selection.spec.ts` | Update clipboard metadata test |
