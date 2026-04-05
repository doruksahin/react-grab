import { createSignal, onMount, onCleanup } from "solid-js";

/**
 * Returns a reactive boolean that becomes true once the observed element
 * enters the intersection root's viewport.
 *
 * @param ref       - accessor returning the element to observe
 * @param root      - accessor returning the scroll container to use as the
 *                    IntersectionObserver root (defaults to viewport if null).
 *                    IMPORTANT: for elements inside a scrollable container,
 *                    always pass the container — using the viewport root makes
 *                    all cards immediately "visible" inside a fixed sidebar.
 */
export function useLazyVisible(
  ref: () => Element | undefined,
  root: () => Element | null = () => null,
): () => boolean {
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    const el = ref();
    if (!el) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: root(), threshold: 0.1 },
    );
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });

  return visible;
}
