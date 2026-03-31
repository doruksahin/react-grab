import { defineConfig } from "orval";

export default defineConfig({
  dashboard: {
    input: {
      target: "../sync-server/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "src/api/endpoints",
      schemas: "src/api/model",
      client: "react-query",
      mock: true,
      override: {
        query: {
          useQuery: true,
          useSuspenseQuery: true,
        },
      },
    },
  },
});
