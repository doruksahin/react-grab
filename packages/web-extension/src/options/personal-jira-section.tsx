import { Show, createSignal } from "solid-js";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import type { JiraUserIdentity } from "../settings/types.js";
import { describeError } from "./describe-error.js";
import { formField } from "./form-field.js";

interface PersonalJiraSectionProps {
  identity: JiraUserIdentity | null;
  onChanged: () => void;
}

const API_TOKENS_URL =
  "https://id.atlassian.com/manage-profile/security/api-tokens";

/**
 * The user's own Jira account (ADR-0031): tickets and comments they make go
 * to Jira as them, and their selections carry their name. Only the service
 * worker keeps the token.
 */
export const PersonalJiraSection = (props: PersonalJiraSectionProps) => {
  const [status, setStatus] = createSignal("");

  const connect = async (form: HTMLFormElement): Promise<void> => {
    setStatus("Checking with Jira…");
    const identity = await settingsMessenger.sendMessage(
      "connectPersonalJira",
      {
        email: formField(form, "email"),
        apiToken: formField(form, "apiToken"),
      },
    );
    form.reset();
    setStatus(`Signed in as ${identity.displayName}.`);
    props.onChanged();
  };

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    connect(event.currentTarget).catch((error: unknown) =>
      setStatus(describeError(error)),
    );
  };

  const disconnect = () => {
    settingsMessenger
      .sendMessage("disconnectPersonalJira", undefined)
      .then(() => {
        setStatus(
          "Signed out. Jira work goes through the workspace's account.",
        );
        props.onChanged();
      })
      .catch((error: unknown) => setStatus(describeError(error)));
  };

  return (
    <section
      id="your-jira-account"
      aria-labelledby="personal-jira-heading"
      data-personal-jira
    >
      <h2 id="personal-jira-heading">Your Jira account</h2>
      <Show
        when={props.identity}
        fallback={
          <p>
            Tickets and comments you make go to Jira as you, and your selections
            show your name. Without it, they go through the workspace&#39;s
            account.
          </p>
        }
      >
        {(identity) => (
          <p data-personal-jira-identity>
            Signed in as <strong>{identity().displayName}</strong>{" "}
            <button type="button" onClick={disconnect}>
              Sign out
            </button>
          </p>
        )}
      </Show>
      <form onSubmit={handleSubmit} aria-labelledby="personal-jira-heading">
        <fieldset>
          <label>
            Atlassian email
            <input name="email" type="email" required autocomplete="email" />
          </label>
          <label>
            API token
            <input
              name="apiToken"
              type="password"
              required
              autocomplete="off"
              placeholder={props.identity ? "Saved" : ""}
            />
          </label>
          <p>
            Create one at{" "}
            <a href={API_TOKENS_URL} target="_blank" rel="noreferrer">
              id.atlassian.com → Security → API tokens
            </a>
            .
          </p>
          <button type="submit">
            {props.identity ? "Replace token" : "Connect"}
          </button>
          <p role="status">{status()}</p>
        </fieldset>
      </form>
    </section>
  );
};
