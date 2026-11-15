import type { JiraPort, StorageAdapter } from "react-grab/sync-http";

export type PortName = "storage" | "jira";

export type PortRequestName<
  Port extends PortName,
  Method extends string,
> = `${Port}.${Method}`;

// HACK: a mapped type is the only way to derive one message per port method, so this cannot be an interface
export type PortRequests<Port extends PortName, Methods> = {
  [Method in keyof Methods & string as PortRequestName<
    Port,
    Method
  >]: Methods[Method] extends (...args: infer Args) => Promise<infer Result>
    ? (args: Args) => Result
    : never;
};

export const STORAGE_METHODS: Record<keyof StorageAdapter, true> = {
  loadComments: true,
  upsertComment: true,
  deleteComment: true,
  loadGroups: true,
  upsertGroup: true,
  deleteGroup: true,
  uploadScreenshot: true,
  loadScreenshot: true,
  uploadRecording: true,
};

export const JIRA_METHODS: Record<keyof JiraPort, true> = {
  getSite: true,
  listIssueTypes: true,
  listPriorities: true,
  listLabels: true,
  getTicketStatus: true,
  createTicket: true,
  addComment: true,
  searchUsers: true,
};

export const isPortMethod = <Methods>(
  methods: Record<keyof Methods & string, true>,
  name: string,
): name is keyof Methods & string => Object.hasOwn(methods, name);

export const portMethodNames = <Methods>(
  methods: Record<keyof Methods & string, true>,
): Array<keyof Methods & string> =>
  Object.keys(methods).filter((name) => isPortMethod<Methods>(methods, name));

export const portRequestName = <Port extends PortName, Method extends string>(
  port: Port,
  method: Method,
): PortRequestName<Port, Method> => `${port}.${method}`;
