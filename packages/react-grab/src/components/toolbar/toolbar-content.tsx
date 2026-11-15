import type { Component, JSX } from "solid-js";
import { cn } from "../../utils/cn.js";
import { IconChevron } from "../icons/icon-chevron.jsx";
import { IconEyeOff } from "../icons/icon-eye-off.jsx";
import { IconEyeFilled } from "../icons/icon-eye-filled.jsx";
import { IconDashboard } from "../icons/icon-dashboard.jsx";
import {
  getExpandGridClass,
  getMinDimensionClass,
} from "../../utils/toolbar-layout.js";

import type { SyncStatus } from "../../features/sync/types.js";
import { SyncIndicator } from "../sync/sync-indicator.jsx";
import { Button } from "../ui/button.js";
import { ToolbarButton } from "./toolbar-button.js";

export interface ToolbarContentProps {
  isActive?: boolean;
  enabled?: boolean;
  isDevMode?: boolean;
  isCollapsed?: boolean;
  snapEdge?: "top" | "bottom" | "left" | "right";
  isShaking?: boolean;
  isCommentsExpanded?: boolean;
  isCopyAllExpanded?: boolean;
  isCommentsPinned?: boolean;
  disableGridTransitions?: boolean;
  onAnimationEnd?: () => void;
  onPanelClick?: (event: MouseEvent) => void;
  onCollapseClick?: (event: MouseEvent) => void;
  onExpandableButtonsRef?: (element: HTMLDivElement) => void;
  selectButton: JSX.Element;
  commentsButton: JSX.Element;
  copyAllButton: JSX.Element;
  toggleButton: JSX.Element;
  selectionsRevealed: boolean;
  onToggleSelectionsRevealed?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onDashboardBtnRef?: (el: HTMLButtonElement) => void;
  transformOrigin?: string;
  syncStatus: SyncStatus;
  syncWorkspace?: string;
}

