import { For, Show, createSignal } from "solid-js";
import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";
import { anchorHref, anchorId } from "./anchor-id.js";
import { describeError } from "./describe-error.js";
import { describeDestination } from "./describe-destination.js";
import { formField } from "./form-field.js";
import { JiraDestinationFields } from "./jira-destination-fields.jsx";

interface WorkspacesSectionProps {
  workspaces: WorkspaceSummary[];
  accounts: JiraAccountSummary[];
  sites: SiteSettingsByOrigin;
  /** False without the admin token: the destinations are then read only. */
  canManageJira: boolean;
  onChanged: () => void;
}

/**
 * Where each workspace's new tickets go (ADR-0027). Changing it moves only
 * new tickets: a ticket stays with the account that created it.
 */
export const WorkspacesSection = (props: WorkspacesSectionProps) => {
  const [status, setStatus] = createSignal("");
  const [editing, setEditing] = createSignal<string | null>(null);
  // Only this browser's sites: other people's sites are not stored here.
  const siteCount = (workspaceId: string) =>
    Object.values(props.sites).filter((site) => site.workspace === workspaceId)
      .length;

  const handleSave = (event: SubmitEvent, workspaceId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    setStatus("Checking the project…");
    settingsMessenger
      .sendMessage("setJiraDestination", {
        workspaceId,
        jiraAccountId: formField(form, "jiraAccountId"),
        projectKey: formField(form, "projectKey"),
      })
      .then((destination) => {
        setEditing(null);
        setStatus(
          `${workspaceId} now sends tickets to ${destination.projectKey}.`,
        );
        props.onChanged();
      })
      .catch((error: unknown) => setStatus(describeError(error)));
  };

  return (
    <section
      id="workspaces"
      aria-labelledby="workspaces-heading"
      data-workspaces
    >
      <h2 id="workspaces-heading">Workspaces</h2>
      <Show
        when={props.workspaces.length > 0}
        fallback={<p>No workspace yet. Enabling a site creates one.</p>}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Workspace</th>
              <th scope="col">Tickets go to</th>
              <th scope="col">Your sites</th>
              <th scope="col">
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={props.workspaces}>
              {(workspace) => (
                <tr id={anchorId("workspace", workspace.id)}>
                  <td>{workspace.id}</td>
                  <td>
                    <Show
                      when={editing() === workspace.id}
                      fallback={
                        <Show
                          when={props.canManageJira && workspace.jiraAccountId}
                          fallback={describeDestination(
                            workspace,
                            props.accounts,
                          )}
                        >
                          {(accountId) => (
                            <a href={anchorHref("jira-account", accountId())}>
                              {describeDestination(workspace, props.accounts)}
                            </a>
                          )}
                        </Show>
                      }
                    >
                      <form
                        onSubmit={(event) => handleSave(event, workspace.id)}
                      >
                        <JiraDestinationFields
                          accounts={props.accounts}
                          accountId={workspace.jiraAccountId}
                          projectKey={workspace.jiraProjectKey}
                        />
                        <button type="submit">Save</button>{" "}
                        <button type="button" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </form>
                    </Show>
                  </td>
                  <td>
                    <Show when={siteCount(workspace.id) > 0} fallback="None">
                      <a href="#sites">{siteCount(workspace.id)}</a>
                    </Show>
                  </td>
                  <td>
                    <Show
                      when={props.canManageJira && editing() !== workspace.id}
                    >
                      <button
                        type="button"
                        disabled={props.accounts.length === 0}
                        aria-label={`Edit ${workspace.id}`}
                        onClick={() => setEditing(workspace.id)}
                      >
                        Edit
                      </button>
                    </Show>
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
