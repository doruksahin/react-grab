---
date: '2026-11-16'
references:
- ADR-0004
status: accepted
---

# ADR-0029 Build the Jira ticket description as ADF on the sync server

## Context and Problem Statement

A new Jira ticket gets its description from `defaultDescription` in the overlay. It writes markdown: a heading per selection, the comment, the page, the recording link, the selector, the steps to reproduce, and the raw context for coding agents. The user can edit this markdown in the create dialog. The sync server converts it to ADF with `marklassian` (ADR-0004).

The result is hard to read in Jira:

- The recording link is one bullet among Page and Selector, far from the steps it explains. Readers miss it.
- The comment, the location, the steps and the raw context all look the same: plain bullets and paragraphs.
- The raw context block has no label. It repeats the comment and the selector, so it looks like a mistake.

Jira renders much more than markdown can express. ADF has panels (`info`, `note`, `warning`, `success`, `error`), collapsible `expand` blocks, `status` lozenges, `inlineCard` smart links, tables, and code blocks with a language ([ADF structure](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/), [panel](https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/panel/), [expand](https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/expand/), [status](https://developer.atlassian.com/cloud/jira/platform/apis/document/nodes/status/)). Markdown has no syntax for any of them, so a markdown-to-ADF converter can never produce them.

## Decision Drivers

- The description must use the ADF nodes that make a ticket easy to scan.
- One source of truth for the selection data. The sync server already has every field in D1 (`comment_text`, `page_url`, `page_title`, `recording_url`, `steps`, `element_selectors`, `content`), and `createTicketFromGroup` already loads the group's comments.
- The overlay is injected into other sites. Its bundle must not grow.
- The sync server is a Cloudflare Worker. Libraries must run there.
- People must still be able to add their own text to the description.

## Considered Options

1. **Keep markdown, improve the template.** Reorder sections, label the raw context, put the recording link under the steps. `marklassian` stays the only path.
2. **The overlay builds ADF and sends it.** The create dialog builds the document and posts it; the server validates and forwards it.
3. **The sync server builds ADF from D1.** The overlay sends only the user's own note as markdown. The server builds the structured part from the group's comments with Atlassian's ADF builders, converts the note with `marklassian`, and joins them.
4. **Hand-written ADF JSON on the server.** Like option 3, but without a builder library.

## Decision Outcome

Chosen option: **3, the sync server builds ADF from D1**, because it is the only option that both uses ADF fully and keeps the selection data in one place. Option 1 cannot express panels, expands or smart links. Option 2 adds an ADF builder to the injected overlay bundle and makes the client send data the server already has. Option 4 rebuilds what Atlassian's builders already do, without their types.

### The document

Per selection, in this order:

| Part | ADF node | Content |
|---|---|---|
| Title | `heading` | Component name, then the tag as `code` |
| Comment | `panel` (`note`) | The comment text |
| Steps to reproduce | `heading` | Shown when the selection has steps or a recording |
| Recording | `panel` (`info`) | `inlineCard` to `/r/{shareId}`, with one line on what it shows |
| Steps | `orderedList` | One item per step. A CSS selector target is `code`; a named target keeps its quotes |
| Where | `table` | Page (`inlineCard`), File, Selector (`code`) |
| Context for coding agents | `expand`, collapsed | `codeBlock` with language `html` holding the stored `content` unchanged |

With more than one selection, a `rule` separates them and each title gets its number. A group that is not synthetic gets its name above the selections, as today. The user's note, when not empty, comes first.

`status` lozenges are not used for the selection status. The description is a snapshot taken when the ticket is created, and every selection becomes `ticketed` at that moment, so a lozenge would be wrong soon after.

Screenshots stay attachments. An ADF `media` node needs an id from the Atlassian media service, which the attachment REST endpoint does not return reliably.

### How it is built

- `createTicketFromGroup` builds the document with `@atlaskit/adf-utils/builders` (Atlassian, Apache-2.0). Builders are a documented entry point of that package ([adf-utils](https://atlaskit.atlassian.com/packages/editor/adf-utils)).
- Before the issue is created, the document passes `@atlaskit/adf-utils/validator`. An invalid document is a server bug and fails with a typed `JiraError`.
- The user's note still goes through `marklassian`. ADR-0004 stays in force for the note and for comments.
- The create dialog's description field becomes an optional note. The generated part is not editable text anymore.

### To confirm in the SPEC

- The bundle size of `@atlaskit/adf-utils/builders` and `/validator` in the Worker, and that they run in workerd. The package depends on `@atlaskit/adf-schema` and `@atlaskit/editor-prosemirror`; the builders must not pull ProseMirror into the Worker. If they do, the SPEC uses the builders only and drops the validator, or chooses option 4 with types from `@atlaskit/adf-schema`.
- Where `describeStep` lives. The overlay uses it for the sidebar and the step guide; the server needs the same sentences. It must have one home that both packages import.
- Where the component chain (`iG › iK`) comes from. Today only `componentName` is a column; the rest is inside `content`.

### Changes found during implementation (SPEC-021)

- **Links, not `inlineCard`.** Jira shows an `inlineCard` it cannot resolve as the bare URL. The recording host (`workers.dev`) and local pages have no smart-link resolver, so the recording and the page are text with a `link` mark: "Watch the recording" and the page title.
- **Labels in plain cells.** The builder's `tableRow` takes header cells or data cells, not both. The Where table uses data cells with a `strong` label.
- **Validator size.** Measured with `wrangler deploy --dry-run`: the Worker grows by 125 KiB (19 KiB gzip) and contains no ProseMirror. The validator runs at runtime.

### Consequences

- Good: the recording sits with the steps it explains, the comment stands out, and the raw context no longer gets in the way of human readers.
- Good: the server builds the description from the same rows it already loads. The client sends less.
- Good: no change to the overlay bundle.
- Bad: people cannot edit the generated part before the ticket is created. They can add a note, and edit the description in Jira after.
- Bad: a new server dependency on an Atlaskit package.
- Neutral: smart links are not used, because Jira cannot resolve these hosts (see above). The `info` panel makes the recording link stand out.
- This amends ADR-0004 for the ticket description only. It also changes the description field that PRD-002 describes.
