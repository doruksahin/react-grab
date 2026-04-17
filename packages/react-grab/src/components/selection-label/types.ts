import type { JSX } from "solid-js";
import type {
  OverlayBounds,
  SelectionLabelStatus,
  ActionCycleState,
  ArrowNavigationState,
} from "../../types.js";

/** Root shell — positioning + animation only */
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

/** Context input — textarea + submit button */
export interface SelectionLabelContextInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onDismiss?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Content wrapper — just children */
export interface SelectionLabelContentProps {
  children: JSX.Element;
}
