import { For, Show, createSignal } from "solid-js";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";
import { describeError } from "./describe-error.js";

interface SiteListProps {
  sites: SiteSettingsByOrigin;
  onRemoved: () => void;
}

export const SiteList = (props: SiteListProps) => {
  const [status, setStatus] = createSignal("");
  const siteEntries = () => Object.entries(props.sites);

  const handleRemove = (origin: string) => {
    settingsMessenger
      .sendMessage("removeSites", [origin])
      .then(() => {
        setStatus(`Disabled ${origin}.`);
        props.onRemoved();
      })
      .catch((error: unknown) => setStatus(describeError(error)));
  };

  return (
    <section aria-labelledby="sites-heading">
      <h2 id="sites-heading">Enabled sites</h2>
      <Show
        when={siteEntries().length > 0}
        fallback={<p>No site is enabled yet.</p>}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Site</th>
              <th scope="col">Workspace</th>
              <th scope="col">Jira project</th>
              <th scope="col">
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={siteEntries()}>
              {([origin, site]) => (
                <tr>
                  <td>{origin}</td>
                  <td>{site.workspace}</td>
                  <td>{site.jiraProjectKey}</td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Disable ${origin}`}
                      onClick={() => handleRemove(origin)}
                    >
                      Disable
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
      <p role="status">{status()}</p>
    </section>
  );
};
