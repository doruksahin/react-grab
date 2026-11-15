import { Show, createResource } from "solid-js";
import { AddSiteForm } from "./add-site-form.jsx";
import { loadOptionsState } from "./load-options-state.js";
import { ServerSettingsForm } from "./server-settings-form.jsx";
import { SiteList } from "./site-list.jsx";

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
        {(state) => (
          <>
            <ServerSettingsForm
              serverUrl={state().serverUrl}
              hasApiToken={state().hasApiToken}
              onSaved={reload}
            />
            <SiteList sites={state().sites} onRemoved={reload} />
            <AddSiteForm onSaved={reload} />
          </>
        )}
      </Show>
    </>
  );
};
