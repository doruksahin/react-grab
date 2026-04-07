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
        mutator: {
          path: "./src/generated/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
    // nodenext moduleResolution requires explicit .js suffix on relative
    // imports; orval emits extensionless imports, so patch the one offender.
    hooks: {
      afterAllFilesWrite: "node scripts/patch-orval-imports.mjs",
    },
  },
});
