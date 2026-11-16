import { createContext, useContext } from "solid-js";
import type { StepGuideAPI } from "./types.js";

const IDLE_GUIDE: StepGuideAPI = {
  canStart: () => false,
  start: () => {},
  skip: () => {},
  stop: () => {},
  view: () => undefined,
  highlightedElement: () => undefined,
};

const StepGuideContext = createContext<StepGuideAPI>(IDLE_GUIDE);

/** The step guide reaches the UI the way the selection location does (ADR-0026). */
export const StepGuideProvider = StepGuideContext.Provider;

export const useStepGuide = (): StepGuideAPI => useContext(StepGuideContext);
