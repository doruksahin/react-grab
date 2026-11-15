import { describe, it, expect } from "vitest";
import { getInitials } from "./get-initials.js";

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("John Smith")).toBe("JS");
    expect(getInitials("Ada King Lovelace")).toBe("AK");
  });

  it("uppercases and ignores extra whitespace", () => {
    expect(getInitials("  jane   doe ")).toBe("JD");
  });

  it("returns one letter for a single word", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("returns an empty string for a missing or blank name", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
    expect(getInitials(null)).toBe("");
    expect(getInitials(undefined)).toBe("");
  });
});
