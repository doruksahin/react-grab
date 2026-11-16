import { Match, Show, Switch, createResource } from "solid-js";
import { AddSiteForm } from "./add-site-form.jsx";
import { JiraAccountsSection } from "./jira-accounts-section.jsx";
import { loadOptionsState } from "./load-options-state.js";
import { ServerSettingsForm } from "./server-settings-form.jsx";
import { SiteList } from "./site-list.jsx";
import { WorkspacesSection } from "./workspaces-section.jsx";

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
          const jira = () => state().jira;
          const ready = () => {
            const current = jira();
            return current.kind === "ready" ? current : null;
          };
          const failure = () => {
            const current = jira();
            return current.kind === "failed" ? current.message : null;
          };
          return (
            <>
              <ServerSettingsForm
                serverUrl={state().serverUrl}
                hasApiToken={state().hasApiToken}
                hasAdminToken={state().hasAdminToken}
                onSaved={reload}
              />
              <Switch>
                <Match when={ready()}>
                  {(admin) => (
                    <>
                      <JiraAccountsSection
                        accounts={admin().accounts}
                        onChanged={reload}
                      />
                      <WorkspacesSection
                        workspaces={admin().workspaces}
                        accounts={admin().accounts}
                        onChanged={reload}
                      />
                    </>
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
              <SiteList sites={state().sites} onRemoved={reload} />
              <AddSiteForm
                workspaces={ready()?.workspaces ?? []}
                accounts={ready()?.accounts ?? []}
                canManageJira={ready() !== null}
                onSaved={reload}
              />
            </>
          );
        }}
      </Show>
    </>
  );
};
