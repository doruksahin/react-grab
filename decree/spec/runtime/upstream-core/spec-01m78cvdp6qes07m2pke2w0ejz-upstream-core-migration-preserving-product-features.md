---
id: SPEC-01M78CVDP6QES07M2PKE2W0EJZ
status: draft
date: 2026-11-12
governs:
  - packages/react-grab/src/components/
  - packages/react-grab/src/features/sidebar/
  - packages/react-grab/src/core/
  - packages/react-grab/src/primitives.ts
  - packages/react-grab/src/utils/
  - packages/react-grab/package.json
  - packages/react-grab/tsup.config.ts
  - packages/react-grab/e2e/
  - pnpm-lock.yaml
---

# Upstream core migration preserving product features

## Overview

Upgrade to the latest published react-grab (registry verified as 0.2.0 on 2026-11-12), preserve the fork's product UI and features, remove duplicated upstream implementation, then merge the verified current branch into local main. Do not publish a package or send Jira messages as part of verification. Preserve pre-existing user changes.

Existing feature contracts remain authoritative: SPEC-001 through SPEC-019 in the legacy numbered files in decree/spec. The installed Decree version does not discover those legacy documents; a zero-document lint result is not evidence of their completeness.

## Technical Design

Use an exact npm alias, react-grab-upstream, to distinguish the upstream runtime from this workspace's react-grab package. Bundle it in browser and library distributions. Use its public core/plugin interface as the interaction engine, retaining the existing Solid UI, selection groups, storage/sync, Jira, screenshots, persisted labels and reveal behavior. Avoid importing upstream private paths into application modules.

Preserve local public interfaces, including dev mode, toolbar visibility state, transformSnippet and custom options. Adapt differing bounds and source shapes at the integration point. Do not introduce a generic service container, event bus, or additional persistence layer.

The isolated external-store freeze candidate is evidence, not an upstream release. If needed, deliver a bounded package-manager patch with reproducible regression tests; do not introduce a second React freeze engine. Both ESM and CJS consumers must be considered.

## Testing Strategy

- [x] Latest registry version and integrity pinned in manifest and lockfile.
- [ ] Core owns activation, selection, drag, navigation and freeze; duplicate implementations removed.
- [ ] Own editor → group → save → reload → reveal works for single and multiple elements; missing/remounted targets are handled.
- [ ] Copy success/failure, cancel, empty input and dispose preserve correct records and editor state.
- [ ] Groups, synthetic groups, moves, delete, filters, sidebar, dev mode and collapsible labels remain functional.
- [ ] Screenshot capture and mocked Jira create/status/comments/flag workflows remain functional without contacting live Jira.
- [ ] Public plugins/options and consumer entry points preserve their contracts.
- [ ] External-store stable/inline getters freeze and resume without a new notification; errors, cleanup and React dev/prod regressions checked.
- [ ] Required build, tests, lint, typecheck and formatting run; failures resolved or explicitly established as unrelated before merge.
- [ ] Review actual custom-code reduction, not merely relocated code.
- [ ] Merge current branch into local main and verify commit ancestry and clean task-owned changes.

Keep the goal active until all requirements are proven. Do not claim full migration from a dependency-only or primitive-only milestone.

## Initial implementation checkpoint (historical)

The initial integration pins `react-grab-upstream` to `npm:react-grab@0.2.0` and bundles it through tsup. Snippet generation, formatted element context, and the public structured context helper now delegate to upstream public exports. The interaction controller and its internal freeze implementation have NOT yet been replaced; public primitives now delegate freeze/unfreeze to the patched upstream implementation. This is not completion of the migration.

The upgraded snippet includes selectors and SVG viewBox metadata; the nested React fixture identifies its source owner (`DeeplyNested`) rather than requiring the old wrapper name (`NestedCard`). The element-context tests assert these new semantics. Existing `transformSnippet` remains in the local copy pipeline.

