export interface MenuHighlightController {
  containerRef: (containerElement: HTMLElement) => void;
  highlightRef: (highlightElement: HTMLElement) => void;
  updateHighlight: (targetElement: HTMLElement | undefined) => void;
  clearHighlight: () => void;
}

/**
 * A highlight element that follows a target inside its container: it takes
 * the target's bounds (relative to the container) and fades in, or fades out.
 */
export const createMenuHighlight = (): MenuHighlightController => {
  let containerElement: HTMLElement | undefined;
  let highlightElement: HTMLElement | undefined;

  const clearHighlight = (): void => {
    if (!highlightElement) return;
    highlightElement.style.opacity = "0";
  };

  const updateHighlight = (targetElement: HTMLElement | undefined): void => {
    if (!highlightElement || !containerElement) return;
    if (!targetElement) {
      clearHighlight();
      return;
    }
    const containerRect = containerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    highlightElement.style.opacity = "1";
    highlightElement.style.top = `${targetRect.top - containerRect.top + containerElement.scrollTop}px`;
    highlightElement.style.left = `${targetRect.left - containerRect.left + containerElement.scrollLeft}px`;
    highlightElement.style.width = `${targetRect.width}px`;
    highlightElement.style.height = `${targetRect.height}px`;
  };

  return {
    containerRef: (element) => {
      containerElement = element;
    },
    highlightRef: (element) => {
      highlightElement = element;
    },
    updateHighlight,
    clearHighlight,
  };
};
