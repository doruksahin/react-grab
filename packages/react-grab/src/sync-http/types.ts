/** Where the sync server is and the token it requires (ADR-0020). */
export interface SyncServerConnection {
  serverUrl: string;
  apiToken: string;
}

/** A connection bound to one workspace, which both HTTP ports need. */
export interface SyncHttpConfig extends SyncServerConnection {
  workspace: string;
}
