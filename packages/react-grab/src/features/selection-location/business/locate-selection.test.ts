import { describe, expect, it } from "vitest";
import { locateSelection } from "./locate-selection.js";

const CURRENT = "https://app.example.com/dashboard?tab=1#top";

describe("locateSelection", () => {
  it("is on-page when the element is on the page, wherever it was made", () => {
    expect(
      locateSelection({
        pageUrl: "https://other.example.com/x",
        currentUrl: CURRENT,
        isOnPage: true,
      }),
    ).toEqual({ kind: "on-page" });
  });

  it("is other-page for the same origin and a different path", () => {
    expect(
      locateSelection({
        pageUrl: "https://app.example.com/settings/billing?plan=pro#coupon",
        currentUrl: CURRENT,
        isOnPage: false,
      }),
    ).toEqual({
      kind: "other-page",
      url: "https://app.example.com/settings/billing?plan=pro#coupon",
      path: "/settings/billing",
    });
  });

  it("is other-site for a different origin, naming its host", () => {
    expect(
      locateSelection({
        pageUrl: "http://localhost:3000/dashboard",
        currentUrl: CURRENT,
        isOnPage: false,
      }),
    ).toEqual({ kind: "other-site", host: "localhost:3000" });
  });

  it("treats another scheme on the same host as another site", () => {
    expect(
      locateSelection({
        pageUrl: "http://app.example.com/dashboard",
        currentUrl: CURRENT,
        isOnPage: false,
      }),
    ).toEqual({ kind: "other-site", host: "app.example.com" });
  });

  it("is gone for the same page, ignoring query and fragment", () => {
    expect(
      locateSelection({
        pageUrl: "https://app.example.com/dashboard?tab=2",
        currentUrl: CURRENT,
        isOnPage: false,
      }),
    ).toEqual({ kind: "gone" });
  });

  it("is unknown when no page URL was stored", () => {
    expect(
      locateSelection({
        pageUrl: undefined,
        currentUrl: CURRENT,
        isOnPage: false,
      }),
    ).toEqual({ kind: "unknown" });
  });

  it("is unknown when the stored URL does not parse", () => {
    expect(
      locateSelection({
        pageUrl: "not a url",
        currentUrl: CURRENT,
        isOnPage: false,
      }),
    ).toEqual({ kind: "unknown" });
  });

  it("is unknown for a same-origin blob URL, which is not a page", () => {
    expect(
      locateSelection({
        pageUrl: "blob:https://app.example.com/1234",
        currentUrl: CURRENT,
        isOnPage: false,
      }),
    ).toEqual({ kind: "unknown" });
  });

  it("is unknown for every selection when the current page is not http(s)", () => {
    expect(
      locateSelection({
        pageUrl: "https://app.example.com/settings",
        currentUrl: "file:///Users/me/index.html",
        isOnPage: false,
      }),
    ).toEqual({ kind: "unknown" });
  });

  it("never offers a same-origin page for a URL without an origin", () => {
    expect(
      locateSelection({
        pageUrl: "javascript:alert(1)",
        currentUrl: CURRENT,
        isOnPage: false,
      }).kind,
    ).not.toBe("other-page");
  });
});
