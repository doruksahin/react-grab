import solid from "vite-plugin-solid";
import { defineConfig } from "wxt";
import { E2E_HOST_PERMISSIONS } from "./e2e/e2e-origins.js";

const ICONS = {
  16: "assets/icons/icon-16.png",
  32: "assets/icons/icon-32.png",
  48: "assets/icons/icon-48.png",
  128: "assets/icons/icon-128.png",
};

const E2E_MODE = "e2e";

export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  imports: false,
  // HACK: vite-plugin-solid directly, not @wxt-dev/module-solid: the module
  // adds a solid-js auto-import preset even with imports: false, which
  // injected solid's `on` into react-grab's bundled chunk and broke the build.
  vite: () => ({ plugins: [solid()] }),
  targetBrowsers: ["chrome"],
  zip: {
    artifactTemplate: "react-grab-extension-{{version}}-{{browser}}.zip",
  },
  manifest: ({ mode }) => ({
    name: "React Grab",
    description:
      "Select context for coding agents directly from your website. Makes tools like Cursor, Claude Code, Copilot run up to 3× faster",
    homepage_url: "https://react-grab.com",
    minimum_chrome_version: "148",
    message_serialization: "structured_clone",
    icons: ICONS,
    action: {
      default_title: "React Grab (Active)",
      default_icon: ICONS,
    },
    permissions: ["storage", "scripting"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    host_permissions: mode === E2E_MODE ? E2E_HOST_PERMISSIONS : [],
  }),
});
