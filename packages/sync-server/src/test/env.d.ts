/// <reference types="@cloudflare/vitest-plugin/types" />

import type { D1Migration } from "cloudflare:test";
import type { Bindings } from "../types.js";

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
