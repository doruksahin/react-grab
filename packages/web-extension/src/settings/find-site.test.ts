import { describe, expect, it } from "vitest";
import { findSite } from "./find-site.js";

const SITE = {
  workspace: "storefront",
  recordSteps: false,
  recordSession: false,
};

describe("findSite", () => {
  it("finds a site by its exact origin", () => {
    expect(
      findSite({ "https://shop.example": SITE }, "https://shop.example"),
    ).toBe(SITE);
  });

  it("does not match another origin of the same host", () => {
    expect(
      findSite({ "https://shop.example": SITE }, "http://shop.example"),
    ).toBeNull();
  });

  it("does not match inherited object keys", () => {
    expect(findSite({}, "constructor")).toBeNull();
  });
});
