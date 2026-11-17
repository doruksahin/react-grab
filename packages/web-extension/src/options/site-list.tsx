import { For, Show, createSignal } from "solid-js";
import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";
import { anchorHref } from "./anchor-id.js";
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
  const describeRecording = (recordSteps: boolean, recordSession: boolean) =>
    [recordSteps && "Steps", recordSession && "Session"]
      .filter(Boolean)
      .join(", ") || "Off";

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
      <h2 id="sites-heading">Sites</h2>
      <Show when={siteEntries().length > 0} fallback={<p>No site yet.</p>}>
        <table>
          <thead>
            <tr>
              <th scope="col">Site</th>
              <th scope="col">Workspace</th>
              <th scope="col">Records</th>
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
                      {(workspace) => (
                        <>
                          <a href={anchorHref("workspace", site.workspace)}>
                            {site.workspace}
                          </a>
                          <Show when={workspace().jiraProjectKey}>
                            {(projectKey) => <small> → {projectKey()}</small>}
                          </Show>
                        </>
                      )}
                    </Show>
                  </td>
                  <td>
                    {describeRecording(site.recordSteps, site.recordSession)}
                  </td>
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
