import { defineConfig } from "wxt";

const ICONS = {
  16: "assets/icons/icon-16.png",
  32: "assets/icons/icon-32.png",
  48: "assets/icons/icon-48.png",
  128: "assets/icons/icon-128.png",
};

export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  imports: false,
  targetBrowsers: ["chrome"],
  zip: {
    artifactTemplate: "react-grab-extension-{{version}}-{{browser}}.zip",
  },
  manifest: {
    name: "React Grab",
    description:
      "Select context for coding agents directly from your website. Makes tools like Cursor, Claude Code, Copilot run up to 3× faster",
    homepage_url: "https://react-grab.com",
    icons: ICONS,
    action: {
      default_title: "React Grab (Active)",
      default_icon: ICONS,
    },
    host_permissions: ["<all_urls>"],
    permissions: ["storage"],
  },
});
