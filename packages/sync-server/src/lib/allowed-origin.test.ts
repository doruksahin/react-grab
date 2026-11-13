import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./allowed-origin.js";

describe("isAllowedOrigin", () => {
  it("allows local dev servers on any port", () => {
    expect(isAllowedOrigin("http://localhost:5173", undefined)).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3000", undefined)).toBe(true);
    expect(isAllowedOrigin("http://[::1]:8080", undefined)).toBe(true);
  });

  it("refuses any other origin unless it is listed", () => {
    expect(isAllowedOrigin("https://evil.example", undefined)).toBe(false);
    expect(isAllowedOrigin("https://staging.example.com", undefined)).toBe(
      false,
    );
  });

  it("allows an origin listed in ALLOWED_ORIGINS, compared exactly", () => {
    const list = "https://staging.example.com, https://qa.example.com";
    expect(isAllowedOrigin("https://staging.example.com", list)).toBe(true);
    expect(isAllowedOrigin("https://qa.example.com", list)).toBe(true);
    expect(isAllowedOrigin("http://staging.example.com", list)).toBe(false);
    expect(
      isAllowedOrigin("https://staging.example.com.evil.example", list),
    ).toBe(false);
  });

  it("refuses values that are not web origins", () => {
    expect(isAllowedOrigin("null", undefined)).toBe(false);
    expect(isAllowedOrigin("file:///tmp/page.html", undefined)).toBe(false);
    expect(isAllowedOrigin("", undefined)).toBe(false);
  });
});
