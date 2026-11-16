import { For, Show, createSignal } from "solid-js";
import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { describeError } from "./describe-error.js";
import { describeDestination } from "./describe-destination.js";
import { formField } from "./form-field.js";
import { JiraDestinationFields } from "./jira-destination-fields.jsx";

interface WorkspacesSectionProps {
  workspaces: WorkspaceSummary[];
  accounts: JiraAccountSummary[];
  onChanged: () => void;
}

/**
 * Where each workspace's new tickets go (ADR-0027). Changing it moves only
 * new tickets: a ticket stays with the account that created it.
 */
export const WorkspacesSection = (props: WorkspacesSectionProps) => {
  const [status, setStatus] = createSignal("");
  const [editing, setEditing] = createSignal<string | null>(null);

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
    <section aria-labelledby="workspaces-heading" data-workspaces>
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
              <th scope="col">
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={props.workspaces}>
              {(workspace) => (
                <tr>
                  <td>{workspace.id}</td>
                  <td>
                    <Show
                      when={editing() === workspace.id}
                      fallback={describeDestination(workspace, props.accounts)}
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
                    <Show when={editing() !== workspace.id}>
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
