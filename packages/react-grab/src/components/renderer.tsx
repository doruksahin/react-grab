import {
  Show,
  Index,
  createSignal,
  createEffect,
  createRenderEffect,
  onCleanup,
  on,
  createMemo,
} from "solid-js";
import type { Component } from "solid-js";
import type { AgentSession, ReactGrabRendererProps } from "../types.js";
import {
  DEFAULT_ACTION_ID,
  FADE_DURATION_MS,
  FROZEN_GLOW_COLOR,
  FROZEN_GLOW_EDGE_PX,
} from "../constants.js";
import { openFile } from "../utils/open-file.js";
import { isElementConnected } from "../utils/is-element-connected.js";
import { OverlayCanvas } from "./overlay-canvas.js";
import { AgentLabel } from "./selection-label/presets/agent-label.js";
import { PrimaryLabel } from "./selection-label/presets/primary-label.js";
import { PersistedLabel } from "./selection-label/presets/persisted-label.js";
import { Toolbar } from "./toolbar/index.js";
import { ContextMenu } from "./context-menu.js";
import { ToolbarMenu } from "./toolbar/toolbar-menu.js";
import { CommentsDropdown } from "./comments-dropdown.js";
import { ClearCommentsPrompt } from "./clear-comments-prompt.js";
import { Sidebar } from "./sidebar/index.js";
import { JiraCreateDialog } from "./sidebar/jira-create-dialog.js";
import { DevModeProvider } from "../features/dev-mode/index.js";
import { GuideBar } from "./reproduce-steps/guide-bar.js";
import { LabelPin } from "./selection-label/label-pin.js";
import { useLabelPins } from "../features/selection-label/hooks/use-label-pins.js";
import { useSidebarSession } from "../features/sidebar/hooks/use-sidebar-session.js";
import { LABEL_EXIT_ANIMATION_MS } from "../constants.js";
import { useSyncContext } from "../features/sync/sync-context.js";
import { Key } from "@solid-primitives/keyed";

