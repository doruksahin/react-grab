# react-grab + inspector-log Integration Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    react-grab (UX layer)                     │
│                                                              │
│  ┌──────────┐   ┌───────────┐   ┌────────────────────────┐  │
│  │ Element   │──▶│ Selection │──▶│ Agent Manager           │  │
│  │ Detection │   │ UI        │   │ (WebSocket → Claude)    │  │
│  └──────────┘   └───────────┘   └──────────┬─────────────┘  │
│                                             │                │
│                              transformAgentContext hook       │
│                                             │                │
│  ┌──────────────────────────────────────────▼─────────────┐  │
│  │              deep-context plugin                        │  │
│  │                                                         │  │
│  │  ┌───────┐ ┌──────┐ ┌─────┐ ┌─────────┐ ┌──────────┐  │  │
│  │  │ React │ │Layout│ │A11y │ │Viewport │ │ Services │  │  │
│  │  │ Fiber │ │ CSS  │ │ARIA │ │Tailwind │ │ (impair) │  │  │
│  │  │ Tree  │ │      │ │     │ │   BP    │ │  state   │  │  │
│  │  └───────┘ └──────┘ └─────┘ └─────────┘ └──────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## What Changes

**Before** (react-grab default): Claude receives a shallow HTML snippet + component stack trace.

```
<button type="button" class="group flex w-fu...">
  <div ...>
  <span ...>
  npx -y grab@latest init
</button>
  in SelectionTabs
  in ToggleGroup
  in GeneratorPanel
```

**After** (with deep-context plugin): Claude receives the same snippet PLUS structured JSON.

```
<button type="button" class="group flex w-fu...">
  ...
</button>
  in SelectionTabs
  in ToggleGroup

<deep-context>
{
  "react": {
    "component": "SelectionTabs",
    "props": {
      "items": "[Array(5)]",
      "layout": "grid",
      "columns": { "lg": 5, "md": 4, "sm": 3, "xs": 2 }
    },
    "hooks": [
      { "hook": "state", "index": 0, "value": "video-pose-1" },
      { "hook": "memo", "index": 3, "value": "[Array(5)]" }
    ],
    "ancestry": [
      { "name": "SelectionTabs", "file": "src/adc-ui/selection-tabs/selection-tabs.tsx", "line": 67 },
      { "name": "ToggleGroup", "renders": "div" },
      { "name": "GeneratorPanel" }
    ],
    "owner": "SimpleSelectionTabs",
    "ownerProps": { "items": "[Array(5)]", "renderItem": "[fn]" }
  },
  "layout": {
    "display": "grid",
    "width": 1102,
    "height": 264,
    "gap": 12,
    "rect": { "x": 313, "y": 209, "width": 1102, "height": 264 }
  },
  "a11y": {
    "role": "listbox",
    "ariaLabel": "Items grid",
    "ariaAttributes": { "aria-label": "Items grid" },
    "tabIndex": null
  },
  "viewport": { "width": 1728, "height": 963, "breakpoint": "2xl" },
  "dataAttributes": { "slot": "grid-layout" },
  "services": {
    "FashionVideoPoseService": {
      "state": { "selectedVideoPoseId": null, "isDialogOpen": true },
      "derived": {}
    },
    "GeneratorService": {
      "state": { "aspectRatio": 1, "quality": "standard" },
      "derived": { "activeFeatureName": "fashion-video", "isValid": false }
    }
  }
}
</deep-context>
```

## Usage

### Basic (any React app)

```tsx
import { createDeepContextPlugin } from 'react-grab/plugins/deep-context'

// In your app setup:
const grab = createReactGrab({
  plugins: [
    createDeepContextPlugin(),
  ],
})
```

### With impair service extraction (AdCreative apps)

```tsx
import { createImpairDeepContextPlugin } from 'react-grab/plugins/deep-context'

const grab = createReactGrab({
  plugins: [
    createImpairDeepContextPlugin(),
  ],
})
```

### Custom service extractor (Redux, Zustand, etc.)

```tsx
import { createDeepContextPlugin } from 'react-grab/plugins/deep-context'

const grab = createReactGrab({
  plugins: [
    createDeepContextPlugin({
      serviceExtractor: (el) => {
        // Your custom extraction logic
        // Return { storeName: { state, derived } } or null
        return extractReduxState(el)
      },
    }),
  ],
})
```

### Selective sections

```tsx
createDeepContextPlugin({
  sections: {
    react: true,       // React fiber tree
    layout: true,      // CSS layout metrics
    a11y: false,       // Skip accessibility (not needed for styling tasks)
    viewport: true,    // Viewport + breakpoint
    dataAttributes: false,
    services: true,    // State management
  },
})
```

## Compatibility Matrix

| Feature | react-grab | inspector-log | deep-context plugin |
|---------|-----------|---------------|---------------------|
| Element selection UI | ✅ | ❌ | ✅ (via react-grab) |
| Agent dispatch (Claude) | ✅ | ❌ | ✅ (via react-grab) |
| Prompt mode | ✅ | ❌ | ✅ (via react-grab) |
| React component stack | ✅ (via bippy) | ✅ (manual fiber walk) | ✅ (manual fiber walk) |
| Component props | ❌ | ✅ | ✅ |
| Hook state | ❌ | ✅ | ✅ |
| Context values | ❌ | ✅ | ✅ |
| Owner component | ❌ | ✅ | ✅ |
| CSS layout metrics | ❌ (only copy-styles) | ✅ | ✅ |
| Accessibility data | ❌ | ✅ | ✅ |
| Viewport/breakpoint | ❌ | ✅ | ✅ |
| Service state (impair) | ❌ | ✅ | ✅ |
| Screenshots | ❌ | ✅ | ❌ (not needed for agents) |
| Source code context | ❌ | ✅ (server-side) | ❌ (agent reads files) |
| JSONL logging | ❌ | ✅ | ❌ (agent receives directly) |
| Undo/redo | ✅ | ❌ | ✅ (via react-grab) |
| Multi-agent support | ✅ | ❌ | ✅ (via react-grab) |

## Why Fork vs Upstream PR?

The deep-context plugin could be either:

1. **Upstream PR** — submit to `aidenybai/react-grab` as a new plugin. Clean, benefits everyone.
2. **Fork** — maintain our own version with ADC-specific enrichments.

**Recommendation**: Start as a fork, prove the value, then submit the generic parts upstream. The impair-specific extractor stays in our fork or as a separate package.

## Technical Notes

- **No bippy dependency**: The deep-context plugin does its own React fiber walking (same technique as inspector-log). This avoids version conflicts and gives us full control over the extraction depth.
- **No server component**: Unlike inspector-log, there's no server enrichment step. The agent (Claude Code) can read source files directly, so we skip source-context and test-file enrichment.
- **No screenshots**: Claude Code can take screenshots itself via MCP. We skip html2canvas to keep the plugin lightweight.
- **Serialization depth**: Configurable via `serializeDepth`. Default 2 balances detail vs token cost.
