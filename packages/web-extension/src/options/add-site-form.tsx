import { For, Show, createSignal } from "solid-js";
import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import {
  siteOriginSchema,
  siteSettingsSchema,
} from "../settings/settings-schema.js";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { describeDestination } from "./describe-destination.js";
import { describeError } from "./describe-error.js";
import { formCheckbox, formField } from "./form-field.js";
import { JiraDestinationFields } from "./jira-destination-fields.jsx";
import { requestOriginPermission } from "./request-origin-permission.js";

// A workspace id is never empty (siteSettingsSchema), so "" cannot collide.
const NEW_WORKSPACE = "";

interface AddSiteFormProps {
  workspaces: WorkspaceSummary[];
  accounts: JiraAccountSummary[];
  /** False when the admin token is missing: the workspace is typed, with the known ones suggested. */
  canManageJira: boolean;
  /** Open on first run, closed once a site exists. */
  startsOpen: boolean;
  onSaved: () => void;
}

export const AddSiteForm = (props: AddSiteFormProps) => {
  const [status, setStatus] = createSignal("");
  // A typed workspace starts empty; a chosen one starts on the first in the list.
  const initialChoice = () =>
    props.canManageJira ? (props.workspaces[0]?.id ?? NEW_WORKSPACE) : "";
  const [choice, setChoice] = createSignal(initialChoice());
  // Read once: closing the form right after the first site would hide its status.
  const startsOpen = props.startsOpen;
  const chosenWorkspace = () =>
    props.workspaces.find((workspace) => workspace.id === choice());

  const save = async (form: HTMLFormElement): Promise<void> => {
    const origin = siteOriginSchema.parse(formField(form, "origin"));
    const isNew = props.canManageJira && choice() === NEW_WORKSPACE;
    const workspace = !props.canManageJira
      ? formField(form, "workspace")
      : isNew
        ? formField(form, "newWorkspace")
        : choice();
    if (isNew && props.workspaces.some((known) => known.id === workspace)) {
      throw new Error(
        `${workspace} already exists. Choose it from the list, or change it under Workspaces.`,
      );
    }
    const site = siteSettingsSchema.parse({
      workspace,
      recordSteps: formCheckbox(form, "recordSteps"),
      recordSession: formCheckbox(form, "recordSession"),
    });
    await requestOriginPermission(origin);
    if (isNew) {
      // The server checks the project before the workspace is created.
      await settingsMessenger.sendMessage("setJiraDestination", {
        workspaceId: site.workspace,
        jiraAccountId: formField(form, "jiraAccountId"),
        projectKey: formField(form, "projectKey"),
      });
    }
    await settingsMessenger.sendMessage("saveSite", { origin, site });
    form.reset();
    setChoice(initialChoice());
    setStatus(`Enabled ${origin} for ${site.workspace}.`);
    props.onSaved();
  };

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    save(event.currentTarget).catch((error: unknown) =>
      setStatus(describeError(error)),
    );
  };

  return (
    <details id="add-site" open={startsOpen}>
      <summary id="add-site-heading">Enable a site</summary>
      <form
        onSubmit={handleSubmit}
        aria-labelledby="add-site-heading"
        data-add-site
      >
        <fieldset>
          <label>
            Site address
            <input
              name="origin"
              type="url"
              required
              placeholder="https://app.example.com"
            />
          </label>
          <Show
            when={props.canManageJira}
            fallback={
              <label>
                Workspace
                <input
                  name="workspace"
                  required
                  list="known-workspaces"
                  autocomplete="off"
                  onInput={(event) => setChoice(event.currentTarget.value)}
                />
                <datalist id="known-workspaces">
                  <For each={props.workspaces}>
                    {(workspace) => <option value={workspace.id} />}
                  </For>
                </datalist>
              </label>
            }
          >
            <label>
              Workspace
              <select
                name="workspace"
                value={choice()}
                onChange={(event) => setChoice(event.currentTarget.value)}
              >
                <For each={props.workspaces}>
                  {(workspace) => (
                    <option value={workspace.id}>{workspace.id}</option>
                  )}
                </For>
                <option value={NEW_WORKSPACE}>New workspace…</option>
              </select>
            </label>
          </Show>
          <Show
            when={props.canManageJira && choice() === NEW_WORKSPACE}
            fallback={
              <Show when={chosenWorkspace()}>
                {(workspace) => (
                  <p data-workspace-destination>
                    Tickets go to{" "}
                    {describeDestination(workspace(), props.accounts)}.{" "}
                    {props.canManageJira
                      ? "Change it under Workspaces."
                      : "Someone with the admin token can change it."}
                  </p>
                )}
              </Show>
            }
          >
            <label>
              Workspace name
              <input
                name="newWorkspace"
                required
                placeholder="my-app-workspace"
              />
            </label>
            <Show
              when={props.accounts.length > 0}
              fallback={<p role="alert">Add a Jira account first.</p>}
            >
              <JiraDestinationFields accounts={props.accounts} />
            </Show>
          </Show>
          <label>
            <input name="recordSteps" type="checkbox" />
            Record steps: save the clicks and field changes that led to each
            comment. Typed values are never saved.
          </label>
          <label>
            <input name="recordSession" type="checkbox" />
            Record session: keep the last minutes as a replay and link it from
            each comment. Inputs are masked.
          </label>
          <button type="submit">Enable site</button>
          <p role="status">{status()}</p>
        </fieldset>
      </form>
    </details>
  );
};
