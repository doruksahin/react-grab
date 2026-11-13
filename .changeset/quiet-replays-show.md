---
"react-grab": minor
---

Record how a comment came about

A new `recording` option (`{ enabled: true }`, opt-in) records the page in the background with rrweb and keeps the last few minutes. Saving a comment uploads that window to the sync server; the comment card and the Jira description get a "Watch how we got here" link that plays without a login. Inputs are masked and React Grab's own overlay is not recorded.

Adds `@rrweb/record` (about 23 KB gzipped). Needs a sync server with the recordings routes — update the server and the client together.
