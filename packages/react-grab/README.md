# <img src="https://github.com/aidenybai/react-grab/blob/main/.github/public/logo.png?raw=true" width="60" align="center" /> React Grab

[![size](https://img.shields.io/bundlephobia/minzip/react-grab?label=gzip&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/package/react-grab)
[![version](https://img.shields.io/npm/v/react-grab?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-grab)
[![downloads](https://img.shields.io/npm/dt/react-grab.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-grab)

Select context for coding agents directly from your website

How? Point at any element and press **⌘C** (Mac) or **Ctrl+C** (Windows/Linux) to copy the file name, React component, and HTML source code.

It makes tools like Cursor, Claude Code, Copilot run up to [**3× faster**](https://react-grab.com/blog/intro) and more accurate.

### [Try out a demo! →](https://react-grab.com)

![React Grab Demo](https://github.com/aidenybai/react-grab/blob/main/packages/website/public/demo.gif?raw=true)

## Install

Run this command at your project root (where `next.config.ts` or `vite.config.ts` is located):

```bash
npx -y grab@latest init
```

## Connect to MCP

```bash
npx -y grab@latest add mcp
```

## Usage

Once installed, hover over any UI element in your browser and press:

- **⌘C** (Cmd+C) on Mac
- **Ctrl+C** on Windows/Linux

This copies the element's context (file name, React component, and HTML source code) to your clipboard ready to paste into your coding agent. For example:

```js
<a class="ml-auto inline-block text-sm" href="#">
  Forgot your password?
</a>
in LoginForm at components/login-form.tsx:46:19
```

## Manual Installation

If you're using a React framework or build tool, view instructions below:

#### Next.js (App router)

Add this inside of your `app/layout.tsx`:

```jsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

#### Next.js (Pages router)

Add this into your `pages/_document.tsx`:

```jsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

#### Vite

Add this at the top of your main entry file (e.g., `src/main.tsx`):

```tsx
if (import.meta.env.DEV) {
  import("react-grab");
}
```

#### Webpack

First, install React Grab:

```bash
npm install react-grab
```

Then add this at the top of your main entry file (e.g., `src/index.tsx` or `src/main.tsx`):

```tsx
if (process.env.NODE_ENV === "development") {
  import("react-grab");
}
```

## Plugins

Use plugins to extend React Grab's built-in UI with context menu actions, toolbar menu items, lifecycle hooks, and theme overrides. Plugins run within React Grab.

Register a plugin using the `registerPlugin` and `unregisterPlugin` exports:

```js
import { registerPlugin } from "react-grab";

registerPlugin({
  name: "my-plugin",
  hooks: {
    onElementSelect: (element) => {
      console.log("Selected:", element.tagName);
    },
  },
});
```

In React, register inside a `useEffect`:

```jsx
import { registerPlugin, unregisterPlugin } from "react-grab";

useEffect(() => {
  registerPlugin({
    name: "my-plugin",
    actions: [
      {
        id: "my-action",
        label: "My Action",
        shortcut: "M",
        onAction: (context) => {
          console.log("Action on:", context.element);
          context.hideContextMenu();
        },
      },
    ],
  });

  return () => unregisterPlugin("my-plugin");
}, []);
```

Actions use a `target` field to control where they appear. Omit `target` (or set `"context-menu"`) for the right-click menu, or set `"toolbar"` for the toolbar dropdown:

```js
actions: [
  {
    id: "inspect",
    label: "Inspect",
    shortcut: "I",
    onAction: (ctx) => console.dir(ctx.element),
  },
  {
    id: "toggle-freeze",
    label: "Freeze",
    target: "toolbar",
    isActive: () => isFrozen,
    onAction: () => toggleFreeze(),
  },
];
```

See [`packages/react-grab/src/types.ts`](https://github.com/aidenybai/react-grab/blob/main/packages/react-grab/src/types.ts) for the full `Plugin`, `PluginHooks`, and `PluginConfig` interfaces.

## Recording user interactions

Opt-in plugin that captures clicks and form changes into Chrome DevTools Recorder JSON or numbered plain-text steps.

### Wiring (script tag / IIFE)

```html
<script src="./dist/index.global.js"></script>
<button id="rec-toggle">Toggle recording</button>
<button id="rec-copy">Copy as steps</button>
<script>
  const mod = globalThis.__REACT_GRAB_MODULE__;
  mod.registerPlugin(mod.recorderPlugin);
  document.getElementById('rec-toggle').addEventListener('click',
    () => mod.recorderPlugin.controls.toggle());
  document.getElementById('rec-copy').addEventListener('click',
    () => mod.recorderPlugin.controls.copyText()
      .then(() => alert('copied'))
      .catch((err) => alert('error: ' + err.message)));
</script>
```

### Wiring (ESM)

The `react-grab` package auto-initializes on import, so you do **not** call `init()` yourself. Use the top-level `registerPlugin` helper from the package.

```ts
import { registerPlugin, recorderPlugin } from "react-grab";

registerPlugin(recorderPlugin);

// Wire to your own UI:
recorderPlugin.controls.toggle();          // start/stop capture
await recorderPlugin.controls.copyJson();  // → Chrome DevTools Recorder JSON
await recorderPlugin.controls.copyText();  // → numbered steps for agents
```

> **Do NOT** write `const api = init(); api.registerPlugin(recorderPlugin)`. The package has already auto-initialized by the time your import lands; a second `init()` call returns a noop API whose `registerPlugin` is a silent no-op. The plugin would never actually register.

### Public controls

| Method | Purpose |
|---|---|
| `start()` | Begin capturing pointerdown + change events |
| `stop()` | Stop capturing |
| `toggle()` | Flip capture state |
| `copyJson()` | Write Chrome DevTools Recorder JSON to clipboard. **Returns a Promise that rejects with `Error("Recorder plugin is not registered")` if you call it before registering the plugin.** Wire your error path. |
| `copyText()` | Write numbered plain-text steps to clipboard. Same rejection contract. |
| `clear()` | Empty the buffer (does not stop capture) |
| `isCapturing()` | Returns the current capture state as a boolean |

### Privacy

The recorder reuses the existing `data-react-grab-ignore` attribute (`USER_IGNORE_ATTRIBUTE`). Any element under an ancestor with `data-react-grab-ignore` is excluded from recordings. `<input type="password">` values are masked to `••••` regardless of attributes.

```html
<section data-react-grab-ignore>
  <!-- nothing inside this section appears in recordings -->
</section>
```

### Bundle note

The recorder is included in the IIFE script-tag bundle (`dist/index.global.js`) unconditionally. ESM consumers receive it through the root export until a subpath export `react-grab/plugins/recorder` is added in a future release.

## Resources & Contributing Back

Want to try it out? Check out [our demo](https://react-grab.com).

Looking to contribute back? Check out the [Contributing Guide](https://github.com/aidenybai/react-grab/blob/main/CONTRIBUTING.md).

Want to talk to the community? Hop in our [Discord](https://discord.com/invite/G7zxfUzkm7) and share your ideas and what you've built with React Grab.

Find a bug? Head over to our [issue tracker](https://github.com/aidenybai/react-grab/issues) and we'll do our best to help. We love pull requests, too!

We expect all contributors to abide by the terms of our [Code of Conduct](https://github.com/aidenybai/react-grab/blob/main/.github/CODE_OF_CONDUCT.md).

[**→ Start contributing on GitHub**](https://github.com/aidenybai/react-grab/blob/main/CONTRIBUTING.md)

### License

React Grab is MIT-licensed open-source software.

_Thank you to [Andrew Luetgers](https://github.com/andrewluetgers) for donating the `grab` npm package name._
