import { describe, it, expect } from "vitest";
import { avatarColor, initials } from "../avatar-utils.js";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("John Smith")).toBe("JS");
    expect(initials("Ada King Lovelace")).toBe("AK");
  });

  it("uppercases and ignores extra whitespace", () => {
    expect(initials("  jane   doe ")).toBe("JD");
  });

  it("returns one letter for a single word", () => {
    expect(initials("Alice")).toBe("A");
  });

  it("returns an empty string for a missing or blank name", () => {
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
    expect(initials(null)).toBe("");
    expect(initials(undefined)).toBe("");
  });
});

describe("avatarColor", () => {
  it("returns the same colour for the same name", () => {
    expect(avatarColor("John Smith")).toBe(avatarColor("John Smith"));
  });

  it("returns a hex colour for a missing name", () => {
    expect(avatarColor(undefined)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
