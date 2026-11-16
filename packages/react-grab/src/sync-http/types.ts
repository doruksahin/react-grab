import type { SyncServerConfig } from "../features/sync/types.js";

/** A connection bound to one workspace, which both HTTP ports need. */
export type SyncHttpConfig = SyncServerConfig;

/** Where the sync server is and the token it requires (ADR-0020). */
export type SyncServerConnection = Omit<SyncServerConfig, "workspace">;
