import { describe, it, expect } from "vitest";
import { parseAdminEnv, parseCredentialEnv } from "./env.js";

describe("parseAdminEnv (ADR-0027)", () => {
  it("fails closed without a long enough admin token", () => {
    expect(() => parseAdminEnv({ SYNC_ADMIN_TOKEN: "short" })).toThrow(
      /SYNC_ADMIN_TOKEN is missing or shorter/,
    );
  });
});
