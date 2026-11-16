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
          // .invalid never resolves (RFC 2606), so even a test that slips
          // past the gate cannot reach a real Jira site.
          JIRA_BASE_URL: "https://jira.invalid",
          JIRA_EMAIL: "test@example.com",
          JIRA_API_TOKEN: "test-token",
          // Fake API token for the access-control tests (ADR-0020).
          SYNC_API_TOKEN: "test-sync-token-0123456789abcdef0123",
          // Fake admin token and credential key ring (ADR-0027). Test-only values.
          SYNC_ADMIN_TOKEN: "test-admin-token-0123456789abcdef012",
          JIRA_CREDENTIAL_KEYS: JSON.stringify({
            v1: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
          }),
          JIRA_CREDENTIAL_KEY_CURRENT: "v1",
          ALLOWED_ORIGINS: "https://staging.example.com",
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./src/test/apply-migrations.ts"],
  },
});