export const ToolbarContent: Component<ToolbarContentProps> = (props) => {
  const edge = () => props.snapEdge ?? "bottom";
  const isVertical = () => edge() === "left" || edge() === "right";

  const expandGridClass = (
    isExpanded: boolean,
    collapsedExtra?: string,
  ): string => getExpandGridClass(isVertical(), isExpanded, collapsedExtra);

  const gridTransitionClass = (): string => {
    if (props.disableGridTransitions) return "";
    if (isVertical()) {
      return "transition-[grid-template-rows,opacity] duration-150 ease-out";
    }
    return "transition-[grid-template-columns,opacity] duration-150 ease-out";
  };

  const gridSizeTransitionClass = (): string => {
    if (props.disableGridTransitions) return "";
    if (isVertical()) {
      return "transition-[grid-template-rows] duration-150 ease-out";
    }
    return "transition-[grid-template-columns] duration-150 ease-out";
  };

  const minDimensionClass = () => getMinDimensionClass(isVertical());

  const collapsedEdgeClasses = () => {
    if (!props.isCollapsed) return "";
    const roundedClass = {
      top: "rounded-t-none rounded-b-[10px]",
      bottom: "rounded-b-none rounded-t-[10px]",
      left: "rounded-l-none rounded-r-[10px]",
      right: "rounded-r-none rounded-l-[10px]",
    }[edge()];
    const paddingClass = isVertical() ? "px-0.25 py-2" : "px-2 py-0.25";
    return `${roundedClass} ${paddingClass}`;
  };

  const chevronRotation = () => {
    const collapsed = props.isCollapsed;
    switch (edge()) {
      case "top":
        return collapsed ? "rotate-180" : "rotate-0";
      case "bottom":
        return collapsed ? "rotate-0" : "rotate-180";
      case "left":
        return collapsed ? "rotate-90" : "-rotate-90";
      case "right":
        return collapsed ? "-rotate-90" : "rotate-90";
      default:
        return "rotate-0";
    }
  };

  const visibilityButton = () => (
    <ToolbarButton
      vertical={isVertical()}
      data-react-grab-ignore-events
      data-react-grab-toolbar-visibility
      aria-label={
        props.selectionsRevealed
          ? "Hide all selections"
          : "Reveal all selections"
      }
      aria-pressed={props.selectionsRevealed}
      onClick={() => props.onToggleSelectionsRevealed?.()}
    >
      {props.selectionsRevealed ? (
        <IconEyeFilled
          size={14}
          class="text-popover-foreground transition-colors"
        />
      ) : (
        <IconEyeOff size={14} class="text-muted-foreground transition-colors" />
      )}
    </ToolbarButton>
  );

  const collapseButton = () => (
    <Button
      variant="toolbar"
      data-react-grab-ignore-events
      data-react-grab-toolbar-collapse
      aria-label={props.isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
      class="shrink-0"
      onClick={props.onCollapseClick}
    >
      <IconChevron
        size={14}
        class={cn(
          "text-muted-foreground transition-transform duration-150",
          chevronRotation(),
        )}
      />
    </Button>
  );

  return (
    <div
      class={cn(
        "flex items-center justify-center rounded-[10px] antialiased relative overflow-visible [font-synthesis:none] drop-shadow-overlay [corner-shape:superellipse(1.25)]",
        isVertical() && "flex-col",
        "bg-popover",
        !props.isCollapsed &&
          (isVertical() ? "px-1.5 gap-1.5 py-2" : "py-1.5 gap-1.5 px-2"),
        collapsedEdgeClasses(),
        props.isShaking && "animate-shake",
      )}
      style={{ "transform-origin": props.transformOrigin }}
      onAnimationEnd={props.onAnimationEnd}
      onClick={props.onPanelClick}
    >
      <div
        class={cn(
          "grid relative overflow-visible",
          gridSizeTransitionClass(),
          props.isCollapsed
            ? isVertical()
              ? "grid-rows-[0fr] pointer-events-none"
              : "grid-cols-[0fr] pointer-events-none"
            : isVertical()
              ? "grid-rows-[1fr]"
              : "grid-cols-[1fr]",
        )}
      >
        <div
          class={cn(
            "flex",
            isVertical()
              ? "flex-col items-center min-h-0"
              : "items-center min-w-0",
            props.isCollapsed ? "opacity-0" : "opacity-100",
            !props.disableGridTransitions &&
              "transition-opacity duration-150 ease-out",
          )}
        >
          <div
            ref={(element) => props.onExpandableButtonsRef?.(element)}
            class={cn("flex items-center", isVertical() && "flex-col")}
          >
            <div
              class={cn("grid", gridTransitionClass(), expandGridClass(true))}
            >
              <div class={cn("relative overflow-visible", minDimensionClass())}>
                {props.selectButton}
              </div>
            </div>
            <div
              class={cn(
                "grid",
                gridTransitionClass(),
                expandGridClass(
                  Boolean(props.isCommentsExpanded),
                  "pointer-events-none",
                ),
              )}
            >
              <div class={cn("relative overflow-visible", minDimensionClass())}>
                {props.commentsButton}
              </div>
            </div>
            <div
              class={cn(
                "grid",
                gridTransitionClass(),
                expandGridClass(
                  Boolean(props.isCopyAllExpanded),
                  "pointer-events-none",
                ),
              )}
            >
              <div class={cn("relative overflow-visible", minDimensionClass())}>
                {props.copyAllButton}
              </div>
            </div>
            <div
              class={cn("grid", gridTransitionClass(), expandGridClass(true))}
            >
              <div class={cn("relative overflow-visible", minDimensionClass())}>
                {visibilityButton()}
              </div>
            </div>
            <div
              class={cn("grid", gridTransitionClass(), expandGridClass(true))}
            >
              <div class={cn("relative overflow-visible", minDimensionClass())}>
                <ToolbarButton
                  vertical={isVertical()}
                  ref={props.onDashboardBtnRef}
                  data-react-grab-ignore-events
                  data-react-grab-toolbar-dashboard
                  aria-label={
                    props.sidebarOpen ? "Close dashboard" : "Open dashboard"
                  }
                  aria-pressed={Boolean(props.sidebarOpen)}
                  class={cn(props.sidebarOpen && "text-grab-pink")}
                  onClick={() => props.onToggleSidebar?.()}
                >
                  <IconDashboard
                    size={14}
                    class={cn(
                      "transition-colors",
                      props.sidebarOpen
                        ? "text-popover-foreground"
                        : "text-muted-foreground",
                    )}
                  />
                </ToolbarButton>
              </div>
            </div>
          </div>
          <div class="relative shrink-0 overflow-visible">
            {props.toggleButton}
          </div>
        </div>
      </div>
      {collapseButton()}
      <SyncIndicator
        status={props.syncStatus}
        workspace={props.syncWorkspace}
      />
    </div>
  );
};
