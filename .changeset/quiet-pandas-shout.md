---
"react-grab": minor
---

Jira create dialog: required fields, retry on failure, and a success state

Create stays disabled until the summary and work type are filled, and each missing field is marked. A failed submit now keeps every field and offers Retry instead of only printing an error. A successful submit confirms the ticket in the dialog — with the key, a link to it, and a Done button — rather than closing silently.