Baseline verification discovered 47 TypeScript diagnostics by compiling HEAD versions of the changed source modules through a virtual compiler host, without resetting working files. Small fixes cover missing NodeNext extensions, missing existing fixture method declarations, Jira group metadata types, typed empty sets, unsupported Combobox inputValue (verified against installed Kobalte types and official documentation), and persisted toolbar devMode. These must be included in the final validation.

Remaining implementation: replace the local interaction controller with public upstream core/plugin integration while keeping renderer/product orchestration, carry the tested freeze fix as a bounded package patch if still needed (both module formats), remove dead local engine code, execute the complete product/compatibility checks, commit only task-owned files, merge into local main, and audit final ancestry. Pre-existing Serena and untracked user documents must remain outside task commits.

Validation at this checkpoint: root build and typecheck pass; 36 targeted Chromium tests (context, callbacks, SSR) pass with retries disabled; all 110 unit tests pass. Full E2E suite has not run. Lint still reports 41 errors, and scoped format check reports 13 files; these gates are not marked complete. No commit or merge has been made. The E2E Vite server was started on 5175 for these checks.

## Freeze integration checkpoint (historical)

The package-manager patch now carries the isolated v2 external-store correction in upstream ESM and CJS freeze chunks. Application public freeze/unfreeze/isFreezeActive delegate to upstream; their local cleanup/state implementation was removed. Existing API documentation is retained. The main controller still uses its old private freeze implementation until the interaction engine is replaced; do not mark the full freeze or engine acceptance complete yet.

Permanent browser contracts use a real React 19.1.2 host with stable/inline getters, two roots, StrictMode on/off, retained state setters, store-only updates, unmount, errors and recovery. The upstream ESM core bundled into ESM/CJS output and our built public primitives passed 160 cases. The final test was strengthened to require our actual dist/primitives.cjs for CJS consumers; all 40 affected cases passed again. Root build/typecheck and 110 unit tests passed. No complete feature-suite verification or merge yet.

Published upstream core CJS cannot initialize in a browser: its execute-context-menu-action CJS chunk embeds Solid server code and throws getNextContextId under non-hydrating context. This is independent of the freeze patch. The integration uses the ESM upstream entry bundled into our output; it does not claim that upstream's direct CJS core entry works in browsers. Tests explicitly distinguish these paths. Our own built CJS primitive entry passes.

Test evidence logs: /tmp/react-grab-freeze-contract-final.log (160), /tmp/react-grab-own-cjs-freeze.log (40 direct CJS), /tmp/react-grab-build-current.log, /tmp/react-grab-typecheck-current.log, /tmp/react-grab-unit-current.log. An earlier raw-source primitive fixture failed because process.env.VERSION was not defined; the corrected test consumes the built package, matching consumers and the required build-before-test workflow.

## Interaction engine implementation checkpoint

The controller now initializes the upstream public ESM core and bridges its hooks into the product store. Old global activation/keyboard/pointer/drag/context-menu listeners were removed, along with 13 dead handler declarations and the old local freeze effects. Native state/hover/drag/prompt/context-menu signals drive the existing product renderer. The old controller had 4818 lines; the current diff removes roughly 800 net controller lines (exact count pending final cleanup). Several legacy helpers and alternative copy paths remain and must be removed or redirected before completion.

Editor submit now calls engine.copyElement with a typed pending submission containing elements, text, position and the selected group ID. Copy success creates the existing product record, preserving its group snapshot; failure restores input state. The group orchestrator accepts an optional explicit selected group ID. Cancellation/disposal and overlapping submissions still need complete regression coverage. The legacy public copyElement wrapper and some performCopyWithLabel paths still use the old clipboard helper and must be reviewed.

Two integration failures were reproduced and fixed:
- Both renderers reused data-react-grab's shadow host. The product UI now has data-react-grab-product on its host/root, with data-react-grab-ignore-events on its host. E2E UI queries were migrated to that product root.
- Upstream starts its deferred renderer import before a synchronous external-UI plugin disables theme.enabled. Its async mount callback only checked disposal, so native context-menu keyboard handlers still mounted and interfered with our editor. The pnpm patch now additionally rechecks theme.enabled at that callback in both compiled ESM/CJS core chunks. This is a single condition, not a custom keyboard dispatcher. The speculative on:input/on:keydown change was reverted after the guard fixed the real editor Enter regression. Permanent freeze tests now initialize with theme disabled and check absence of the native toolbar.

