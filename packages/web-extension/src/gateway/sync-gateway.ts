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
import type { SiteSettings } from "../settings/types.js";
import { bindSiteJiraProject } from "./bind-site-jira-project.js";
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

interface AcceptedArguments {
  success: true;
  data: ReadonlyArray<unknown>;
}

interface RejectedArguments {
  success: false;
  error: { message: string };
}

interface ArgumentSchema {
  safeParse: (value: unknown) => AcceptedArguments | RejectedArguments;
}

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

interface SenderConnection {
  config: SyncHttpConfig;
  site: SiteSettings;
}

const resolveConnection = async (
  sender: Browser.runtime.MessageSender,
): Promise<SenderConnection> => {
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
    config: {
      serverUrl: settings.serverUrl,
      apiToken: settings.apiToken,
      workspace: site.workspace,
    },
    site,
  };
};

interface PortCall<Port, Method extends keyof Port & string> {
  portName: PortName;
  schemas: Record<keyof Port & string, ArgumentSchema>;
  createPort: (config: SyncHttpConfig) => Port;
  bindToSite: (
    method: Method,
    args: ReadonlyArray<unknown>,
    site: SiteSettings,
  ) => ReadonlyArray<unknown>;
  method: Method;
  args: ReadonlyArray<unknown>;
  sender: Browser.runtime.MessageSender;
}

const validateArguments = <Port, Method extends keyof Port & string>(
  call: PortCall<Port, Method>,
): ReadonlyArray<unknown> => {
  if (!Object.hasOwn(call.schemas, call.method)) {
    throw new GatewayRefusalError(
      `${call.portName}.${call.method} is not allowed`,
    );
  }
  const parsed = call.schemas[call.method].safeParse(call.args);
  if (!parsed.success) {
    throw new GatewayRefusalError(
      `${call.portName}.${call.method} got invalid arguments: ${parsed.error.message}`,
    );
  }
  return parsed.data;
};

const callPortMethod = async <
  Port extends {
    [Method in keyof Port]: (...args: never[]) => Promise<unknown>;
  },
  Method extends keyof Port & string,
>(
  call: PortCall<Port, Method>,
): Promise<PortMethodResult<Port, Method>> => {
  const validArgs = validateArguments(call);
  const { config, site } = await resolveConnection(call.sender);
  const port = call.createPort(config);
  const result: PortMethodResult<Port, Method> = await Reflect.apply(
    port[call.method],
    port,
    call.bindToSite(call.method, validArgs, site),
  );
  return result;
};

const unchangedArguments = (
  _method: string,
  args: ReadonlyArray<unknown>,
): ReadonlyArray<unknown> => args;

export const createSyncGateway = (
  factories: SyncPortFactories = HTTP_PORT_FACTORIES,
): SyncGateway => ({
  callStorage: (method, args, sender) =>
    callPortMethod({
      portName: "storage",
      schemas: STORAGE_METHODS,
      createPort: factories.createStorage,
      bindToSite: unchangedArguments,
      method,
      args,
      sender,
    }),
  callJira: (method, args, sender) =>
    callPortMethod({
      portName: "jira",
      schemas: JIRA_METHODS,
      createPort: factories.createJira,
      bindToSite: bindSiteJiraProject,
      method,
      args,
      sender,
    }),
});
