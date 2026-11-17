import { For, Show, createSignal } from "solid-js";
import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";
import { anchorHref } from "./anchor-id.js";
import { describeDestination } from "./describe-destination.js";
import { describeError } from "./describe-error.js";

interface SiteListProps {
  sites: SiteSettingsByOrigin;
  /** Empty when the server does not answer: the sites still show, they are stored here. */
  workspaces: WorkspaceSummary[];
  accounts: JiraAccountSummary[];
  onRemoved: () => void;
}

/** This browser's enabled sites, each with its workspace and where its tickets go. */
export const SiteList = (props: SiteListProps) => {
  const [status, setStatus] = createSignal("");
  const siteEntries = () => Object.entries(props.sites);
  const workspaceOf = (id: string) =>
    props.workspaces.find((workspace) => workspace.id === id);

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
    <section id="sites" aria-labelledby="sites-heading">
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
              <th scope="col">Tickets go to</th>
              <th scope="col">Steps</th>
              <th scope="col">Session</th>
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
                  <td>
                    <Show
                      when={workspaceOf(site.workspace)}
                      fallback={site.workspace}
                    >
                      <a href={anchorHref("workspace", site.workspace)}>
                        {site.workspace}
                      </a>
                    </Show>
                  </td>
                  <td>
                    <Show when={workspaceOf(site.workspace)} fallback="Unknown">
                      {(workspace) =>
                        describeDestination(workspace(), props.accounts)
                      }
                    </Show>
                  </td>
                  <td>{site.recordSteps ? "Recorded" : "Off"}</td>
                  <td>{site.recordSession ? "Recorded" : "Off"}</td>
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
