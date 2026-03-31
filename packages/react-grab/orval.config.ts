import { defineConfig } from "orval";

export default defineConfig({
  syncTypes: {
    input: {
      target: "../sync-server/openapi.json",
    },
    output: {
      mode: "single",
      target: "src/generated/sync-api.ts",
      client: "fetch",
      override: {
        // We only want the types — the generated fetch functions won't be used
        // but "fetch" is the lightest client option with no extra dependencies
      },
    },
  },
});