Real right-click → Edit → type → Enter → save → reopen saved comment passed after this guard. Build and typecheck passed; 110 unit tests passed. The broader first run was 219/234 (all 160 freeze cases included), with 15 failures; after selecting visible text instead of blank padding it became 60/74 product/context checks, with 14 failures. These are incomplete gates, not acceptable losses. Logs: /tmp/react-grab-engine-regression.log and /tmp/react-grab-engine-product-regression.log.

Upstream targets visible text differently from the old fork: main-title at x=10 returns h1, while the padded box center x=592 returns header. E2E hover/click/right-click helpers now choose a direct text node's Range bounds when available. No legacy application hit-testing was restored. The plain-DOM fixture was obscured by the fixed bottom-left test element, so it was moved to an unobscured fixed position; the callback test uses a distinct button instead of a parent ul that can resolve to the same target as its child. Assertions still require the selected content and distinct hover callbacks.

Next required work: inspect sequential edit/save/reselect failures (second context-menu does not open), multi-record hover previews and copy-all label lifecycle; verify public copy/plugin/action/agent APIs; preserve hold/navigation feedback and outside-dismiss semantics through upstream hooks; remove dead old interaction helpers and duplicated copy paths; complete actual group/reload/reveal/Jira/screenshot/toolbar/keyboard/touch checks. The source is an in-progress integration and must NOT be merged yet. Root lint/format and full suite remain outstanding. User-owned pre-existing files remain untouched and uncommitted.

Final checkpoint verification: all 31 context/callback tests passed after those fixture corrections (/tmp/react-grab-engine-smoke-final.log); final typecheck passed. The previous history run still has 12 failing cases and has not been rerun after this checkpoint. Do not extrapolate the 31 passing cases to the history suite or full application. A candidate next probe is whether transient copied/fading product labels intercept the second selection near the last list item; verify through elementFromPoint/composedPath before changing lifecycle behavior.

## Current regression checkpoint — 2026-11-12

The previous interaction checkpoint above is historical. The normal copy path now delegates to upstream core: copyElement, editor submit and context-menu copy all use engine.copyElement. Five old copy helpers and src/core/copy.ts were removed. Standard copyContent delegates upstream; grouped clipboard MIME remains product-specific. Pending submissions are invalidated on deactivate/dispose and stale submit completions cannot reactivate the editor. Outside-click handling remains an editor-only bridge.

The first complete browser run executed 806 cases: 741 passed and 65 failed, including all 160 upstream-freeze contracts and all 14 touch cases passing. This is not a merge gate success. Log: /tmp/react-grab-full-migration-e2e.log.

Concrete fixes following that run:
- Upstream keyboard navigation changes its frozen element but both public state surfaces returned the old hover target. The package patch now returns its existing effectiveElement from onStateChange and getState in ESM/CJS core chunks. This avoids rebuilding keyboard navigation locally. The prior ArrowUp label stayed span; after the patch the parent is shown and all navigation tests pass.
- Upstream compact snippets omit descendant text, unlike this fork's prior getHTMLPreview. generateSnippet retains upstream generation and adds only missing visible text, bounded by the existing PREVIEW_TEXT_MAX_LENGTH. Drag copies again include the selected list's text without restoring the old serializer.
- Product focusin isolation now recognizes data-react-grab-ignore-events instead of the old shared data-react-grab root. Modal focus traps no longer steal editor typing, submit or Escape.
- Removed the legacy viewport hit-test override that replaced a keyboard-frozen target on scroll. Upstream owns detection; our viewport bridge only refreshes product bounds. Restored product drag-preview scheduling from pointer events and removed the incorrect bottom-right pointer reconstruction for reverse drags.
- Forwarded upstream onOpenFile and transformOpenFileUrl to the existing product plugin registry. Keyboard open-file callbacks now work.
- Copy-all tests now reveal selections before copying, matching the existing product rule. Newly added selections inherit the global revealed state, so the second cycle asserts Hide all selections instead of toggling it off. The legacy toolbar-disable test actually clicked Toggle DEV mode; HEAD already makes setEnabled a no-op. Its test now verifies DEV mode preserves the pending confirmation.
- Freeze tests still assert no visible update while frozen, then require each buffered update exactly once after release (including two cycles and a visibility toggle). They previously asserted discarded updates despite naming the behavior buffering/replay.

