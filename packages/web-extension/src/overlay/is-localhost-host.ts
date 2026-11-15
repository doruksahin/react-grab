export const isLocalhostHost = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.endsWith(".localhost");
