import { describe, it, expect } from "vitest";
import { getAvatarColor } from "./get-avatar-color.js";

describe("getAvatarColor", () => {
  it("returns the same colour token for the same name", () => {
    expect(getAvatarColor("John Smith")).toBe(getAvatarColor("John Smith"));
  });

  it("returns an avatar colour token, never a raw colour", () => {
    expect(getAvatarColor("John Smith")).toMatch(
      /^var\(--color-avatar-[1-8]\)$/,
    );
    expect(getAvatarColor(undefined)).toMatch(/^var\(--color-avatar-[1-8]\)$/);
  });
});
