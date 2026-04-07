// packages/react-grab/src/utils/sync-color-scheme.ts
//
// Mirror an attribute from one element onto another, live.
//
// react-grab lives inside a shadow root, so the host page's design-token
// switch (e.g. AdCreative's `<html data-color-scheme="light">`) doesn't
// reach our subtree through the cascade. We bridge it manually: read the
// attribute on a source element, write a possibly-renamed/remapped value
// to a target element, and keep them in sync via MutationObserver.
//
// The bridge is generic — nothing in this file knows about AdCreative or
// shadcn. Callers supply the source/target attributes and an optional
// value mapping. This keeps the policy ("AdCreative uses data-color-scheme
// → we expose data-kb-theme") in one place at the call site.

export interface AttributeBridgeOptions {
  /** Element whose attribute changes drive the sync. Defaults to <html>. */
  source?: Element;
  /** Attribute name read from `source`. */
  sourceAttribute: string;
  /** Attribute name written to `target`. */
  targetAttribute: string;
  /**
   * Maps the source value to the target value. Return `null` to remove
   * the target attribute entirely (useful for "default = absent").
   * Defaults to identity.
   */
  map?: (sourceValue: string | null) => string | null;
}

/**
 * Bridge an attribute from `source` to `target`. Returns a disposer that
 * stops observing. Safe to call multiple times for the same pair: each
 * call creates an independent observer the caller is responsible for
 * disposing.
 */
export const bridgeAttribute = (
  target: Element,
  options: AttributeBridgeOptions,
): (() => void) => {
  const source = options.source ?? document.documentElement;
  const map = options.map ?? ((value) => value);

  const apply = (): void => {
    const next = map(source.getAttribute(options.sourceAttribute));
    if (next === null) {
      target.removeAttribute(options.targetAttribute);
    } else {
      target.setAttribute(options.targetAttribute, next);
    }
  };

  apply();

  const observer = new MutationObserver(apply);
  observer.observe(source, {
    attributes: true,
    attributeFilter: [options.sourceAttribute],
  });

  return () => observer.disconnect();
};

/**
 * react-grab-specific policy: AdCreative v2 (and any host using the same
 * convention) toggles `<html data-color-scheme="light">`; default = dark
 * when the attribute is absent or set to `"dark"`.
 *
 * shadcn-solid's idiom is the inverse: light is the default, dark is the
 * opt-in via `data-kb-theme="dark"`. We bridge between the two:
 *
 *   AdCreative `data-color-scheme`  →  react-grab `data-kb-theme`
 *   ──────────────────────────────────────────────────────────────
 *   "light"                         →  (absent — use :host light default)
 *   "dark" / absent / anything else →  "dark"
 *
 * This is the *only* place that knows about that mapping.
 *
 * Idempotent: calling it more than once for the same target is a no-op,
 * so the cached re-mount path in mountRoot() can call it unconditionally.
 */
const bridgedTargets = new WeakSet<Element>();

export const syncColorScheme = (target: Element): (() => void) => {
  if (bridgedTargets.has(target)) {
    return () => {};
  }
  bridgedTargets.add(target);
  return bridgeAttribute(target, {
    sourceAttribute: "data-color-scheme",
    targetAttribute: "data-kb-theme",
    map: (value) => (value === "light" ? null : "dark"),
  });
};
