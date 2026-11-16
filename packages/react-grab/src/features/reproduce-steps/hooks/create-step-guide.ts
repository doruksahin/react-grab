import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { GUIDE_SEARCH_INTERVAL_MS } from "../../../constants.js";
import { stepTarget as controlOf } from "../business/build-step.js";
import { describeStep } from "@react-grab/selection-text";
import {
  findStepTarget,
  isStillVisible,
} from "../business/find-step-target.js";
import {
  FIRST_ACTION_STEP_INDEX,
  type GuidePosition,
  guideStart,
  isGuideFinished,
  nextPosition,
} from "../business/guide-progress.js";
import { loadGuideSession, saveGuideSession } from "../store/guide-session.js";
import type {
  GuideView,
  ReproduceStep,
  StepGuideAPI,
  StepGuideDeps,
} from "../types.js";
import { createPageEvents } from "./create-page-events.js";

interface FoundTarget {
  step: ReproduceStep;
  element: Element | undefined;
}

/**
 * Guides the user back to a selection, one recorded step at a time
 * (ADR-0026). It points at the next step's element and moves on when the
 * user clicks or changes it; it never acts on the page by itself. While it
 * runs it looks again on a short interval, as Testing Library's waitFor
 * does, so elements shown by any change (a class, `hidden`, `open`) are
 * found. A running guide survives a page load through sessionStorage.
 */
export const createStepGuide = (deps: StepGuideDeps): StepGuideAPI => {
  const [position, setPosition] = createSignal<GuidePosition | undefined>(
    loadGuideSession(),
  );
  const [searchTick, setSearchTick] = createSignal(0);

  const item = createMemo(() => {
    const current = position();
    if (!current) return undefined;
    return deps.commentItems().find((each) => each.id === current.selectionId);
  });

  const removed = createMemo(() =>
    Boolean(position() && !item() && deps.commentsLoaded()),
  );

  const steps = createMemo(() => item()?.steps ?? []);

  const currentStep = createMemo(() => {
    const current = position();
    return current ? steps()[current.stepIndex] : undefined;
  });

  const foundSelection = createMemo(() => {
    void searchTick();
    const selection = item();
    return selection ? deps.selectionElements(selection)[0] : undefined;
  });

  // Ends after the last step, or as soon as the selection itself is back.
  const finished = createMemo(() => {
    const current = position();
    if (!current || !item()) return false;
    return isGuideFinished(current, steps()) || Boolean(foundSelection());
  });

  // A target found earlier is kept while it stays visible; only a missing
  // one costs a search of the page.
  const target = createMemo<FoundTarget | undefined>(
    (previous) => {
      void searchTick();
      const step = finished() ? undefined : currentStep();
      if (!step) return undefined;
      if (previous?.step === step && previous.element) {
        if (isStillVisible(previous.element)) return previous;
      }
      return { step, element: findStepTarget(step, document) };
    },
    undefined,
    {
      equals: (previous, next) =>
        previous?.step === next?.step && previous?.element === next?.element,
    },
  );

  const highlightedElement = createMemo(() =>
    finished() ? foundSelection() : target()?.element,
  );

  const view = createMemo((): GuideView | undefined => {
    const current = position();
    if (!current) return undefined;
    const ended = { stepNumber: 0, stepCount: 0 };
    if (removed()) return { status: "removed", ...ended };
    if (!item()) return { status: "loading", ...ended };
    const stepCount = steps().length - FIRST_ACTION_STEP_INDEX;
    if (finished()) {
      return {
        status: foundSelection() ? "found" : "missing",
        stepNumber: 0,
        stepCount,
      };
    }
    const step = currentStep();
    return {
      status: target()?.element ? "showing" : "looking",
      stepNumber: current.stepIndex - FIRST_ACTION_STEP_INDEX + 1,
      stepCount,
      sentence: step ? describeStep(step) : undefined,
    };
  });

  // External bridge: the per-tab store keeps a running guide across loads.
  createEffect(() => saveGuideSession(removed() ? undefined : position()));

  // External bridge: a running guide looks again on an interval, until the
  // selection is found. A guide that ended without it keeps looking: the
  // last click's effect (a dialog opening) lands after the click itself.
  createEffect(() => {
    if (!position() || removed() || (finished() && foundSelection())) return;
    const interval = window.setInterval(
      () => setSearchTick((tick) => tick + 1),
      GUIDE_SEARCH_INTERVAL_MS,
    );
    onCleanup(() => window.clearInterval(interval));
  });

  // External bridge: bring the element the guide points at into view.
  createEffect(() => {
    highlightedElement()?.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
  });

  // A click counts when it lands on the same control as the target, so a
  // click on a button's padding counts for a step recorded on its label.
  const advanceOn =
    (type: ReproduceStep["type"]) =>
    ({ target: clicked }: { target: Element }) => {
      const current = position();
      const element = target()?.element;
      if (!current || !element || currentStep()?.type !== type) return;
      if (
        !element.contains(clicked) &&
        controlOf(clicked) !== controlOf(element)
      ) {
        return;
      }
      setPosition(nextPosition(current));
    };

  onCleanup(
    createPageEvents({
      isPaused: deps.isPaused,
      onClick: advanceOn("click"),
      onChange: advanceOn("change"),
    }),
  );

  const startFor = (selectionId: string) => {
    const selection = deps
      .commentItems()
      .find((each) => each.id === selectionId);
    return guideStart(selection?.steps, deps.currentPageUrl());
  };

  return {
    canStart: (selectionId) => startFor(selectionId) !== undefined,
    start: (selectionId) => {
      const start = startFor(selectionId);
      if (!start) return;
      setPosition({ selectionId, stepIndex: FIRST_ACTION_STEP_INDEX });
      if (start.kind === "open-page") window.location.assign(start.url);
    },
    skip: () => {
      const current = position();
      if (current) setPosition(nextPosition(current));
    },
    stop: () => setPosition(undefined),
    view,
    highlightedElement,
  };
};
