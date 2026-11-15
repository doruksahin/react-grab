---
"react-grab": patch
---

`react-grab/sync-http` encodes every path parameter (Orval `urlEncodeParameters`) and refuses a path with a `.` or `..` segment, so an id cannot reach another route or workspace. It also exports `STORAGE_ARGUMENTS` and `JIRA_ARGUMENTS`, one argument schema per port method, built from the server's OpenAPI schemas.
