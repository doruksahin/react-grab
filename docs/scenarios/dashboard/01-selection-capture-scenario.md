# Selection Capture Scenario

## What happens today

A user selects an element in the host app. react-grab stores a `CommentItem`:

```ts
{
  id: "c-abc123",
  groupId: "g-default",
  content: "<div class=\"text-text2 flex...\" data-testid=\"CardDescription\">...</div>",
  elementName: "CardDescription",
  tagName: "div",
  componentName: "CardDescription",
  elementsCount: 1,
  previewBounds: [{ x, y, width, height }],
  elementSelectors: ["[data-testid='CardDescription']"],
  commentText: "Let AI craft authentic human-style videos for your brand.",
  timestamp: 1743400000000,
  revealed: true
}
```

This gets persisted via the `StorageAdapter` — today that means `PUT /workspaces/:id/comments` with the full array, stored as a flat JSON file on disk.

## What we want to capture

A selection should be a richer artifact — not just what was selected, but the full context needed to understand and act on it.

### 1. Core selection (exists today)

What it is, where it is, what the user said about it.

- Element HTML snapshot (`content`)
- CSS selectors for re-highlighting
- Component name + tag name
- User's comment text
- Group assignment
- Timestamp

### 2. Screenshots (new)

Visual proof. Two captures per selection:

| Screenshot | Purpose |
|---|---|
| **Full page** | Where on the page is this element? What's the surrounding context? |
| **Element crop** | What does the element itself look like, exactly? |

Stored as blobs (PNG) in R2. The selection record holds URLs, not image data.

```
screenshot_full_page:  "screenshots/{selection-id}/full.png"
screenshot_element:    "screenshots/{selection-id}/element.png"
```

### 3. React ancestor chain (new — we have the primitives)

The component tree above the selected element. react-grab already walks the fiber tree via `getComponentNamesFromFiber()` in `core/context.ts` — it traverses parent fibers and collects display names.

Today this is used only for the UI label. We'd serialize and persist it:

```
react_ancestors: ["App", "Layout", "Dashboard", "CardGrid", "Card", "CardDescription"]
```

This tells a developer exactly where in the component tree the element lives — without opening devtools.

### 4. Source location (exists partially)

react-grab already resolves component names and can include file paths when instrumentation is active (e.g. via babel plugin). When available:

```
source_location: "src/adc-ui/card/card-description/card-description.tsx:38"
```

### 5. Impair state dump (new — plugin-based)

Internal app state snapshot at the moment of capture. This is app-specific — connected via react-grab's plugin system. Not a core concern; the selection just stores whatever the plugin provides as an opaque JSON blob.

```
impair_state: { /* whatever the plugin captures */ }
```

### 6. JIRA link (new — added later by dashboard)

Not captured at selection time. Added when a PM creates a ticket from the dashboard.

```
jira_ticket_id: null          // at capture time
jira_ticket_id: "PROJ-456"   // after PM creates ticket
```

---

## The capture flow

```
User clicks element in host app
  │
  ├─ 1. react-grab builds CommentItem (exists today)
  │     - element HTML, selectors, component name, comment text
  │
  ├─ 2. Capture full-page screenshot (new)
  │     - html2canvas / dom-to-image or similar
  │     - Upload PNG to R2 → get URL
  │
  ├─ 3. Capture element screenshot (new)
  │     - Crop from full-page or capture element directly
  │     - Upload PNG to R2 → get URL
  │
  ├─ 4. Walk react fiber tree (primitives exist)
  │     - getComponentNamesFromFiber() already does this
  │     - Serialize ancestor chain as string[]
  │
  ├─ 5. Collect impair state dump (new — plugin hook)
  │     - Plugin provides opaque JSON
  │
  └─ 6. Persist selection to D1
        - Structured fields → selections table
        - Screenshot URLs → reference R2 keys
        - Ancestor chain + state dump → JSON columns
```

## Proposed data shape

What a fully-captured selection looks like:

```ts
interface Selection {
  // identity
  id: string;
  workspace_id: string;
  group_id: string;

  // the element
  element_html: string;
  element_selectors: string[];
  tag_name: string;
  component_name: string | null;
  source_location: string | null;

  // context
  comment_text: string | null;
  react_ancestors: string[];        // new
  impair_state: Record<string, unknown> | null;  // new, plugin-provided

  // visuals (R2 references)
  screenshot_full_page: string | null;   // new
  screenshot_element: string | null;     // new

  // page context
  page_url: string;
  page_title: string;

  // lifecycle
  status: "open" | "ticketed" | "resolved";
  jira_ticket_id: string | null;
  captured_by: string | null;
  captured_at: number;

  // sync
  revealed: boolean;
}
```

## What exists vs what's new

| Field | Status | Where it comes from |
|---|---|---|
| element HTML, selectors, tag, component | **Exists** | `CommentItem` fields |
| comment text | **Exists** | `CommentItem.commentText` |
| group assignment | **Exists** | `CommentItem.groupId` |
| component name resolution | **Exists** | `getComponentDisplayName()` in `core/context.ts` |
| fiber tree walking | **Exists** (not persisted) | `getComponentNamesFromFiber()` in `core/context.ts` |
| source location | **Partial** | Available when instrumentation is active |
| full-page screenshot | **New** | Need capture + R2 upload |
| element screenshot | **New** | Need capture + R2 upload |
| impair state dump | **New** | Plugin hook, app-specific |
| page URL / title | **New** (trivial) | `window.location.href`, `document.title` |
| JIRA link | **New** | Written by dashboard, not widget |
| status lifecycle | **New** | Dashboard manages transitions |
| captured_by | **New** | Needs identity (even just a display name) |