export const ReactGrabRenderer: Component<ReactGrabRendererProps> = (props) => {
  const sidebar = useSidebarSession();
  const sync = useSyncContext();
  const refreshStatusFor = (groupId: string | undefined) =>
    groupId && sync.jira()
      ? () => {
          void sync.refreshJiraStatus(groupId);
        }
      : undefined;
  const sidebarOpen = sidebar.isOpen;

  const labelPins = useLabelPins({
    instances: () => props.labelInstances ?? [],
    enabled: () => Boolean(props.labelPinsEnabled),
    startClosed: () => Boolean(props.labelPinsStartClosed),
    previewedItemId: () => props.previewedItemId,
  });
  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<
    string | null
  >(null);
  let dashboardBtnRef: HTMLButtonElement | undefined;

  // Performance instrumentation: bracket sidebar render time.
  // createRenderEffect fires before DOM mutations (marks the start of the render).
  // createEffect fires after DOM mutations (marks when sidebar is in the DOM).
  createRenderEffect(
    on(
      () => sidebarOpen(),
      (isOpen) => {
        if (isOpen) performance.mark("sidebar-open-start");
      },
      { defer: true },
    ),
  );
  createEffect(
    on(
      () => sidebarOpen(),
      (isOpen) => {
        if (isOpen) performance.mark("sidebar-open-end");
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    if (!sidebarOpen()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Defer so Kobalte's DismissableLayer handlers (registered on document
      // after the sidebar opens) can run first and call e.preventDefault() if
      // they handle the Escape (e.g. closing a dropdown sub-menu). We only
      // close the sidebar if no nested layer consumed the event.
      queueMicrotask(() => {
        if (!e.defaultPrevented) {
          sidebar.close();
          setActiveDetailGroupId(null);
        }
      });
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  const getSessionStatus = (
    session: AgentSession,
  ): "copying" | "copied" | "fading" => {
    if (session.isFading) {
      return "fading";
    }

    if (session.isStreaming) {
      return "copying";
    }

    return "copied";
  };

  // A saved label offers removal only when the membership policy allows it
  // (ADR-0008): a selection with a ticket has no remove action.
  const removeActionFor = (itemId: string | undefined) =>
    itemId && props.onRemoveItem && props.canRemoveItem?.(itemId)
      ? () => props.onRemoveItem?.(itemId)
      : undefined;

  return (
    <DevModeProvider isDevMode={Boolean(props.isDevMode)}>
      <OverlayCanvas
        selectionVisible={props.selectionVisible}
        selectionBounds={props.selectionBounds}
        selectionBoundsMultiple={props.selectionBoundsMultiple}
        selectionShouldSnap={props.selectionShouldSnap}
        selectionIsFading={props.selectionLabelStatus === "fading"}
        inspectVisible={props.inspectVisible}
        inspectBounds={props.inspectBounds}
        dragVisible={props.dragVisible}
        dragBounds={props.dragBounds}
        grabbedBoxes={props.grabbedBoxes}
        agentSessions={props.agentSessions}
        labelInstances={props.labelInstances}
        activeGroupId={activeDetailGroupId()}
      />

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          "pointer-events": "none",
          "z-index": "var(--z-overlay)",
          opacity: props.isFrozen ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
          "will-change": "opacity",
          contain: "strict",
          transform: "translateZ(0)",
          "box-shadow": `inset 0 0 ${FROZEN_GLOW_EDGE_PX}px ${FROZEN_GLOW_COLOR}`,
        }}
      />

      <Index
        each={
          props.agentSessions ? Array.from(props.agentSessions.values()) : []
        }
      >
        {(session) => (
          <Show when={session().selectionBounds.length > 0}>
            <AgentLabel
              tagName={session().tagName}
              componentName={session().componentName}
              selectionBounds={session().selectionBounds[0]}
              mouseX={session().position.x}
              status={getSessionStatus(session())}
              statusText={session().lastStatus || "Thinking…"}
              inputValue={session().context.prompt}
              previousPrompt={session().context.prompt}
              supportsUndo={props.supportsUndo}
              supportsFollowUp={props.supportsFollowUp}
              dismissButtonText={props.dismissButtonText}
              onAbort={() => props.onRequestAbortSession?.(session().id)}
              onDismiss={
                session().isStreaming
                  ? undefined
                  : () => props.onDismissSession?.(session().id)
              }
              onUndo={
                session().isStreaming
                  ? undefined
                  : () => props.onUndoSession?.(session().id)
              }
              onFollowUpSubmit={
                session().isStreaming
                  ? undefined
                  : (prompt) =>
                      props.onFollowUpSubmitSession?.(session().id, prompt)
              }
              error={session().error}
              onAcknowledgeError={() =>
                props.onAcknowledgeSessionError?.(session().id)
              }
              onRetry={() => props.onRetrySession?.(session().id)}
              isPendingAbort={
                session().isStreaming &&
                props.pendingAbortSessionId === session().id
              }
              onConfirmAbort={() => props.onAbortSession?.(session().id, true)}
              onCancelAbort={() => props.onAbortSession?.(session().id, false)}
            />
          </Show>
        )}
      </Index>

      <Show when={props.selectionLabelVisible && props.selectionBounds}>
        <PrimaryLabel
          tagName={props.selectionTagName}
          componentName={props.selectionComponentName}
          elementsCount={props.selectionElementsCount}
          selectionBounds={props.selectionBounds}
          mouseX={props.mouseX}
          visible={props.selectionLabelVisible}
          isPromptMode={props.isPromptMode}
          inputValue={props.inputValue}
          replyToPrompt={props.replyToPrompt}
          hasAgent={props.hasAgent}
          status={props.selectionLabelStatus}
          actionCycleState={props.selectionActionCycleState}
          arrowNavigationState={props.selectionArrowNavigationState}
          onArrowNavigationSelect={props.onArrowNavigationSelect}
          inspectNavigationState={props.inspectNavigationState}
          onInspectSelect={props.onInspectSelect}
          filePath={props.selectionFilePath}
          onInputChange={props.onInputChange}
          onSubmit={props.onInputSubmit}
          onToggleExpand={props.onToggleExpand}
          isPendingDismiss={props.isPendingDismiss}
          selectionLabelShakeCount={props.selectionLabelShakeCount}
          onConfirmDismiss={props.onConfirmDismiss}
          onCancelDismiss={props.onCancelDismiss}
          onOpen={() => {
            if (props.selectionFilePath) {
              openFile(props.selectionFilePath, props.selectionLineNumber);
            }
          }}
          isContextMenuOpen={props.contextMenuPosition !== null}
          groups={props.groups ?? []}
          activeGroupId={props.activeGroupId}
          onActiveGroupChange={props.onActiveGroupChange}
          onAddGroup={props.onAddGroup}
        />
      </Show>

      {/* Pins first and cards after: on the same layer the later element
          is on top, so an open card covers the pins of nearby elements. */}
      {/* Keyed by label id, not position: a label keeps its DOM node (and does
          not replay its entry animation) when another label comes or goes. */}
      <Key each={labelPins.pinned()} by="id">
        {(instance) => {
          const [element, setElement] = createSignal<HTMLButtonElement>();
          createEffect(() => {
            const pinElement = element();
            if (!pinElement) return;
            onCleanup(labelPins.registerPin(instance().id, pinElement));
          });
          return (
            <LabelPin
              ref={setElement}
              selectionBounds={instance().selectionBounds}
              onToggle={() =>
                labelPins.setOpen(instance().id, !labelPins.isOpen(instance()))
              }
              inputValue={instance().inputValue}
              ticketKey={instance().jiraTicketId}
              statusColor={labelPins.statusColor(instance())}
              expanded={labelPins.isOpen(instance())}
              stackOffsetPx={labelPins.stackOffset(instance().id)}
            />
          );
        }}
      </Key>

      <Key each={props.labelInstances ?? []} by="id">
        {(instance) => {
          // A pin's card plays its closing animation before it goes.
          const [isLabelExiting, setIsLabelExiting] = createSignal(false);
          const shown = createMemo(() => labelPins.isCardShown(instance()));
          const [isMounted, setIsMounted] = createSignal(shown());
          createEffect(
            on(
              shown,
              (isShown) => {
                if (isShown) {
                  setIsLabelExiting(false);
                  setIsMounted(true);
                  return;
                }
                setIsLabelExiting(true);
                const timeoutId = setTimeout(() => {
                  setIsMounted(false);
                  setIsLabelExiting(false);
                }, LABEL_EXIT_ANIMATION_MS);
                onCleanup(() => clearTimeout(timeoutId));
              },
              { defer: true },
            ),
          );

          return (
            <Show when={isMounted()}>
              <PersistedLabel
                anchorElement={
                  labelPins.isPinned(instance())
                    ? labelPins.pinElement(instance().id)
                    : undefined
                }
                tagName={instance().tagName}
                componentName={instance().componentName}
                elementsCount={instance().elementsCount}
                selectionBounds={instance().selectionBounds}
                mouseX={instance().mouseX}
                status={instance().status}
                statusText={instance().statusText}
                hasAgent={Boolean(instance().statusText)}
                isPromptMode={instance().isPromptMode}
                inputValue={instance().inputValue}
                error={instance().error}
                hideArrow={instance().hideArrow}
                groupStatus={instance().groupStatus}
                jiraTicketId={instance().jiraTicketId}
                jiraUrl={instance().jiraUrl}
                jiraAssignee={instance().jiraAssignee}
                jiraReporter={instance().jiraReporter}
                jiraAssigneeAvatar={instance().jiraAssigneeAvatar}
                jiraReporterAvatar={instance().jiraReporterAvatar}
                jiraLabels={instance().jiraLabels}
                jiraComments={instance().jiraComments}
                jiraFlagged={instance().jiraFlagged}
                jiraFlaggedAt={instance().jiraFlaggedAt}
                jiraFlaggedBy={instance().jiraFlaggedBy}
                jiraFlaggedByAvatar={instance().jiraFlaggedByAvatar}
                jiraPriority={instance().jiraPriority}
                jiraIssueType={instance().jiraIssueType}
                jiraDueDate={instance().jiraDueDate}
                itemId={instance().itemId}
                commentText={instance().commentText}
                timestamp={instance().timestamp}
                hasElementScreenshot={instance().hasElementScreenshot}
                hasFullPageScreenshot={instance().hasFullPageScreenshot}
                groups={props.groups ?? []}
                activeGroupId={instance().groupId}
                onActiveGroupChange={(groupId) => {
                  const itemId = instance().itemId;
                  if (!itemId) return;
                  props.onMoveItem?.(itemId, groupId ?? null);
                }}
                onAddGroup={props.onAddGroup}
                onShowContextMenu={
                  (instance().status === "copied" ||
                    instance().status === "fading") &&
                  isElementConnected(instance().element)
                    ? () => props.onShowContextMenuInstance?.(instance().id)
                    : undefined
                }
                onHoverChange={(isHovered) =>
                  props.onLabelInstanceHoverChange?.(instance().id, isHovered)
                }
                onRemoveItem={removeActionFor(instance().itemId)}
                onCreateTicket={
                  instance().itemId && props.onCreateTicketForLooseItem
                    ? () => {
                        const itemId = instance().itemId;
                        if (!itemId) return;
                        const item = (props.commentItems ?? []).find(
                          (ci) => ci.id === itemId,
                        );
                        if (item) props.onCreateTicketForLooseItem?.(item);
                      }
                    : undefined
                }
                onOpenThread={
                  instance().itemId && instance().jiraTicketId
                    ? () => {
                        const itemId = instance().itemId;
                        if (!itemId) return;
                        sidebar.openOnItem(
                          itemId,
                          labelPins.pinElement(instance().id) ?? null,
                        );
                      }
                    : undefined
                }
                onRefreshJiraStatus={refreshStatusFor(instance().groupId)}
                isCollapsing={isLabelExiting()}
              />
            </Show>
          );
        }}
      </Key>

      <Show when={props.toolbarVisible !== false}>
        <Toolbar
          isActive={props.isActive}
          isContextMenuOpen={props.contextMenuPosition !== null}
          onToggle={props.onToggleActive}
          enabled={props.enabled}
          onToggleEnabled={props.onToggleEnabled}
          isDevMode={props.isDevMode}
          onToggleDevMode={props.onToggleDevMode}
          shakeCount={props.shakeCount}
          onStateChange={props.onToolbarStateChange}
          onSubscribeToStateChanges={props.onSubscribeToToolbarStateChanges}
          onSelectHoverChange={props.onToolbarSelectHoverChange}
          onContainerRef={props.onToolbarRef}
          commentItemCount={props.commentItemCount}
          clockFlashTrigger={props.clockFlashTrigger}
          onToggleComments={props.onToggleComments}
          onCopyAll={props.onCopyAll}
          onCopyAllHover={props.onCopyAllHover}
          onCommentsButtonHover={props.onCommentsButtonHover}
          isCommentsDropdownOpen={Boolean(props.commentsDropdownPosition)}
          isCommentsPinned={props.isCommentsPinned}
          onToggleToolbarMenu={props.onToggleToolbarMenu}
          isToolbarMenuOpen={Boolean(props.toolbarMenuPosition)}
          isClearPromptOpen={Boolean(props.clearPromptPosition)}
          selectionsRevealed={props.selectionsRevealed}
          onToggleSelectionsRevealed={props.onToggleSelectionsRevealed}
          syncStatus={props.syncStatus}
          syncWorkspace={props.syncWorkspace}
          sidebarOpen={sidebarOpen()}
          onToggleSidebar={() => sidebar.toggle(dashboardBtnRef ?? null)}
          onDashboardBtnRef={(el) => {
            dashboardBtnRef = el;
          }}
        />
      </Show>

      <ContextMenu
        position={props.contextMenuPosition ?? null}
        selectionBounds={props.contextMenuBounds ?? null}
        tagName={props.contextMenuTagName}
        componentName={props.contextMenuComponentName}
        hasFilePath={props.contextMenuHasFilePath ?? false}
        actions={props.actions}
        actionContext={props.actionContext}
        onDismiss={props.onContextMenuDismiss ?? (() => {})}
        onHide={props.onContextMenuHide ?? (() => {})}
      />

      <ToolbarMenu
        position={props.toolbarMenuPosition ?? null}
        actions={props.toolbarMenuActions ?? []}
        defaultActionId={props.defaultActionId ?? DEFAULT_ACTION_ID}
        onSetDefaultAction={props.onSetDefaultAction ?? (() => {})}
        onDismiss={props.onToolbarMenuDismiss ?? (() => {})}
      />

      <GuideBar />

      <ClearCommentsPrompt
        position={props.clearPromptPosition ?? null}
        keptCount={props.commentsClearCounts?.kept ?? 0}
        onConfirm={props.onClearCommentsConfirm ?? (() => {})}
        onCancel={props.onClearCommentsCancel ?? (() => {})}
      />

      <CommentsDropdown
        position={props.commentsDropdownPosition ?? null}
        items={props.commentItems ?? []}
        disconnectedItemIds={props.commentsDisconnectedItemIds}
        groups={props.groups ?? []}
        onSelectItem={props.onCommentItemSelect}
        onItemHover={props.onCommentItemHover}
        onCopyAll={props.onCommentsCopyAll}
        onCopyAllHover={props.onCommentsCopyAllHover}
        onClearAll={props.onCommentsClear}
        onRemoveItem={props.onRemoveItem}
        canRemoveItem={props.canRemoveItem}
        clearCounts={props.commentsClearCounts}
        onDismiss={props.onCommentsDismiss}
        onDropdownHover={props.onCommentsDropdownHover}
        onToggleItemRevealed={props.onToggleCommentItemRevealed}
        onAddGroup={props.onAddGroup}
        onRenameGroup={props.onRenameGroup}
        onDeleteGroup={props.onDeleteGroup}
        onToggleGroupRevealed={props.onToggleGroupRevealed}
        onCopyGroup={props.onCopyGroup}
        copyableCount={props.copyableCount}
        onMoveItem={props.onMoveItem}
      />

      {/* Single JIRA create-ticket dialog mount. Driven by the core's
          per-item orchestrator state, opened by the SelectionLabel
          "+ Create ticket" button, so the dialog works whether the sidebar
          is open or not. */}
      <Show when={props.looseTicketDialog}>
        {(state) => (
          <JiraCreateDialog
            groupId={state().group.id}
            group={state().group}
            commentItems={state().items}
            jiraProjectKey={props.jiraProjectKey ?? ""}
            jiraSiteHost={props.jiraSiteHost}
            onTicketCreated={(groupId, ticketId, ticketUrl) => {
              // The dialog stays open to confirm the ticket; it closes via
              // its own Done button, which calls onClose.
              props.onTicketCreated?.(groupId, ticketId, ticketUrl);
            }}
            onClose={() => props.onLooseTicketDialogClose?.()}
          />
        )}
      </Show>

      <Show when={sidebarOpen()}>
        <Sidebar
          focusRequest={sidebar.focusRequest()}
          groups={props.groups ?? []}
          commentItems={props.commentItems ?? []}
          syncStatus={props.syncStatus ?? "local"}
          onRetrySync={props.onRetrySync}
          jiraSiteHost={props.jiraSiteHost}
          jiraProjectKey={props.jiraProjectKey}
          onActiveDetailGroupChange={setActiveDetailGroupId}
          onJiraResolved={props.onJiraResolved}
          onTicketCreated={props.onTicketCreated}
          onFilterVisibilityChange={props.onFilterVisibilityChange}
          onCreateTicketForLooseItem={props.onCreateTicketForLooseItem}
          onRemoveItem={props.onRemoveItem}
          canRemoveItem={props.canRemoveItem}
          onMoveItem={props.onMoveItem}
          onMoveItems={props.onMoveItems}
          onAddGroup={props.onAddGroup}
          onRenameGroup={props.onRenameGroup}
          onDeleteGroup={props.onDeleteGroup}
          onToggleGroupRevealed={props.onToggleGroupRevealed}
          onCopyGroup={props.onCopyGroup}
          looseTicketDialog={props.looseTicketDialog}
          onLooseTicketDialogClose={props.onLooseTicketDialogClose}
          commentEditorToolbarVisible={props.commentEditorToolbarVisible}
          onClose={() => {
            sidebar.close();
            setActiveDetailGroupId(null);
          }}
        />
      </Show>
    </DevModeProvider>
  );
};
