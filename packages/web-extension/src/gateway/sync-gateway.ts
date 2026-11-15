import type { Browser } from "wxt/browser";
import {
  type JiraPort,
  type StorageAdapter,
  type SyncHttpConfig,
  createHttpAdapter,
  createHttpJiraPort,
} from "react-grab/sync-http";
import {
  JIRA_METHODS,
  type PortName,
  STORAGE_METHODS,
} from "../messaging/port-requests.js";
import { readSyncSettings } from "../settings/settings-items.js";
import {
  GatewayRefusalError,
  assertTopFrameSender,
  findSenderSite,
} from "./sender-policy.js";

export interface SyncPortFactories {
  createStorage: (config: SyncHttpConfig) => StorageAdapter;
  createJira: (config: SyncHttpConfig) => JiraPort;
}

export const HTTP_PORT_FACTORIES: SyncPortFactories = {
  createStorage: createHttpAdapter,
  createJira: createHttpJiraPort,
};

type PortMethodResult<Port, Method extends keyof Port> = Port[Method] extends (
  ...args: never[]
) => Promise<infer Result>
  ? Result
  : never;

export interface SyncGateway {
  callStorage: <Method extends keyof StorageAdapter & string>(
    method: Method,
    args: ReadonlyArray<unknown>,
    sender: Browser.runtime.MessageSender,
  ) => Promise<PortMethodResult<StorageAdapter, Method>>;
  callJira: <Method extends keyof JiraPort & string>(
    method: Method,
    args: ReadonlyArray<unknown>,
    sender: Browser.runtime.MessageSender,
  ) => Promise<PortMethodResult<JiraPort, Method>>;
}

const resolveConnection = async (
  sender: Browser.runtime.MessageSender,
): Promise<SyncHttpConfig> => {
  assertTopFrameSender(sender);
  const settings = await readSyncSettings();
  const site = findSenderSite(sender, settings.sites);
  if (!site) {
    throw new GatewayRefusalError(
      `${sender.origin ?? "this page"} is not an enabled site`,
    );
  }
  if (!settings.serverUrl || !settings.apiToken) {
    throw new GatewayRefusalError("the sync server is not configured");
  }
  return {
    serverUrl: settings.serverUrl,
    apiToken: settings.apiToken,
    workspace: site.workspace,
  };
};

const callPortMethod = async <
  Port extends {
    [Method in keyof Port]: (...args: never[]) => Promise<unknown>;
  },
  Method extends keyof Port & string,
>(
  methods: Record<keyof Port & string, true>,
  createPort: (config: SyncHttpConfig) => Port,
  portName: PortName,
  method: Method,
  args: ReadonlyArray<unknown>,
  sender: Browser.runtime.MessageSender,
): Promise<PortMethodResult<Port, Method>> => {
  if (!Object.hasOwn(methods, method)) {
    throw new GatewayRefusalError(`${portName}.${method} is not allowed`);
  }
  const port = createPort(await resolveConnection(sender));
  const result: PortMethodResult<Port, Method> = await Reflect.apply(
    port[method],
    port,
    args,
  );
  return result;
};

export const createSyncGateway = (
  factories: SyncPortFactories = HTTP_PORT_FACTORIES,
): SyncGateway => ({
  callStorage: (method, args, sender) =>
    callPortMethod(
      STORAGE_METHODS,
      factories.createStorage,
      "storage",
      method,
      args,
      sender,
    ),
  callJira: (method, args, sender) =>
    callPortMethod(
      JIRA_METHODS,
      factories.createJira,
      "jira",
      method,
      args,
      sender,
    ),
});
