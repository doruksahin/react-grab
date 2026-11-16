import { For, Show, createResource, createSignal } from "solid-js";
import type { JiraAccountSummary } from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { describeError } from "./describe-error.js";
import { siteHost } from "./site-host.js";

interface JiraDestinationFieldsProps {
  accounts: JiraAccountSummary[];
  /** Preselected when editing an existing destination. */
  accountId?: string | null;
  projectKey?: string | null;
}

/**
 * A Jira account and one of its projects, loaded live from that account's
 * site (ADR-0027). Submits as `jiraAccountId` and `projectKey`.
 */
export const JiraDestinationFields = (props: JiraDestinationFieldsProps) => {
  const [accountId, setAccountId] = createSignal(
    props.accountId ?? props.accounts[0]?.id ?? "",
  );
  const [projects] = createResource(accountId, (id) =>
    id
      ? settingsMessenger.sendMessage("listJiraProjects", id)
      : Promise.resolve([]),
  );

  return (
    <>
      <label>
        Jira account
        <select
          name="jiraAccountId"
          required
          value={accountId()}
          onChange={(event) => setAccountId(event.currentTarget.value)}
        >
          <For each={props.accounts}>
            {(account) => (
              <option value={account.id}>
                {account.displayName} on {siteHost(account.siteUrl)}
              </option>
            )}
          </For>
        </select>
      </label>
      <label>
        Jira project
        <Show
          when={projects.state !== "errored"}
          fallback={<span role="alert">{describeError(projects.error)}</span>}
        >
          <select
            name="projectKey"
            required
            disabled={projects.loading}
            value={props.projectKey ?? ""}
          >
            <Show when={projects.loading}>
              <option value="">Loading projects…</option>
            </Show>
            <For each={projects.latest ?? []}>
              {(project) => (
                <option value={project.key}>
                  {project.key} · {project.name}
                </option>
              )}
            </For>
          </select>
        </Show>
      </label>
    </>
  );
};
