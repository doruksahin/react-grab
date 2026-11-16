import { JIRA_ARGUMENTS, STORAGE_ARGUMENTS } from "react-grab/sync-http";

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

export const STORAGE_METHODS = STORAGE_ARGUMENTS;

export const JIRA_METHODS = JIRA_ARGUMENTS;

export const isPortMethod = <Methods>(
  methods: Record<keyof Methods & string, unknown>,
  name: string,
): name is keyof Methods & string => Object.hasOwn(methods, name);

export const portMethodNames = <Methods>(
  methods: Record<keyof Methods & string, unknown>,
): Array<keyof Methods & string> =>
  Object.keys(methods).filter((name) => isPortMethod<Methods>(methods, name));

export const portRequestName = <Port extends PortName, Method extends string>(
  port: Port,
  method: Method,
): PortRequestName<Port, Method> => `${port}.${method}`;
