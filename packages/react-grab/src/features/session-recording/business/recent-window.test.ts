import { describe, expect, it } from "vitest";
import { createRecentWindow } from "./recent-window.js";

describe("createRecentWindow", () => {
  it("keeps everything before the first checkout", () => {
    const window = createRecentWindow<string>();
    window.add("full-0", false);
    window.add("a", false);
    expect(window.take()).toEqual(["full-0", "a"]);
  });

  it("keeps the previous chunk and the current one across a checkout", () => {
    const window = createRecentWindow<string>();
    window.add("full-0", false);
    window.add("a", false);
    window.add("full-1", true);
    window.add("b", false);
    expect(window.take()).toEqual(["full-0", "a", "full-1", "b"]);
  });

  it("drops chunks older than the previous checkout, so it always starts at a full snapshot", () => {
    const window = createRecentWindow<string>();
    window.add("full-0", false);
    window.add("a", false);
    window.add("full-1", true);
    window.add("b", false);
    window.add("full-2", true);
    window.add("c", false);
    expect(window.take()).toEqual(["full-1", "b", "full-2", "c"]);
  });

  it("returns a copy, so later events do not change a taken window", () => {
    const window = createRecentWindow<string>();
    window.add("full-0", false);
    const taken = window.take();
    window.add("a", false);
    expect(taken).toEqual(["full-0"]);
  });
});