Final focused run: 99/99 passed across focus-trap, freeze-updates, clear-history-prompt, drag-selection, keyboard-navigation, open-file and viewport. Log: /tmp/react-grab-round-final-tests.log. Final root build and typecheck passed (/tmp/react-grab-round-final-build.log, /tmp/react-grab-round-final-types.log). Changed files in this round were formatted and git diff --check passed. Lint remains failing with 39 errors (/tmp/react-grab-round-final-lint.log); this is not waived.

Current core/index.tsx diff against HEAD is 603 additions / 1684 deletions (net 1081 lines removed). That excludes the deleted 91-line copy module and reductions elsewhere; it is not yet the final repository-wide reduction audit.

Outstanding: classify and fix remaining full-suite failures in sidebar/Jira/labels/lightbox, toolbar menu, position stability and geometry; compare with HEAD behavior before deciding whether each is an integration regression or stale test. Toolbar still owns the old freeze-updates implementation and its release ordering must be replaced safely before deleting it. Audit hierarchy/inspect/action-cycle UI and custom plugin shortcut integration, whose old helpers still exist. Complete code cleanup, full checks and final consumer/feature verification, then commit only task-owned files and merge local main. No commit, merge or push has occurred. Pre-existing user files remain untouched.

### Sidebar / labels / toolbar regression checkpoint — 2026-11-12

Registry verification still reports react-grab@0.2.0 (receipt: /tmp/react-grab-latest-goal.json).

Observed behavior and focused changes:
- Kobalte's modal filter menu in the product ShadowRoot set aria-hidden=true on document.body, hiding the submenu from accessible queries. The filter now uses the existing modal=false option. The status and due-date filter interactions pass without replacing Kobalte or adding custom dismissal handlers.
- Creating a transient copy label cleared saved selection labels. createLabelInstance now removes only labels without itemId; the test requires both seeded saved labels and their toggle dots to survive a normal copy. The April 17 b1577e931 renderer change intentionally retains the dot as the expand/collapse anchor; tests now exercise that current UI rather than the older chevron design.
- Toolbar layout recalculation updated only its local ratio. A later DEV state notification reapplied the stale persisted ratio, shifting the entire toolbar by about 9 px in horizontal and vertical layouts. Recalculation now saves the new ratio through existing saveAndNotify. Increasing waits did not fix the failure; the state correction did.
- Sidebar storage seeds require explicit init before opening the sidebar. Group cards expand inline; their Open detail view control opens detail. Shared open-group-detail.ts replaces duplicated incorrect helpers. Jira avatars are exercised using the existing mocked status route and actual polling.
- Toolbar context-menu tests use a real right click instead of a non-composed synthetic event. Lightbox tests click Dashboard thumbnails, not the noninteractive copies in revealed labels; only the source-replacement test intentionally triggers a thumbnail behind the modal.
- Status tests seed real groups and valid selectors through the existing populate seam, then assert the compound UI's status text, color class and ticket link. The old SelectionStatusBadge is no longer used by the current persisted preset. Geometry tests target the selected inner span; browser-normalized CSS is asserted as rgb.

