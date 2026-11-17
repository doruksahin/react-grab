import { For, Show, createSignal } from "solid-js";
import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { anchorHref, anchorId } from "./anchor-id.js";
import { describeError } from "./describe-error.js";
import { formField } from "./form-field.js";
import { siteHost } from "./site-host.js";

interface JiraAccountsSectionProps {
  accounts: JiraAccountSummary[];
  workspaces: WorkspaceSummary[];
  onChanged: () => void;
}

/**
 * Jira accounts on the sync server (ADR-0027). The server signs in to Jira
 * before saving one, and never sends a token back: it can only be replaced.
 */
export const JiraAccountsSection = (props: JiraAccountsSectionProps) => {
  const [status, setStatus] = createSignal("");
  const [replacing, setReplacing] = createSignal<string | null>(null);
  const startsOpen = props.accounts.length === 0;
  const workspacesOf = (accountId: string) =>
    props.workspaces.filter(
      (workspace) => workspace.jiraAccountId === accountId,
    );

  const run = (action: () => Promise<string>) => {
    setStatus("Working…");
    action()
      .then((message) => {
        setStatus(message);
        props.onChanged();
      })
      .catch((error: unknown) => setStatus(describeError(error)));
  };

  const handleAdd = (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    run(async () => {
      const account = await settingsMessenger.sendMessage("addJiraAccount", {
        siteUrl: formField(form, "siteUrl"),
        email: formField(form, "email"),
        apiToken: formField(form, "apiToken"),
      });
      form.reset();
      return `Connected as ${account.displayName} on ${siteHost(account.siteUrl)}.`;
    });
  };

  const handleReplace = (event: SubmitEvent, accountId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    run(async () => {
      const account = await settingsMessenger.sendMessage(
        "replaceJiraCredential",
        { accountId, apiToken: formField(form, "apiToken") },
      );
      setReplacing(null);
      return `Replaced the token of ${account.displayName}.`;
    });
  };

  const handleRemove = (account: JiraAccountSummary) => {
    const label = `${account.displayName} on ${siteHost(account.siteUrl)}`;
    if (!window.confirm(`Remove the Jira account ${label}?`)) return;
    run(async () => {
      await settingsMessenger.sendMessage("removeJiraAccount", account.id);
      return `Removed ${label}.`;
    });
  };

  return (
    <section aria-labelledby="jira-accounts-heading" data-jira-accounts>
      <h2 id="jira-accounts-heading">Jira accounts</h2>
      <Show when={props.accounts.length > 0} fallback={<p>No account yet.</p>}>
        <table>
          <thead>
            <tr>
              <th scope="col">Site</th>
              <th scope="col">Signs in as</th>
              <th scope="col">Used by</th>
              <th scope="col">
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={props.accounts}>
              {(account) => (
                <tr id={anchorId("jira-account", account.id)}>
                  <td>{siteHost(account.siteUrl)}</td>
                  <td>
                    {account.displayName}
                    <br />
                    <small>{account.email}</small>
                  </td>
                  <td>
                    <Show
                      when={workspacesOf(account.id).length > 0}
                      fallback={
                        account.workspaceCount > 0
                          ? `${account.workspaceCount} workspaces`
                          : "No workspace"
                      }
                    >
                      <For each={workspacesOf(account.id)}>
                        {(workspace, index) => (
                          <>
                            {index() > 0 ? ", " : ""}
                            <a href={anchorHref("workspace", workspace.id)}>
                              {workspace.id}
                            </a>
                          </>
                        )}
                      </For>
                    </Show>
                  </td>
                  <td>
                    <Show
                      when={replacing() === account.id}
                      fallback={
                        <>
                          <button
                            type="button"
                            onClick={() => setReplacing(account.id)}
                          >
                            Replace token
                          </button>{" "}
                          <button
                            type="button"
                            disabled={account.workspaceCount > 0}
                            title={
                              account.workspaceCount > 0
                                ? "In use by a workspace"
                                : undefined
                            }
                            onClick={() => handleRemove(account)}
                          >
                            Remove
                          </button>
                        </>
                      }
                    >
                      <form
                        onSubmit={(event) => handleReplace(event, account.id)}
                      >
                        <label>
                          New API token
                          <input
                            name="apiToken"
                            type="password"
                            autocomplete="off"
                            required
                          />
                        </label>
                        <button type="submit">Save token</button>
                      </form>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <details id="add-jira-account" open={startsOpen}>
        <summary id="add-jira-account-heading">Add a Jira account</summary>
        <form onSubmit={handleAdd} aria-labelledby="add-jira-account-heading">
          <fieldset>
            <label>
              Jira site
              <input
                name="siteUrl"
                type="url"
                required
                placeholder="https://acme.atlassian.net"
              />
            </label>
            <label>
              Email
              <input name="email" type="email" required autocomplete="off" />
            </label>
            <label>
              API token
              <input
                name="apiToken"
                type="password"
                required
                autocomplete="off"
              />
            </label>
            <small>From id.atlassian.com → Security → API tokens.</small>
            <button type="submit">Connect</button>
          </fieldset>
        </form>
      </details>
      <p role="status">{status()}</p>
    </section>
  );
};
