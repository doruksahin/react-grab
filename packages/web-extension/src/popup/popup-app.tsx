import { Show, createResource } from "solid-js";
import { addSitePath } from "../options/add-site-link.js";
import { siteHost } from "../options/site-host.js";
import { enabledItem } from "../storage/overlay-items.js";
import { openSettings } from "./open-settings.js";
import { readActiveTabSite } from "./read-active-tab-site.js";

/**
 * The action popup: turns the overlay on or off, warns when the active tab's
 * site is not added, and links to the settings page. The background watches
 * the enabled flag for the badge and the tabs.
 */
export const PopupApp = () => {
  const [enabled, { mutate }] = createResource(() => enabledItem.getValue());
  const [activeTabSite] = createResource(readActiveTabSite);

  const setEnabled = async (nextEnabled: boolean): Promise<void> => {
    mutate(nextEnabled);
    await enabledItem.setValue(nextEnabled);
  };

  const siteNotAdded = () => {
    const site = activeTabSite();
    return site && !site.isAdded ? site : undefined;
  };

  return (
    <>
      <h1>React Grab</h1>
      <Show when={enabled() !== undefined}>
        <label>
          <input
            type="checkbox"
            role="switch"
            checked={enabled()}
            onChange={(event) => void setEnabled(event.currentTarget.checked)}
          />
          Overlay on
        </label>
      </Show>
      <Show when={siteNotAdded()}>
        {(site) => (
          <section role="alert" data-popup-site-warning>
            <p>
              <strong>{siteHost(site().origin)}</strong> is not added, so the
              overlay does not run on it.
            </p>
            <button
              type="button"
              onClick={() => void openSettings(addSitePath(site().origin))}
            >
              Add this site
            </button>
          </section>
        )}
      </Show>
      <button type="button" onClick={() => void openSettings()}>
        Settings
      </button>
    </>
  );
};
