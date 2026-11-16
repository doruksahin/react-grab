import { describe, expect, it } from "vitest";
import { createStepBuffer } from "./step-buffer.js";

describe("createStepBuffer", () => {
  it("keeps entries in order", () => {
    const buffer = createStepBuffer<number>(3);
    buffer.add(1);
    buffer.add(2);
    expect(buffer.entries()).toEqual([1, 2]);
  });

  it("drops the oldest entry past its capacity", () => {
    const buffer = createStepBuffer<number>(3);
    for (const entry of [1, 2, 3, 4, 5]) buffer.add(entry);
    expect(buffer.entries()).toEqual([3, 4, 5]);
  });

  it("returns a copy, so a taken flow does not change later", () => {
    const buffer = createStepBuffer<number>(3);
    buffer.add(1);
    const taken = buffer.entries();
    buffer.add(2);
    expect(taken).toEqual([1]);
  });
});
