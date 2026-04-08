// packages/react-grab/src/core/plugins/recorder/build-step.ts
import { createElementSelector } from "../../../utils/create-element-selector.js";
import { USER_IGNORE_ATTRIBUTE } from "../../../constants.js";
import type { CapturedStep } from "./types.js";

const REACT_GRAB_UI_SELECTOR = "[data-react-grab]";
const MASKED_VALUE = "••••";

const isCaptureTarget = (element: Element): boolean => {
  // react-grab's own shadow host (verified at packages/react-grab/src/utils/mount-root.ts)
  if (element.closest(REACT_GRAB_UI_SELECTOR)) return false;
  // ancestor-walk on USER_IGNORE_ATTRIBUTE — same semantics as is-valid-grabbable-element.ts:21
  if (element.closest(`[${USER_IGNORE_ATTRIBUTE}]`)) return false;
  return true;
};

const newId = (): string => crypto.randomUUID();

export const buildClickStep = (event: PointerEvent): CapturedStep | null => {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  if (!isCaptureTarget(target)) return null;

  let selector: string;
  try {
    selector = createElementSelector(target);
  } catch {
    return null;
  }

  return {
    id: newId(),
    timestamp: Date.now(),
    element: target,
    selector,
    kind: {
      type: "click",
      offsetX: event.offsetX ?? 0,
      offsetY: event.offsetY ?? 0,
    },
  };
};

export const buildChangeStep = (event: Event): CapturedStep | null => {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  if (!isCaptureTarget(target)) return null;

  let selector: string;
  try {
    selector = createElementSelector(target);
  } catch {
    return null;
  }

  const isFormControl =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;
  if (!isFormControl) return null;

  const isPassword =
    target instanceof HTMLInputElement && target.type === "password";

  return {
    id: newId(),
    timestamp: Date.now(),
    element: target,
    selector,
    kind: {
      type: "change",
      value: isPassword ? MASKED_VALUE : target.value,
    },
  };
};
