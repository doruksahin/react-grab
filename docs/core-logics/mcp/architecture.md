# MCP Architecture

How react-grab connects to AI agents via Model Context Protocol.

---

## Mission

Give AI agents (Claude, Cursor, etc.) structured access to UI element selections made in the browser. Instead of the user manually describing what they see, they select elements visually, and the AI agent receives the HTML context + user prompt automatically.

---

## Components

```
Browser (react-grab)              Local Machine
────────────────────              ─────────────

  react-grab core                 MCP Server (Node.js)
    │                               │
    ├─ MCP Plugin (client.ts)       ├─ HTTP server (:9320)
    │   ├─ onCopySuccess hook       │   ├─ POST /context     ← receives context
    │   └─ transformAgentContext    │   ├─ GET /health       ← health check
    │                               │   └─ /mcp             ← MCP protocol endpoint
    └─ POST /context ──────────────→│
                                    ├─ MCP tool: "get_element_context"
                                    │   └─ Returns latest context to AI agent
                                    │
                              AI Agent (Claude Code, Cursor, etc.)
                                    │
                                    └─ Calls "get_element_context" tool
                                       └─ Gets: prompt + element HTML
```

---

## Two Paths for AI Consumption

react-grab has two mechanisms for sending data to AI. Only one is actively used.

### Path 1: MCP Server (ACTIVE)

The browser-side plugin sends context via HTTP to a local MCP server. AI agents read it via the MCP protocol.

```
Browser → HTTP POST /context → MCP Server → MCP tool → AI Agent
```

**Used when:** MCP server is running (`npx grab add mcp`), AI agent has the MCP connection configured.

### Path 2: Clipboard MIME Type (UNUSED)

A custom `application/x-react-grab` MIME type is written to the clipboard alongside `text/plain` and `text/html`. The idea was that a paste target could read the structured JSON.

```
Browser → clipboard → paste target reads application/x-react-grab → ???
```

**Status:** Written to clipboard but no consumer exists. No app or agent reads this MIME type. Only verified by an e2e test. Effectively dead code.

---

## Packages

| Package | Path | Role |
|---------|------|------|
| `react-grab` | `packages/react-grab/` | Core library — runs in browser, provides selection UI |
| `mcp` | `packages/mcp/` | MCP server + browser plugin — bridges browser to AI agents |
| `grab` (CLI) | `packages/grab/` | CLI tool — `npx grab init`, `npx grab add mcp` |
