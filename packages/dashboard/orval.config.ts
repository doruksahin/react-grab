import { defineConfig } from "orval";

export default defineConfig({
  dashboard: {
    input: {
      target: "./api-spec.yaml",
    },
    output: {
      mode: "tags-split",
      target: "src/api/endpoints",
      schemas: "src/api/model",
      client: "react-query",
      mock: true,
      override: {
        zod: {
          strict: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
          generate: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
          coerce: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
        },
        query: {
          useQuery: true,
          useSuspenseQuery: true,
        },
      },
    },
  },
});
