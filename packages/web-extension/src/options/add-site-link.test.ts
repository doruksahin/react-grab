import { describe, expect, it } from "vitest";
import { addSitePath, linkedSiteOrigin } from "./add-site-link.js";

describe("add-site link", () => {
  it("opens the add-site form with the origin encoded", () => {
    expect(addSitePath("https://blog.example")).toBe(
      "?origin=https%3A%2F%2Fblog.example#add-site",
    );
  });

  it("reads back the origin it carries", () => {
    const path = addSitePath("https://blog.example:8443");
    const search = path.slice(0, path.indexOf("#"));

    expect(linkedSiteOrigin(search)).toBe("https://blog.example:8443");
  });

  it("reads an empty origin from a page opened without one", () => {
    expect(linkedSiteOrigin("")).toBe("");
  });
});
