import { type Accessor, createMemo, createSignal, onCleanup } from "solid-js";

/**
 * The current page URL as a signal (ADR-0024). The Navigation API reports
 * every same-document navigation, pushState included; DOM changes are a
 * fallback for browsers without it. Equal strings do not notify.
 * External bridge: window.navigation.
 */
export const createCurrentPageUrl = (
  domChanged: Accessor<unknown>,
): Accessor<string> => {
  const [entryVersion, setEntryVersion] = createSignal(0);
  const onEntryChange = () => setEntryVersion((version) => version + 1);

  const navigation = window.navigation;
  navigation?.addEventListener("currententrychange", onEntryChange);
  onCleanup(() =>
    navigation?.removeEventListener("currententrychange", onEntryChange),
  );

  return createMemo(() => {
    void entryVersion();
    void domChanged();
    return window.location.href;
  });
};
