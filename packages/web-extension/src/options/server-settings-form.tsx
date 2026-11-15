import { createSignal } from "solid-js";
import { serverUrlSchema } from "../settings/settings-schema.js";
import { saveApiToken, saveServerUrl } from "../settings/settings-items.js";
import { describeError } from "./describe-error.js";
import { formField } from "./form-field.js";
import { requestOriginPermission } from "./request-origin-permission.js";

interface ServerSettingsFormProps {
  serverUrl: string;
  hasApiToken: boolean;
  onSaved: () => void;
}

export const ServerSettingsForm = (props: ServerSettingsFormProps) => {
  const [status, setStatus] = createSignal("");

  const save = async (form: HTMLFormElement): Promise<void> => {
    const serverUrl = serverUrlSchema.parse(formField(form, "serverUrl"));
    const apiToken = formField(form, "apiToken");
    await requestOriginPermission(new URL(serverUrl).origin);
    await saveServerUrl(serverUrl);
    if (apiToken) await saveApiToken(apiToken);
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
    <form onSubmit={handleSubmit} aria-labelledby="server-heading">
      <fieldset>
        <legend id="server-heading">Sync server</legend>
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
            placeholder={
              props.hasApiToken ? "Saved. Enter a new token to replace it." : ""
            }
          />
        </label>
        <button type="submit">Save server</button>
        <p role="status">{status()}</p>
      </fieldset>
    </form>
  );
};
