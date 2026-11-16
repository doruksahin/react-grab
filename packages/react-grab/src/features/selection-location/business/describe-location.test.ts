import { describe, expect, it } from "vitest";
import { describeLocation } from "./describe-location.js";

describe("describeLocation", () => {
  it("says nothing for a selection on the page", () => {
    expect(describeLocation({ kind: "on-page" })).toBeUndefined();
  });

  it("names the path of another page", () => {
    expect(
      describeLocation({
        kind: "other-page",
        url: "https://app.example.com/settings/billing",
        path: "/settings/billing",
      }),
    ).toBe("Made on /settings/billing");
  });

  it("names the host of another site", () => {
    expect(
      describeLocation({ kind: "other-site", host: "localhost:3000" }),
    ).toBe("Made on localhost:3000, another site");
  });

  it("says the element is no longer on this page", () => {
    expect(describeLocation({ kind: "gone" })).toBe("No longer on this page");
  });

  it("says only that it is not on this page when the origin is unknown", () => {
    expect(describeLocation({ kind: "unknown" })).toBe("Not on this page");
  });
});
