# MCP Server

The local Node.js server that bridges browser selections to AI agents.

**File:** `packages/mcp/src/server.ts`

---

## How to Run

```bash
npx -y grab@latest add mcp
```

This configures the MCP server in the AI agent's MCP settings (e.g., Claude Code's `settings.json`).

**Default port:** 9320 (`packages/mcp/src/constants.ts`)

---

## Endpoints

### GET /health

Health check. Returns `{ "status": "ok" }`. Used by the browser plugin to check if the server is running.

### POST /context

Receives selection context from the browser plugin.

**Request body:**
```json
{
  "content": ["<div>...</div>", "<button>...</button>"],
  "prompt": "fix the padding"
}
```

**Validation:** Zod schema (`agentContextSchema`):
- `content`: `z.array(z.string())` — array of HTML snippets (required)
- `prompt`: `z.string().optional()` — user's instruction

**Storage:** Stored in memory as `latestContext` with a timestamp. Only one context at a time (latest wins). Auto-expires after `CONTEXT_TTL_MS`.

### /mcp

MCP protocol endpoint (Streamable HTTP). AI agents connect here via the MCP protocol to call tools.

Supports multiple sessions via `mcp-session-id` header.

---

## MCP Tool: get_element_context

**The only tool exposed to AI agents.**

```
Tool name: "get_element_context"
Parameters: none
Returns: formatted text of the latest context
```

**Behavior:**

1. If no context submitted → `"No context has been submitted yet."`
2. If context expired (TTL) → clears and returns same message
3. If context exists → returns formatted text, then **clears it** (one-shot read)

**Output format:**

```
Prompt: fix the padding here

Elements:
<div class="card" style="padding: 8px">
  <h2>Product</h2>
  <p>Description</p>
</div>

<button class="submit">Buy Now</button>
```

The `Prompt:` line is only included if the context has a prompt.

---

## Data Flow Timeline

```
t=0   User selects element in browser
t=0   Browser plugin POSTs to /context
t=0   Server stores in latestContext

t=?   User pastes into AI chat / triggers agent
t=?   AI agent calls get_element_context tool
t=?   Server returns context and clears it

t=TTL If agent never called → context expires automatically
```

---

## Key Design Decisions

1. **One-shot read.** Context is cleared after the first read. No stale context lingers.

2. **Latest-wins.** Multiple POSTs overwrite. No queue or history.

3. **TTL expiry.** Context auto-expires if the agent never reads it. Prevents stale data from old sessions.

4. **No authentication.** Local-only server (localhost). Trusts that only the browser plugin and local AI agent access it.

5. **Session per agent.** Each MCP connection gets its own session via `StreamableHTTPServerTransport`. Multiple agents can connect simultaneously.

---

## Limitations

- Only sends raw HTML text, not structured metadata (no component names, no groups)
- No history — latest context only
- No way for the agent to send results back to the browser
- No multi-element structure — all elements joined as flat text
