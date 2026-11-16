import { afterEach, describe, expect, it } from "vitest";
import { loadGuideSession, saveGuideSession } from "./guide-session.js";

afterEach(() => sessionStorage.clear());

describe("guide session", () => {
  it("keeps a position until it is cleared", () => {
    saveGuideSession({ selectionId: "c-1", stepIndex: 2 });
    expect(loadGuideSession()).toEqual({ selectionId: "c-1", stepIndex: 2 });
    saveGuideSession(undefined);
    expect(loadGuideSession()).toBeUndefined();
  });

  it("ignores a stored value it does not recognise", () => {
    sessionStorage.setItem("react-grab:step-guide", '{"stepIndex":"x"}');
    expect(loadGuideSession()).toBeUndefined();
    sessionStorage.setItem(
      "react-grab:step-guide",
      '{"selectionId":"c-1","stepIndex":0}',
    );
    expect(loadGuideSession()).toBeUndefined();
    sessionStorage.setItem("react-grab:step-guide", "not json");
    expect(loadGuideSession()).toBeUndefined();
  });
});
