---
"react-grab": minor
---

Sync requires an API token

`initSync()` takes a new `apiToken` option and now throws if sync is enabled without it. Every request to the sync server sends it as a bearer token, and screenshots are loaded with it too. Read it from the host app's development env (for example `VITE_REACT_GRAB_SYNC_TOKEN`); `initSync()` runs only in development builds, so the token never ships to production.

This needs a sync server that checks the token — update the server and the client together.
