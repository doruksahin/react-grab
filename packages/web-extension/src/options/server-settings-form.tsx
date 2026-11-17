import { createSignal } from "solid-js";
import { serverUrlSchema } from "../settings/settings-schema.js";
import {
  saveAdminToken,
  saveApiToken,
  saveServerUrl,
} from "../settings/settings-items.js";
import { describeError } from "./describe-error.js";
import { formField } from "./form-field.js";
import type { ServerConnection } from "./load-options-state.js";
import { requestOriginPermission } from "./request-origin-permission.js";
import { siteHost } from "./site-host.js";

interface ServerSettingsFormProps {
  serverUrl: string;
  hasApiToken: boolean;
  hasAdminToken: boolean;
  connection: ServerConnection;
  onSaved: () => void;
}

const describeConnection = (props: ServerSettingsFormProps): string => {
  const { connection } = props;
  if (connection.kind === "not-configured") return "Not connected";
  if (connection.kind === "failed") {
    return `Can't connect: ${connection.message}`;
  }
  const admin = props.hasAdminToken ? "admin token saved" : "no admin token";
  return `Connected to ${siteHost(props.serverUrl)} · ${admin}`;
};

/** The extension keeps the tokens; pages on enabled sites never see them (ADR-0023). */
export const ServerSettingsForm = (props: ServerSettingsFormProps) => {
  const [status, setStatus] = createSignal("");

  const save = async (form: HTMLFormElement): Promise<void> => {
    const serverUrl = serverUrlSchema.parse(formField(form, "serverUrl"));
    const apiToken = formField(form, "apiToken");
    await requestOriginPermission(new URL(serverUrl).origin);
    await saveServerUrl(serverUrl);
    if (apiToken) await saveApiToken(apiToken);
    const adminToken = formField(form, "adminToken");
    if (adminToken) await saveAdminToken(adminToken);
    form.reset();
    setStatus("Saved.");
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
    <section id="sync-server" aria-labelledby="server-heading" data-sync-server>
      <h2 id="server-heading">Sync server</h2>
      <p data-connection={props.connection.kind}>{describeConnection(props)}</p>
      <form onSubmit={handleSubmit} aria-labelledby="server-heading">
        <fieldset>
          <label>
            Server URL
            <input
              name="serverUrl"
              type="url"
              required
              value={props.serverUrl}
              placeholder="https://sync.example.com"
            />
          </label>
          <label>
            API token
            <input
              name="apiToken"
              type="password"
              autocomplete="off"
              required={!props.hasApiToken}
              placeholder={props.hasApiToken ? "Saved" : ""}
            />
          </label>
          <label>
            Admin token (optional)
            <input
              name="adminToken"
              type="password"
              autocomplete="off"
              placeholder={props.hasAdminToken ? "Saved" : "For Jira setup"}
            />
          </label>
          <button type="submit">Save server</button>
          <p role="status">{status()}</p>
        </fieldset>
      </form>
    </section>
  );
};
