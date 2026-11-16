import { describe, expect, it } from "vitest";
import { sourceLocation } from "./source-location.js";

describe("sourceLocation", () => {
  it("joins the path and the line", () => {
    expect(sourceLocation('<div data-src="/app/src/Button.tsx:42">')).toBe(
      "/app/src/Button.tsx:42",
    );
  });

  it("keeps a path without a line", () => {
    expect(sourceLocation("/app/src/Button.tsx")).toBe("/app/src/Button.tsx");
  });

  it("is undefined when the content names no source file", () => {
    expect(sourceLocation("<div>Save</div>")).toBeUndefined();
  });
});
