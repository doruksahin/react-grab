import { describe, expect, it } from "vitest";
import {
  describeLocation,
  describeLocationNotice,
  describeLocationShort,
} from "./describe-location.js";

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

describe("describeLocationNotice", () => {
  it("has no notice for a selection on the page", () => {
    expect(describeLocationNotice({ kind: "on-page" })).toBeUndefined();
  });

  it("puts the path or host on the detail line", () => {
    expect(
      describeLocationNotice({
        kind: "other-page",
        url: "https://app.example.com/boards",
        path: "/boards",
      }),
    ).toEqual({ title: "On another page", detail: "/boards" });
    expect(
      describeLocationNotice({ kind: "other-site", host: "localhost:3000" }),
    ).toEqual({ title: "Made on another site", detail: "localhost:3000" });
  });

  it("explains a selection gone from this page", () => {
    expect(describeLocationNotice({ kind: "gone" })?.title).toBe(
      "No longer on this page",
    );
  });

  it("has no detail when the origin is unknown", () => {
    expect(describeLocationNotice({ kind: "unknown" })).toEqual({
      title: "Not on this page",
    });
  });
});

describe("describeLocationShort", () => {
  it("names the path or host, else why it is missing", () => {
    expect(
      describeLocationShort({
        kind: "other-page",
        url: "https://app.example.com/boards",
        path: "/boards",
      }),
    ).toBe("/boards");
    expect(
      describeLocationShort({ kind: "other-site", host: "localhost:3000" }),
    ).toBe("localhost:3000");
    expect(describeLocationShort({ kind: "gone" })).toBe(
      "No longer on this page",
    );
    expect(describeLocationShort({ kind: "on-page" })).toBeUndefined();
  });
});
