# Clipboard Formats

The three data formats react-grab writes to the clipboard on every copy operation.

---

## Format 1: text/plain

Raw text content. Used when pasting into plain text editors, terminals, chat inputs.

**Single item:**
```
<div class="card">
  <h2>Product</h2>
  <p>Description</p>
</div>
```

**Multiple items (numbered):**
```
[1]
<div class="card">
  <h2>Product</h2>
</div>

[2]
<button class="submit">Buy Now</button>
```

**With comment text (single item copy):**
```
fix the padding here

<div class="card" style="padding: 8px">
  ...
</div>
```

---

## Format 2: text/html

Same content as text/plain but HTML-escaped and wrapped in `<pre><code>`. Used when pasting into rich text editors (Google Docs, Notion, Slack) to preserve formatting.

```html
<meta charset='utf-8'><pre><code>&lt;div class=&quot;card&quot;&gt;
  &lt;h2&gt;Product&lt;/h2&gt;
&lt;/div&gt;</code></pre>
```

---

## Format 3: application/x-react-grab

Custom MIME type carrying structured JSON metadata. Not rendered by any paste target — consumed programmatically by AI agents, integrations, or react-grab itself.

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
      "content": "<button>Buy Now</button>",
      "commentText": null
    }
  ],
  "timestamp": 1711888888888
}
```

### ReactGrabMetadata fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | `string` | Package version at copy time |
| `content` | `string` | Full combined content (same as text/plain) |
| `entries` | `ReactGrabEntry[]` | Per-item structured data |
| `timestamp` | `number` | Unix timestamp of the copy |

### ReactGrabEntry fields

| Field | Type | Description |
|-------|------|-------------|
| `tagName` | `string?` | HTML tag name (`div`, `button`, etc.) |
| `componentName` | `string?` | React component name if available (`CardContent`) |
| `content` | `string` | This item's snippet content |
| `commentText` | `string?` | User's comment/prompt text for this selection |

---

## Fields NOT currently in the clipboard

| Field | Where it lives | Not in clipboard because |
|-------|---------------|------------------------|
| `groupId` | `CommentItem.groupId` | Groups didn't exist when format was designed |
| `groupName` | `SelectionGroup.name` | Same |
| `revealed` | `CommentItem.revealed` | Visibility state, not content |
| `elementSelectors` | `CommentItem.elementSelectors` | Internal implementation detail |
| `previewBounds` | `CommentItem.previewBounds` | Internal implementation detail |
