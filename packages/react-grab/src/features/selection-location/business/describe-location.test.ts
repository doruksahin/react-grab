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

  it("says the element is not visible here", () => {
    expect(describeLocation({ kind: "gone" })).toBe("Not visible here");
  });

  it("says the page is unknown when no page was stored", () => {
    expect(describeLocation({ kind: "unknown" })).toBe("Page unknown");
  });
});

describe("describeLocationNotice", () => {
  const withGuide = { canGuide: true };
  const withoutGuide = { canGuide: false };

  it("has no notice for a selection on the page", () => {
    expect(
      describeLocationNotice({ kind: "on-page" }, withoutGuide),
    ).toBeUndefined();
  });

  it("puts the path or host on the detail line", () => {
    expect(
      describeLocationNotice(
        {
          kind: "other-page",
          url: "https://app.example.com/boards",
          path: "/boards",
        },
        withGuide,
      ),
    ).toEqual({ title: "On another page", detail: "/boards" });
    expect(
      describeLocationNotice(
        { kind: "other-site", host: "localhost:3000" },
        withoutGuide,
      ),
    ).toEqual({ title: "Made on another site", detail: "localhost:3000" });
  });

  it("explains a hidden selection and points to the guide when it can run", () => {
    expect(describeLocationNotice({ kind: "gone" }, withGuide)).toEqual({
      title: "Not visible on this page",
      detail:
        'It may be inside a closed dialog, menu or tab, or it was removed. "Guide me" repeats the steps that showed it.',
    });
  });

  it("does not mention the guide when it cannot run", () => {
    expect(describeLocationNotice({ kind: "gone" }, withoutGuide)).toEqual({
      title: "Not visible on this page",
      detail:
        "It may be inside a closed dialog, menu or tab, or it was removed.",
    });
  });

  it("has no detail when the page is unknown", () => {
    expect(describeLocationNotice({ kind: "unknown" }, withoutGuide)).toEqual({
      title: "Page unknown",
    });
  });
});

describe("describeLocationShort", () => {
  it("names the host of another site, else says where or why", () => {
    expect(
      describeLocationShort({
        kind: "other-page",
        url: "https://app.example.com/",
        path: "/",
      }),
    ).toBe("Made on /");
    expect(
      describeLocationShort({ kind: "other-site", host: "localhost:3000" }),
    ).toBe("localhost:3000");
    expect(describeLocationShort({ kind: "gone" })).toBe("Not visible here");
    expect(describeLocationShort({ kind: "unknown" })).toBe("Page unknown");
    expect(describeLocationShort({ kind: "on-page" })).toBeUndefined();
  });
});
