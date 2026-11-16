import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentItem } from "../../../types.js";
import { GUIDE_SEARCH_INTERVAL_MS } from "../../../constants.js";
import { createStepGuide } from "./create-step-guide.js";

const PAGE = "http://localhost:3000/";

const selection: CommentItem = {
  id: "c-1",
  groupId: null,
  content: "<button>Pay</button>",
  elementName: "button",
  tagName: "button",
  timestamp: 1,
  steps: [
    { type: "navigate", url: PAGE },
    { type: "click", selectors: ["#open"], offsetX: 1, offsetY: 1 },
    { type: "click", selectors: ["#tab"], offsetX: 1, offsetY: 1 },
  ],
};

const setup = (items: CommentItem[] = [selection]) =>
  createRoot((dispose) => {
    const [commentItems, setCommentItems] = createSignal(items);
    const [commentsLoaded, setCommentsLoaded] = createSignal(false);
    const [selectionOnPage, setSelectionOnPage] = createSignal(false);
    const guide = createStepGuide({
      commentItems,
      currentPageUrl: () => PAGE,
      commentsLoaded,
      isPaused: () => false,
      selectionElements: () => (selectionOnPage() ? [document.body] : []),
    });
    return {
      guide,
      dispose,
      setCommentItems,
      setCommentsLoaded,
      setSelectionOnPage,
    };
  });

const searchAgain = () => vi.advanceTimersByTime(GUIDE_SEARCH_INTERVAL_MS);

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, "", PAGE);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  sessionStorage.clear();
});

describe("createStepGuide", () => {
  it("offers a guide only for a selection with steps on this site", () => {
    const { guide, dispose } = setup([
      selection,
      { ...selection, id: "no-steps", steps: undefined },
    ]);
    expect(guide.canStart("c-1")).toBe(true);
    expect(guide.canStart("no-steps")).toBe(false);
    dispose();
  });

  it("waits for a step's element and shows it once it appears", () => {
    const { guide, dispose } = setup();
    guide.start("c-1");
    expect(guide.view()).toMatchObject({
      status: "looking",
      stepNumber: 1,
      stepCount: 2,
    });

    document.body.innerHTML = '<button id="open">Open</button>';
    searchAgain();
    expect(guide.view()?.status).toBe("showing");
    expect(guide.highlightedElement()).toBe(document.getElementById("open"));
    dispose();
  });

  it("finishes after skipping the last step", () => {
    const { guide, dispose } = setup();
    guide.start("c-1");
    guide.skip();
    expect(guide.view()?.stepNumber).toBe(2);
    guide.skip();
    expect(guide.view()?.status).toBe("missing");
    dispose();
  });

  it("finishes early when the selection itself is back", () => {
    const { guide, dispose, setSelectionOnPage } = setup();
    guide.start("c-1");
    setSelectionOnPage(true);
    searchAgain();
    expect(guide.view()?.status).toBe("found");
    expect(guide.highlightedElement()).toBe(document.body);
    dispose();
  });

  it("says the selection was removed once comments have loaded", () => {
    sessionStorage.setItem(
      "react-grab:step-guide",
      JSON.stringify({ selectionId: "gone", stepIndex: 1 }),
    );
    const { guide, dispose, setCommentsLoaded } = setup();
    expect(guide.view()?.status).toBe("loading");
    setCommentsLoaded(true);
    expect(guide.view()?.status).toBe("removed");
    expect(sessionStorage.getItem("react-grab:step-guide")).toBeNull();
    dispose();
  });

  it("resumes a guide stored before a page load", () => {
    sessionStorage.setItem(
      "react-grab:step-guide",
      JSON.stringify({ selectionId: "c-1", stepIndex: 2 }),
    );
    const { guide, dispose } = setup();
    expect(guide.view()).toMatchObject({ stepNumber: 2, stepCount: 2 });
    dispose();
  });

  it("Stop ends the guide and forgets it", () => {
    const { guide, dispose } = setup();
    guide.start("c-1");
    guide.stop();
    expect(guide.view()).toBeUndefined();
    expect(sessionStorage.getItem("react-grab:step-guide")).toBeNull();
    dispose();
  });
});
