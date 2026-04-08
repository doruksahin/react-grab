// packages/react-grab/src/core/plugins/recorder/api-shape.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type { ReactGrabAPI } from "../../../types.js";

describe("ReactGrabAPI shape (regression for ADR-0009 'no core API growth')", () => {
  it("retains the methods the recorder plugin depends on", () => {
    expectTypeOf<ReactGrabAPI>().toHaveProperty("getSource");
    expectTypeOf<ReactGrabAPI>().toHaveProperty("registerPlugin");
    expectTypeOf<ReactGrabAPI>().toHaveProperty("unregisterPlugin");
  });

  it("does NOT contain recorder-related fields on the public surface", () => {
    // If any of these compile, ADR-0009 has been violated — STOP and re-litigate.
    // expectTypeOf is a runtime no-op; the assertion happens at typecheck time.
    // @ts-expect-error -- "runAction" is not a valid key on ReactGrabAPI
    expectTypeOf<ReactGrabAPI>().toHaveProperty("runAction");
    // @ts-expect-error -- "recorder" is not a valid key on ReactGrabAPI
    expectTypeOf<ReactGrabAPI>().toHaveProperty("recorder");
    // @ts-expect-error -- "plugins" is not a valid key on ReactGrabAPI
    expectTypeOf<ReactGrabAPI>().toHaveProperty("plugins");
  });
});
