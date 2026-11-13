import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // Every environment uses the deployed Worker. Set VITE_SYNC_SERVER_URL to
  // http://localhost:8787 only while changing the server itself (pnpm sync:dev).
  const syncServerUrl =
    env.VITE_SYNC_SERVER_URL ??
    "https://react-grab-sync-server.doruksahin98.workers.dev"

  // The sync server requires a bearer token (ADR-0020). The dev proxy adds it
  // on the way through, so it never reaches browser code and plain <img>
  // screenshot requests carry it too. SYNC_API_TOKEN has no VITE_ prefix on
  // purpose: Vite only exposes VITE_ variables to the client. Put it in the
  // gitignored .env.local.
  const syncApiToken = env.SYNC_API_TOKEN
  const toSyncServer = {
    target: syncServerUrl,
    changeOrigin: true,
    headers: syncApiToken ? { Authorization: `Bearer ${syncApiToken}` } : {},
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/workspaces": toSyncServer,
        "/health": toSyncServer,
        "/jira": toSyncServer,
      },
    },
  }
})