Verification on final build:
- Root build: passed, /tmp/react-grab-sidebar-final-build.log.
- Root typecheck: passed, /tmp/react-grab-sidebar-final-types.log.
- Full Playwright run: 806/806 passed, 4 workers, retries=0, including touch and upstream-freeze tests; /tmp/react-grab-full-regression-second.log. This supersedes the earlier 741/806 result.
- Unit tests: 110/110 passed across 16 files; /tmp/react-grab-sidebar-unit.log.
- Earlier focused run: 145/145 passed; /tmp/react-grab-sidebar-label-final.log.
- publint exits successfully but reports existing unmatched src/* and dist/*.mjs export warnings plus a browser-field suggestion; /tmp/react-grab-sidebar-publint.log. These are not silently treated as warning-free.
- Root lint still fails with 39 errors; /tmp/react-grab-sidebar-lint.log. No lint waiver.
- Changed files formatted; git diff --check passed. Temporary toolbar instrumentation removed.

Completion is NOT established by the green suite. Source inspection confirms that public upstream state/API does not expose a hierarchy selection setter; own openArrowNavigationMenu and handleActionCycleKey currently have no callers. Preserve these features via an evidence-backed integration rather than deleting them to satisfy lint. Old toolbar freeze-updates remains and still needs safe replacement/removal.

Additional coverage gap found in the green suite: mocked/verify-spec-013.spec.ts contains exploratory early returns and logging without enforcing expected writes. The full-run output says addJiraComment called:false, no insert button, and hint:false while those tests pass. This is not evidence that Jira editor submit/shortcut/insert/reply features work. Tighten those checks at real UI and mocked request boundaries and diagnose any actual failures before merge. No live Jira writes are authorized.

No commit, merge or push has occurred. Keep pre-existing user files untouched. Next work: close the Jira verification gap and hierarchy/action-cycle/custom shortcut gaps, consolidate freeze ownership, remove unused/type-unsafe code, rerun affected/full gates, then commit task-owned changes and merge local main only after the completion audit.

### Jira contract, dead code, and headless keyboard checkpoint — 2026-11-12

The prior green full suite was insufficient: several Jira tests logged missing POSTs and returned early. Those exploratory checks in mocked/verify-spec-013.spec.ts were replaced with eight hard current-UI contracts: Save, empty Save, reply/Cancel, reply parentId, formatting serialization, mention account mapping, image data-URL serialization, and failed POST cleanup. Tests use the real selection-label contenteditable and real Save clicks, then assert mocked HTTP payloads and rendered results. Current HEAD does not implement the historical Cmd+Enter/M/Insert-menu behavior described in the old exploratory notes; that older description is retained as historical context, not asserted as a preserved feature. No live Jira requests were sent. Eight checks passed in /tmp/react-grab-jira-contract-final.log and again in the subsequent 231-test run.

Removed unused custom Dialog and SelectionStatusBadge implementations after reference searches. Removed dead toolbar measurement/animation branches, an unused drag callback, unused renderer/sidebar/test helpers, and unnecessary any casts. Sync fixtures now use existing CommentItem, SelectionGroupWithJira, initSync and populateSync types. These changes reduced the earlier 39 lint errors to two before the action-cycle fix. No user-owned documents or .serena/project.yml were included in formatting.

Action-cycle behavior was disconnected from keyboard events during migration. The preserved handleActionCycleKey now runs through a capture listener and stops the same key from reaching the native engine. No second action registry or scheduler was introduced. New e2e/action-cycle.spec.ts asserts C/C selects the second action, invokes it once with the selected element, Escape cancels, unregister cancels, dispose cancels, and typing in an editor input stays editable without dispatching an action. The editor input carries the existing data-react-grab-ignore-events marker; a host input is intentionally blocked while selection is frozen. Initial red run: /tmp/react-grab-cycle-red.log. All five final action tests pass.

A separate real regression surfaced when old keyboard-copy tests ran against an empty clipboard. The native engine opens its keyboard-selection discard prompt on mouse movement; with theme.enabled=false the prompt is invisible, and a subsequent click deactivates without copying. Runtime probes /tmp/react-grab-cycle-copy-probe.cjs and /tmp/react-grab-cycle-click-probe.cjs distinguish Enter (opens our prompt editor) from the failing click (deactivates, no onBeforeCopy). This is not a clipboard delay. A minimal ESM/CJS upstream patch now preserves a keyboard-selected element through pointer movement when native theme is disabled. The normal native-UI path remains unchanged. It adds the equivalent of `if (!theme.enabled && keyboardSelection.selectedElement()) return` before consuming the mouse handoff. It does not introduce a separate product selection controller. The two navigation tests now clear the clipboard before the action and require the actual selected element's text, preventing false greens from old clipboard contents.

Verification:
- Latest npm registry still reports 0.2.0: /tmp/react-grab-latest-current.json (web tool could not open the registry endpoint; direct HTTPS fetch succeeded).
- Root build after patch: passed, /tmp/react-grab-headless-build.log.
- Affected Playwright suite: 231/231 passed, four workers, no retries, /tmp/react-grab-headless-regression.log. Includes action cycle, activation, navigation, Jira, due-date filter, reveal, toolbar position and all 160 upstream freeze contracts.
- Unit tests: 110/110 passed, /tmp/react-grab-headless-unit.log.
- Typecheck: passed, /tmp/react-grab-headless-types.log.
- Task-owned files formatted; final build passed, /tmp/react-grab-headless-final-build.log. git diff --check passed.
- Lint now has one remaining error: openArrowNavigationMenu has no caller. /tmp/react-grab-headless-final-lint.log. This is an unresolved hierarchy UI integration, not a warning to suppress by deleting the feature.

Still incomplete: hierarchy dropdown selection must share native engine selection authority; Shift inspect behavior needs a real regression contract; toolbar hover still calls the old custom freeze implementation and needs ownership-safe consolidation. Then run all final gates, audit the complete diff/consumer packaging, commit only task-owned changes and merge local main. The 231-test result is not a new full-suite result and does not prove these remaining gaps. No commit, merge or push has occurred.

### Hierarchy / inspect / freeze consolidation — 2026-11-12

The remaining integration gaps are implemented and have targeted runtime evidence:

- The existing product hierarchy menu opens for native arrow navigation and reflects the native target. A narrowly scoped local upstream `selectElement(element): boolean` extension delegates to the existing native selectAndFocusElement after clearing native keyboard history. It rejects inactive, disposed, copying, dragging, prompt-mode, disconnected and foreign-document calls; the no-op API returns false. Both published ESM/CJS chunks and declaration variants are patched. This is explicitly a local extension, not an API shipped by unpatched 0.2.0. The product's old arrow-navigation.ts and its selection implementation were removed.
- Menu selection now drives native copy and subsequent arrow navigation. The regression suite verifies menu UL → engine copies UL, menu UL → ArrowUp reaches the parent, and ArrowDown does not return to stale pre-menu SPAN history (native vertical navigation can fall back to UL when no child is under the probe point). The latter was red as SPAN before native history was cleared. Shift inspect shows ancestors and closes on release without copying.
- Public upstream primitives already provide getElementsAtPoint and isElementGrabbable, including freeze-safe hit testing. Product hierarchy and drag previews now use them. A temporary DOM-ancestor-only menu implementation was replaced with the upstream hit-test primitive to preserve the original stack-at-point behavior.
- Product host carries the upstream-supported data-react-grab-ignore marker in addition to ignore-events. Without this marker, native right-click hit testing could select our Shadow DOM hierarchy UI as page content; the failing context-menu test copied TodoItem.div from the menu instead of Walk the dog. The marker and upstream grabbability primitive fix this without a custom overlay exclusion engine.
- Toolbar hover now uses public upstream freeze/unfreeze with explicit local ownership. It does not acquire or release a freeze owned by an already-active engine, retains its hover lease across activation, and releases on inactive exit/disposal. Eight real React-host tests (development/production × leave/activate/already-active/dispose) were red before this replacement and passed afterward, including external-store snapshot preservation, immediate resume, and subsequent updates.
- Removed obsolete custom freeze-updates, freeze-animations, freeze-gsap, freeze-pseudo-states, get-element-at-position, is-valid-grabbable-element and cache-wrapper modules. Product bounds invalidation remains; native interaction caches belong to native core. No new runtime dependency beyond the upstream package was introduced.

Verification improvements from the full run:
- A navigation test clicked a neighboring row now covered by the restored hierarchy menu. It now clicks the actual selection bounds and still requires the selected text in a freshly cleared clipboard.
- reinitialize() in E2E fixtures ignored the returned API and kept using a disposed instance. It now stores the fresh init result. Activation-key, lifecycle and collapsible-label tests exercise the real new instance.
- Toolbar visibility uses a condition wait instead of a fixed 600 ms sleep.
- Animation cleanup checks the real CSS Animation.playState via getAnimations(), not a removed implementation's style tag or the computed animation-play-state property (WAAPI pause does not change that computed CSS property).
- architecture.yml now owns the product host marker, removes the deleted status badge paths/scope, and refreshes its attribute inventory using the existing scanner. Architecture lint passes; no validator exception was added.

Evidence so far: initial full run 821/824, with the three failures above recorded in /tmp/react-grab-hierarchy-toolbar-full.log. Affected rerun 164/166, followed by correction of two inaccurate test expectations (CSS property versus Animation state; child-under-point versus native boundary fallback). Final focused navigation/animation run 43/43 passes in /tmp/react-grab-selection-final-focused.log. API guards are covered by upstream-selection-api.spec.ts. Latest build/type/lint/architecture checks are green; final full run is tracked separately below. Own ESM and CJS SSR imports and no-op API lifecycle passed. Runtime bundles contain no import/require of react-grab-upstream; patched engine code is bundled. Host React is 19.1.2. Cross-version React and arbitrary nested public freeze leases are not newly promised compatibility guarantees.

### Final implementation acceptance — 2026-11-12

This checkpoint supersedes the earlier incomplete implementation gates. The final full Playwright run passed 825/825 tests with four workers and retries=0, including touch, product editor/group persistence/reveal, mocked Jira writes, screenshots/lightbox, agent flows, keyboard/action/hierarchy/inspect, toolbar ownership and the 160 freeze contracts. Evidence: /tmp/react-grab-final-full.log (3.4 minutes).

| Requirement | Final evidence |
| --- | --- |
| Latest upstream engine | Exact alias react-grab-upstream → npm:react-grab@0.2.0; registry receipt /tmp/react-grab-latest-current.json; pnpm lock and patch hash pin the tested package. |
| Preserve product features | 825/825 full E2E; hard Jira HTTP/UI contracts replace old exploratory false-positive checks. |
| Reduce custom code | Product src diff against pre-migration 746a0faa: 1,493 added / 4,455 removed, net −2,962 source lines. This excludes new test fixtures, test code and the published-bundle patch. |
| Product and CLI unit coverage | 110/110 product tests (/tmp/react-grab-final-unit.log), 158/158 CLI tests (/tmp/react-grab-cli-final-tests.log). |
| Build and types | Root build /tmp/react-grab-final-build.log and typecheck /tmp/react-grab-final-types.log exit 0. |
| Lint and architecture | Zero lint errors/warnings (/tmp/react-grab-final-lint.log); 142/142 architecture paths valid, consumer cross-check and 123 attribute scopes pass (/tmp/react-grab-final-arch.log). |
| Formatting | All task-owned edited source/test/config files formatted; git diff --check passes. User-owned files excluded. |
| Consumer packaging | Own ESM/CJS SSR import and no-op lifecycle smoke checks pass. Browser consumers covered by freeze contracts. Runtime bundles do not import the upstream alias. Publint exits 0 with the two pre-existing unmatched wildcard export warnings and browser-field suggestion; not claimed warning-free. |
| User work preservation | Six pre-existing user files are excluded from the commit; content hashes recorded in /tmp/react-grab-protected-before-merge.json for post-merge comparison. |

The product distribution retains its existing 0.1.29 package version; 0.2.0 is the pinned upstream engine version. No npm publication or remote push is part of this task. The local patch remains necessary: external-store freeze/resume, disabled-renderer async mount guard, effective selected-target state, headless keyboard handoff, and a guarded native selection API for our hierarchy UI. These are not represented as fixes already published upstream. React-private freeze behavior is validated on React 19.1.2 dev/prod; universal React/SSR hydration/nested freeze compatibility is not claimed. Local branch-to-main delivery follows these passing gates, without changing the tested source tree.
