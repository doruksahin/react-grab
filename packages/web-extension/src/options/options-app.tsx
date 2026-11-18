import {
  type JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  on,
} from "solid-js";
import { AddSiteForm } from "./add-site-form.jsx";
import { linkedSiteOrigin } from "./add-site-link.js";
import { JiraAccountsSection } from "./jira-accounts-section.jsx";
import { loadOptionsState } from "./load-options-state.js";
import { ServerSettingsForm } from "./server-settings-form.jsx";
import { SettingsNav } from "./settings-nav.jsx";
import { type SectionId, sectionOfHash } from "./settings-sections.js";
import { SetupChecklist } from "./setup-checklist.jsx";
import { setupSteps } from "./setup-steps.js";
import { SiteList } from "./site-list.jsx";
import { useLocationHash } from "./use-location-hash.js";
import { WorkspacesSection } from "./workspaces-section.jsx";

const CONNECTION_BADGES = {
  "not-configured": "Not set",
  connected: "OK",
  failed: "Error",
} as const;

/**
 * The settings page: a left nav of sections, one shown at a time. Each row
 * links to the row it uses, in whichever section holds it.
 */
export const OptionsApp = () => {
  const [optionsState, { refetch }] = createResource(loadOptionsState);
  const reload = () => {
    void refetch();
  };
  const hash = useLocationHash();

  return (
    <Show when={optionsState()} fallback={<p>Loading settings…</p>}>
      {(state) => {
        // Runs once the settings show, so a link from the popup (#add-site) finds its form too.
        createEffect(
          on(hash, (current) => {
            queueMicrotask(() => {
              const target = document.getElementById(current.replace(/^#/, ""));
              if (target instanceof HTMLDetailsElement) target.open = true;
              target?.scrollIntoView({ block: "nearest" });
            });
          }),
        );
        const connection = () => state().connection;
        const isConnected = () => connection().kind === "connected";
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
        const active = () =>
          sectionOfHash(hash(), isConnected() ? "sites" : "sync-server");
        const badges = (): Record<SectionId, string> => ({
          "sync-server": CONNECTION_BADGES[connection().kind],
          sites: String(Object.keys(state().sites).length),
          workspaces: isConnected() ? String(workspaces().length) : "",
          "jira-accounts": accounts()?.length.toString() ?? "",
        });
        const steps = () =>
          setupSteps({
            isConnected: isConnected(),
            accounts: accounts(),
            workspaces: workspaces(),
            sites: state().sites,
          });
        const panel = (id: SectionId, content: JSX.Element) => (
          <div hidden={active() !== id}>{content}</div>
        );

        return (
          <div class="settings-layout">
            <SettingsNav active={active()} badges={badges()} />
            <div class="settings-panel">
              <SetupChecklist steps={steps()} />
              {panel(
                "sync-server",
                <ServerSettingsForm
                  serverUrl={state().serverUrl}
                  hasApiToken={state().hasApiToken}
                  hasAdminToken={state().hasAdminToken}
                  connection={connection()}
                  onSaved={reload}
                />,
              )}
              {panel(
                "sites",
                <>
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
                    initialOrigin={linkedSiteOrigin(window.location.search)}
                    onSaved={reload}
                  />
                </>,
              )}
              {panel(
                "workspaces",
                <Show
                  when={isConnected()}
                  fallback={
                    <p>
                      <a href="#sync-server">Connect the sync server</a> first.
                    </p>
                  }
                >
                  <WorkspacesSection
                    workspaces={workspaces()}
                    accounts={accounts() ?? []}
                    sites={state().sites}
                    canManageJira={accounts() !== null}
                    onChanged={reload}
                  />
                </Show>,
              )}
              {panel(
                "jira-accounts",
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
                      Needs the <a href="#sync-server">admin token</a>.
                    </p>
                  </Match>
                  <Match when={failure()}>
                    {(message) => <p role="alert">{message()}</p>}
                  </Match>
                </Switch>,
              )}
            </div>
          </div>
        );
      }}
    </Show>
  );
};
