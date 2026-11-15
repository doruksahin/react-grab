import { createSignal } from "solid-js";
import {
  siteOriginSchema,
  siteSettingsSchema,
} from "../settings/settings-schema.js";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { describeError } from "./describe-error.js";
import { formField } from "./form-field.js";
import { requestOriginPermission } from "./request-origin-permission.js";

interface AddSiteFormProps {
  onSaved: () => void;
}

export const AddSiteForm = (props: AddSiteFormProps) => {
  const [status, setStatus] = createSignal("");

  const save = async (form: HTMLFormElement): Promise<void> => {
    const origin = siteOriginSchema.parse(formField(form, "origin"));
    const site = siteSettingsSchema.parse({
      workspace: formField(form, "workspace"),
      jiraProjectKey: formField(form, "jiraProjectKey"),
    });
    await requestOriginPermission(origin);
    await settingsMessenger.sendMessage("saveSite", { origin, site });
    form.reset();
    setStatus(`Enabled ${origin}.`);
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
    <form onSubmit={handleSubmit} aria-labelledby="add-site-heading">
      <fieldset>
        <legend id="add-site-heading">Enable a site</legend>
        <label>
          Site address
          <input
            name="origin"
            type="url"
            required
            placeholder="https://app.example.com"
          />
        </label>
        <label>
          Workspace
          <input name="workspace" required />
        </label>
        <label>
          Jira project key
          <input name="jiraProjectKey" required placeholder="ATT" />
        </label>
        <button type="submit">Enable site</button>
        <p role="status">{status()}</p>
      </fieldset>
    </form>
  );
};
