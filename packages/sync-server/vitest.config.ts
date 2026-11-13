import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd with real D1 and R2 emulation (Cloudflare's own
// Vitest integration), so repository tests exercise the same SQL the deployed
// Worker runs — not a fake. Each test file gets isolated storage; the setup
// file applies the drizzle migrations to it first.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(
            path.join(import.meta.dirname, "drizzle"),
          ),
          // Fake values so the env schema passes in route tests. No test
          // reaches Jira: those that would are not written against SELF.
          JIRA_EMAIL: "test@example.com",
          JIRA_API_TOKEN: "test-token",
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./src/test/apply-migrations.ts"],
  },
});
