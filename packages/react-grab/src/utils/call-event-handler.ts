import type { JSX } from "solid-js";

/**
 * Calls a Solid event handler prop, which is either a function or a bound
 * `[handler, data]` tuple. Primitives use it to run their own handler and the
 * caller's for the same event.
 */
export const callEventHandler = <T, E extends Event>(
  handler: JSX.EventHandlerUnion<T, E> | undefined,
  event: E & { currentTarget: T; target: Element },
): void => {
  if (typeof handler === "function") {
    handler(event);
    return;
  }
  if (Array.isArray(handler)) {
    handler[0](handler[1], event);
  }
};
