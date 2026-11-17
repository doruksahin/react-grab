import { Match, Show, Switch, createResource } from "solid-js";
import { AddSiteForm } from "./add-site-form.jsx";
import { JiraAccountsSection } from "./jira-accounts-section.jsx";
import { loadOptionsState } from "./load-options-state.js";
import { ServerSettingsForm } from "./server-settings-form.jsx";
import { SetupChecklist } from "./setup-checklist.jsx";
import { setupSteps } from "./setup-steps.js";
import { SiteList } from "./site-list.jsx";
import { WorkspacesSection } from "./workspaces-section.jsx";

/**
 * The settings page, in the order the parts depend on each other: the server,
 * Jira accounts, workspaces, then this browser's sites. Each row links to the
 * row it uses.
 */
export const OptionsApp = () => {
  const [optionsState, { refetch }] = createResource(loadOptionsState);
  const reload = () => {
    void refetch();
  };

  return (
    <>
      <h1>React Grab settings</h1>
      <p>
        The extension holds the sync server token. Pages on enabled sites reach
        the server only through the extension and never see the token.
      </p>
      <Show when={optionsState()} fallback={<p>Loading settings…</p>}>
        {(state) => {
          const connection = () => state().connection;
          const workspaces = () => {
            const current = connection();
            return current.kind === "connected" ? current.workspaces : [];
          };
          const jira = () => state().jira;
          const accounts = () => {
            const current = jira();
            return current.kind === "ready" ? current.accounts : null;
          };
          const failure = () => {
            const current = jira();
            return current.kind === "failed" ? current.message : null;
          };
          const steps = () =>
            setupSteps({
              isConnected: connection().kind === "connected",
              accounts: accounts(),
              workspaces: workspaces(),
              sites: state().sites,
            });
          return (
            <>
              <SetupChecklist steps={steps()} />
              <ServerSettingsForm
                serverUrl={state().serverUrl}
                hasApiToken={state().hasApiToken}
                hasAdminToken={state().hasAdminToken}
                connection={connection()}
                onSaved={reload}
              />
              <Switch>
                <Match when={accounts()}>
                  {(ready) => (
                    <JiraAccountsSection
                      accounts={ready()}
                      workspaces={workspaces()}
                      onChanged={reload}
                    />
                  )}
                </Match>
                <Match when={jira().kind === "no-admin-token"}>
                  <p data-jira-admin-missing>
                    Enter the admin token under Sync server to add Jira accounts
                    and choose where each workspace's tickets go.
                  </p>
                </Match>
                <Match when={failure()}>
                  {(message) => (
                    <p role="alert">
                      Could not load Jira accounts: {message()}
                    </p>
                  )}
                </Match>
              </Switch>
              <Show when={connection().kind === "connected"}>
                <WorkspacesSection
                  workspaces={workspaces()}
                  accounts={accounts() ?? []}
                  sites={state().sites}
                  canManageJira={accounts() !== null}
                  onChanged={reload}
                />
              </Show>
              <SiteList
                sites={state().sites}
                workspaces={workspaces()}
                accounts={accounts() ?? []}
                onRemoved={reload}
              />
              <AddSiteForm
                workspaces={workspaces()}
                accounts={accounts() ?? []}
                canManageJira={accounts() !== null}
                startsOpen={Object.keys(state().sites).length === 0}
                onSaved={reload}
              />
            </>
          );
        }}
      </Show>
    </>
  );
};
