import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { callEventHandler } from "./call-event-handler.js";

afterEach(cleanup);

// A real Solid button forwards its click to the handler under test.
const clickThrough = (
  handler: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> | undefined,
) => {
  const { getByRole } = render(() => (
    <button type="button" onClick={(event) => callEventHandler(handler, event)}>
      x
    </button>
  ));
  fireEvent.click(getByRole("button"));
};

describe("callEventHandler", () => {
  it("calls a plain handler with the event", () => {
    const handler = vi.fn();
    clickThrough(handler);
    expect(handler).toHaveBeenCalledWith(expect.any(MouseEvent));
  });

  it("calls a bound handler with its data and the event", () => {
    const handler = vi.fn();
    clickThrough([handler, "data"]);
    expect(handler).toHaveBeenCalledWith("data", expect.any(MouseEvent));
  });

  it("does nothing without a handler", () => {
    expect(() => clickThrough(undefined)).not.toThrow();
  });
});
