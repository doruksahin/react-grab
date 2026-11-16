import { describe, expect, it, vi } from "vitest";
import { resolveSyncPorts } from "./resolve-sync-ports.js";
import type { SyncConfig, SyncPortFactories } from "../types.js";
import {
  createFakeJiraPort,
  createFakeStorage,
} from "../../../test-support/fake-ports.js";

const storage = createFakeStorage();
const jira = createFakeJiraPort();
const builtStorage = createFakeStorage();
const builtJira = createFakeJiraPort();

const makeFactories = () => ({
  createStorage: vi.fn<SyncPortFactories["createStorage"]>(() => builtStorage),
  createJira: vi.fn<SyncPortFactories["createJira"]>(() => builtJira),
});

const config = (overrides: Partial<SyncConfig> = {}): SyncConfig => ({
  enabled: true,
  workspace: "team",
  syncRevealedState: true,
  onSyncError: () => {},
  ...overrides,
});

describe("resolveSyncPorts", () => {
  it("uses both injected ports and builds nothing", () => {
    const factories = makeFactories();
    expect(resolveSyncPorts(config({ storage, jira }), factories)).toEqual({
      storage,
      jira,
    });
    expect(factories.createStorage).not.toHaveBeenCalled();
    expect(factories.createJira).not.toHaveBeenCalled();
  });

  it("builds both ports from the server fields when none are injected", () => {
    const factories = makeFactories();
    const resolved = resolveSyncPorts(
      config({ serverUrl: "https://sync.example.com", apiToken: "token" }),
      factories,
    );
    const expected = {
      serverUrl: "https://sync.example.com",
      apiToken: "token",
      workspace: "team",
    };
    expect(resolved).toEqual({ storage: builtStorage, jira: builtJira });
    expect(factories.createStorage).toHaveBeenCalledWith(expected);
    expect(factories.createJira).toHaveBeenCalledWith(expected);
  });

  it("passes the deprecated project key to the built ports only when given (ADR-0027)", () => {
    const factories = makeFactories();
    resolveSyncPorts(
      config({
        serverUrl: "https://sync.example.com",
        apiToken: "token",
        jiraProjectKey: "OLD",
      }),
      factories,
    );
    expect(factories.createJira).toHaveBeenCalledWith({
      serverUrl: "https://sync.example.com",
      apiToken: "token",
      workspace: "team",
      jiraProjectKey: "OLD",
    });
  });

  it("builds only the port that is missing", () => {
    const factories = makeFactories();
    const resolved = resolveSyncPorts(
      config({ storage, serverUrl: "https://sync.example.com", apiToken: "t" }),
      factories,
    );
    expect(resolved).toEqual({ storage, jira: builtJira });
    expect(factories.createStorage).not.toHaveBeenCalled();
  });

  it("requires a token and a server URL only when it has to build a port", () => {
    const factories = makeFactories();
    expect(() =>
      resolveSyncPorts(config({ serverUrl: "https://x" }), factories),
    ).toThrow(/apiToken is required/);
    expect(() =>
      resolveSyncPorts(config({ apiToken: "token" }), factories),
    ).toThrow(/serverUrl is required/);
  });

  it("has no storage when sync is off, but keeps an injected Jira port", () => {
    const factories = makeFactories();
    expect(resolveSyncPorts(config({ enabled: false }), factories)).toEqual({
      storage: null,
      jira: null,
    });
    expect(
      resolveSyncPorts(config({ enabled: false, jira }), factories),
    ).toEqual({ storage: null, jira });
  });
});
