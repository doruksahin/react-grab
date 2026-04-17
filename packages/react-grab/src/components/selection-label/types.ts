import type { JSX } from "solid-js";
import type {
  OverlayBounds,
  SelectionLabelStatus,
  ArrowNavigationState,
} from "../../types.js";

/** Root shell — positioning, pointer-events, animation, context provider */
export interface SelectionLabelRootProps {
  selectionBounds?: OverlayBounds;
  mouseX?: number;
  visible?: boolean;
  status?: SelectionLabelStatus;
  isPromptMode?: boolean;
  hideArrow?: boolean;
  extraTopOffset?: number;
  onPlacementChange?: (placement: "above" | "below") => void;
  isCollapsing?: boolean;
  onCollapse?: () => void;
  selectionLabelShakeCount?: number;
  /** For the remove button — rendered by Root when present */
  onRemoveItem?: () => void;
  jiraTicketId?: string;
  jiraFlagged?: boolean;
  /** Tag / component identity — used for position reset on element change */
  tagName?: string;
  componentName?: string;
  /** Pointer-events: needed for shouldEnablePointerEvents */
  onDismiss?: () => void;
  onShowContextMenu?: () => void;
  onAbort?: () => void;
  onAcknowledgeError?: () => void;
  onRetry?: () => void;
  arrowNavigationState?: ArrowNavigationState;
  inspectNavigationState?: ArrowNavigationState;
  /** Global keydown: Enter to expand */
  onToggleExpand?: () => void;
  /** Hover tracking on the container */
  onHoverChange?: (isHovered: boolean) => void;
  /** Error state — affects panel visibility */
  error?: string;
  /** Pending abort — affects copying status check */
  isPendingAbort?: boolean;
  /** Has agent — affects completion view status text */
  hasAgent?: boolean;
  statusText?: string;
  /** Completion view props forwarded by Root */
  supportsUndo?: boolean;
  supportsFollowUp?: boolean;
  dismissButtonText?: string;
  previousPrompt?: string;
  onUndo?: () => void;
  onFollowUpSubmit?: (prompt: string) => void;
  children: JSX.Element;
}

/** Header row — tag badge + optional trailing slot */
export interface SelectionLabelHeaderProps {
  tagName?: string;
  componentName?: string;
  elementsCount?: number;
  filePath?: string;
  inputValue?: string;
  onOpen?: () => void;
  onCollapse?: () => void;
  isContextMenuOpen?: boolean;
  /** Whether to show arrow/inspect nav compact layout */
  compactPadding?: boolean;
  /** Right-side slot (e.g. ActiveGroupPicker) */
  trailing?: JSX.Element;
  /** Show flag indicator before tag */
  jiraFlagged?: boolean;
  jiraFlaggedAt?: string | null;
  jiraFlaggedBy?: string | null;
  jiraFlaggedByAvatar?: string | null;
}

/** Context input — textarea + submit/abort buttons */
export interface SelectionLabelContextInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onDismiss?: () => void;
  onAbort?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Content wrapper — just children */
export interface SelectionLabelContentProps {
  children: JSX.Element;
}
