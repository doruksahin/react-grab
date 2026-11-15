import { describe, expect, it } from "vitest";
import { cn } from "./cn.js";

describe("cn", () => {
  it("keeps a type step next to a text colour", () => {
    expect(cn("text-body text-muted-foreground")).toBe(
      "text-body text-muted-foreground",
    );
  });

  it("lets a later type step replace an earlier one", () => {
    expect(cn("text-meta", "text-title")).toBe("text-title");
  });
});
