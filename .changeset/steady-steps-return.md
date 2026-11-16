---
"react-grab": minor
---

Get back to a selection that is not on the page

- A selection whose element is not on the page says why: another page of this site (with **Open page**), another site, or no longer on this page.
- A new `steps` option (`options: { steps: { enabled: true } }` in `initSync`) saves the clicks and field changes that led to each new comment as Chrome DevTools Recorder steps. Typed values are never saved. The sync server must run migration `0007` first.
- Selection cards list the steps and download them as a Recorder flow. The default Jira description lists them under "Steps to reproduce".
- **Guide me** highlights each recorded step's element on the live page and moves on when you click it. It never acts on the page by itself.

See `docs/features/getting-back-to-a-selection.md`.
