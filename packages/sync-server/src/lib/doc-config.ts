export const DOC_CONFIG = {
  openapi: "3.0.3" as const,
  info: {
    title: "react-grab Sync API",
    version: "0.1.0",
    description: "API for the react-grab dashboard — comments, groups, workspaces.",
  },
  servers: [
    { url: "https://react-grab-sync-server.doruksahin98.workers.dev", description: "Production" },
    { url: "http://localhost:8787", description: "Local (wrangler dev)" },
    { url: "http://localhost:3847", description: "Local (node)" },
  ],
};
