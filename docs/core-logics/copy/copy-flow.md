# Copy Flow

How react-grab copies selections to the clipboard.

---

## Two Copy Paths

### 1. Single element copy (on selection)

Triggered when user selects an element and it gets copied.

```
User selects element
  └─ tryCopyWithFallback() (core/copy.ts:23)
       ├─ options.getContent?  → custom content generator (plugin)
       └─ else:
            ├─ generateSnippet(elements)
            │   └─ getElementContext(element) per element
            │   └─ Returns HTML/text snippet of each element
            ├─ transformSnippet(snippet, element) per snippet (plugin hook)
            ├─ joinSnippets(snippets) if multiple elements
            ├─ transformCopyContent(content, elements) (plugin hook)
            ├─ Prepend commentText if present: "comment\n\ncontent"
            └─ copyContent(finalContent, { componentName, entries })
```

### 2. Copy All (comments dropdown "Copy" button)

Triggered when user clicks the "Copy" button in the comments dropdown.

```
"Copy" button click
  └─ handleCommentsCopyAll() (core/index.tsx:3941)
       ├─ clearCommentsHoverPreviews()
       ├─ Get ALL commentItems()
       ├─ joinSnippets(items.map(item => item.content))
       ├─ copyContent(combinedContent, { componentName, entries })
       ├─ Show clear prompt (or auto-clear if confirmed)
       └─ Show "copied" labels on all elements (deferred to next frame)
```

---

## joinSnippets

**File:** `src/utils/join-snippets.ts`

```typescript
// Single item → content as-is
"<div class='card'>...</div>"

// Multiple items → numbered
"[1]\n<div class='card'>...</div>\n\n[2]\n<button>Submit</button>"
```

---

## copyContent

**File:** `src/utils/copy-content.ts`

Sets **three clipboard formats** simultaneously:

### text/plain
The raw content string. What you get when pasting into a text editor.

```
[1]
<div class="card">...</div>

[2]
<button onClick={...}>Submit</button>
```

### text/html
Same content escaped and wrapped for rich text editors.

```html
<meta charset='utf-8'><pre><code>[1]
&lt;div class=&quot;card&quot;&gt;...&lt;/div&gt;

[2]
&lt;button onClick={...}&gt;Submit&lt;/button&gt;</code></pre>
```

### application/x-react-grab (custom MIME type)
JSON metadata for machine consumption (e.g., AI agents, integrations).

```json
{
  "version": "0.1.29",
  "content": "[1]\n<div>...</div>\n\n[2]\n<button>...</button>",
  "entries": [
    {
      "tagName": "div",
      "componentName": "CardContent",
      "content": "<div class='card'>...</div>",
      "commentText": "hey"
    },
    {
      "tagName": "button",
      "componentName": "SubmitButton",
      "content": "<button>Submit</button>",
      "commentText": null
    }
  ],
  "timestamp": 1711888888888
}
```

---

## ReactGrabEntry (per-item metadata)

**File:** `src/utils/copy-content.ts`

```typescript
interface ReactGrabEntry {
  tagName?: string;
  componentName?: string;
  content: string;
  commentText?: string;
}
```

Each entry represents one selection. The `entries` array in the clipboard metadata gives consumers structured access to individual items without parsing the combined content string.

---

## Content Generation

### generateSnippet

**File:** `src/utils/generate-snippet.ts`

For each element, calls `getElementContext(element, options)` which extracts the HTML/text representation of the DOM element. Returns `Promise<string[]>` — one snippet per element.

### Plugin hooks in the copy pipeline

| Hook | When | Purpose |
|------|------|---------|
| `onBeforeCopy(elements)` | Before content generation | Prepare elements (freeze animations, etc.) |
| `transformSnippet(snippet, element)` | Per snippet | Modify individual element output |
| `transformCopyContent(content, elements)` | After join | Modify final combined content |
| `onAfterCopy(elements, didCopy)` | After clipboard write | Cleanup |
| `onCopySuccess(elements, content)` | On successful copy | Tracking, feedback |
| `onCopyError(error)` | On failure | Error handling |

---

## Copy mechanism (legacy)

Uses `document.execCommand("copy")` with a hidden textarea + `ClipboardEvent` handler. The event handler intercepts the copy event to set all three clipboard formats before the browser processes it.

```
1. Create hidden <textarea> with content
2. Register "copy" event listener on document
3. textarea.select()
4. document.execCommand("copy")
5. Event listener fires → sets text/plain, text/html, application/x-react-grab
6. Cleanup: remove listener + textarea
```

---

## What "Copy All" currently includes

- **ALL** comment items, unconditionally
- No filtering by group, revealed state, or disconnected state
- Items ordered by creation time (newest first, from `commentItems()`)
- Combined with `joinSnippets` (numbered `[1]`, `[2]`, etc.)
