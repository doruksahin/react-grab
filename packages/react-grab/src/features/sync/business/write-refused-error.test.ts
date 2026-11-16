import { describe, expect, it } from "vitest";
import { isWriteRefused, WriteRefusedError } from "./write-refused-error.js";

describe("isWriteRefused", () => {
  it("recognizes a refusal, and one that crossed a message channel", () => {
    expect(isWriteRefused(new WriteRefusedError("locked"))).toBe(true);
    const deserialized = new Error("locked");
    deserialized.name = "WriteRefusedError";
    expect(isWriteRefused(deserialized)).toBe(true);
  });

  it("does not take a failure for a refusal", () => {
    expect(isWriteRefused(new Error("PUT failed: 500"))).toBe(false);
    expect(isWriteRefused("409")).toBe(false);
  });
});
