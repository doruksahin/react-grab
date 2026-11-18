import { assertExtensionPageSender } from "../gateway/sender-policy.js";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import {
  type VerifyJiraUser,
  connectPersonalJira,
  disconnectPersonalJira,
} from "./connect-personal-jira.js";
import { settingsWriteQueue } from "./queues.js";

/** The settings page's "Your Jira account" section (ADR-0031). */
export const handlePersonalJiraRequests = (
  ready: Promise<void>,
  verify?: VerifyJiraUser,
): void => {
  settingsMessenger.onMessage(
    "connectPersonalJira",
    async ({ data, sender }) => {
      await ready;
      assertExtensionPageSender(sender);
      return settingsWriteQueue.run(() => connectPersonalJira(data, verify));
    },
  );

  settingsMessenger.onMessage("disconnectPersonalJira", async ({ sender }) => {
    await ready;
    assertExtensionPageSender(sender);
    await settingsWriteQueue.run(disconnectPersonalJira);
  });
};
