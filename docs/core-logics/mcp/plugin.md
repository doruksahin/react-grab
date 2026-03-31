# MCP Plugin (Browser Side)

The browser-side plugin that sends selection context to the local MCP server.

**File:** `packages/mcp/src/client.ts`

---

## Lifecycle

```
1. Page loads
2. attachMcpPlugin() runs (auto-invoked at module evaluation)
3. Health check: GET http://localhost:9320/health
   ├─ Reachable → register plugin with react-grab
   └─ Not reachable → silently skip (no MCP server running)
4. Plugin registered with two hooks:
   ├─ onCopySuccess
   └─ transformAgentContext
```

---

## Hooks

### onCopySuccess

**When:** User copies an element (click to select).

**What it sends:**

```typescript
POST http://localhost:9320/context
{
  "content": ["<div class='card'>...</div>"]  // single-element array
}
```

Sends just the copied text content. No prompt, no metadata.

### transformAgentContext

**When:** An agent session is active and context is being prepared for the agent.

**What it sends:**

```typescript
POST http://localhost:9320/context
{
  "content": ["<div>...</div>", "<button>...</button>"],  // multiple elements
  "prompt": "fix the padding here"                         // user's instruction
}
```

Sends the full agent context: all selected element contents + the user's prompt.

---

## Health Check Caching

The plugin caches the health check result in `sessionStorage` (`react-grab-mcp-reachable`). If the MCP server wasn't reachable on first check, it won't retry for the rest of the session. This avoids repeated failed fetch requests on every page load.

---

## Plugin Registration

The plugin attaches to react-grab via one of two methods:

1. `window.__REACT_GRAB__` exists → attach immediately
2. Listen for `react-grab:init` CustomEvent → attach when react-grab initializes

This handles both cases: plugin loads before or after react-grab.

---

## What is NOT Sent via MCP

| Data | Sent? | Why not |
|------|-------|---------|
| Element selectors | No | Internal implementation detail |
| Component names | No | Only in clipboard metadata, not in MCP context |
| Group info | No | Groups don't exist in MCP yet |
| Revealed state | No | Visibility UI state, not relevant to AI |
| Preview bounds | No | Rendering data, not content |
