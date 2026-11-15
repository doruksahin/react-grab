import { type Accessor, createMemo, createSignal } from "solid-js";
import type { SelectionLabelInstance } from "../../../types.js";
import {
  PIN_GAP_PX,
  PIN_HEIGHT_PX,
  PIN_MAX_WIDTH_PX,
} from "../../../constants.js";
import { getStatusChip } from "../../sidebar/get-status-chip.js";
import { isPinnedLabel } from "../business/is-pinned-label.js";
import { stackPins } from "../business/stack-pins.js";

interface UseLabelPinsArgs {
  instances: Accessor<SelectionLabelInstance[]>;
  /** Options.collapsibleLabels: saved labels show as pins. */
  enabled: Accessor<boolean>;
  /** Options.labelsStartCollapsed: a pin's card starts closed. */
  startClosed: Accessor<boolean>;
  /** A saved selection whose card is open from the comments menu. */
  previewedItemId: Accessor<string | null | undefined>;
}

export interface LabelPinsAPI {
  /** The labels shown as pins, in placement order. */
  pinned: Accessor<SelectionLabelInstance[]>;
  isPinned: (instance: SelectionLabelInstance) => boolean;
  /** Whether a label's card shows: always for plain labels, when open for pins. */
  isCardShown: (instance: SelectionLabelInstance) => boolean;
  isOpen: (instance: SelectionLabelInstance) => boolean;
  setOpen: (instanceId: string, open: boolean) => void;
  /** How far a pin moves down so it does not cover another pin. */
  stackOffset: (instanceId: string) => number;
  /** The pin's status dot colour (status-colors.ts, ADR-0006). */
  statusColor: (instance: SelectionLabelInstance) => string;
  /** The pin element of a label, for its card to anchor to. */
  pinElement: (instanceId: string) => HTMLElement | undefined;
  registerPin: (instanceId: string, element: HTMLElement) => () => void;
}

/**
 * State of the saved-label pins (ADR-0022 step 3): which labels are pins,
 * which cards are open, where the pins stack and which element each card
 * anchors to. One owner, so pins and cards can render in separate passes.
 */
export const useLabelPins = (args: UseLabelPinsArgs): LabelPinsAPI => {
  // Cards the user opened or closed; the rest follow `startClosed`.
  const [openOverrides, setOpenOverrides] = createSignal<
    ReadonlyMap<string, boolean>
  >(new Map());
  const [pinElements, setPinElements] = createSignal<
    ReadonlyMap<string, HTMLElement>
  >(new Map());

  const isPinned = (instance: SelectionLabelInstance) =>
    args.enabled() && isPinnedLabel(instance);

  const pinned = createMemo(() => args.instances().filter(isPinned));

  const offsets = createMemo(() =>
    stackPins(
      pinned().map((instance) => ({
        id: instance.id,
        rect: instance.selectionBounds,
      })),
      { width: PIN_MAX_WIDTH_PX, height: PIN_HEIGHT_PX, gap: PIN_GAP_PX },
    ),
  );

  const isPreviewed = (instance: SelectionLabelInstance) =>
    Boolean(instance.itemId) && instance.itemId === args.previewedItemId();

  const isOpen = (instance: SelectionLabelInstance) =>
    isPreviewed(instance) ||
    (openOverrides().get(instance.id) ?? !args.startClosed());

  return {
    pinned,
    isPinned,
    isCardShown: (instance) => !isPinned(instance) || isOpen(instance),
    isOpen,
    setOpen: (instanceId, open) =>
      setOpenOverrides((previous) => new Map(previous).set(instanceId, open)),
    stackOffset: (instanceId) => offsets().get(instanceId) ?? 0,
    statusColor: (instance) =>
      getStatusChip({
        jiraTicketId: instance.jiraTicketId,
        jiraStatus: instance.groupStatus,
        jiraFlagged: instance.jiraFlagged,
      }).color.hex,
    pinElement: (instanceId) => pinElements().get(instanceId),
    registerPin: (instanceId, element) => {
      setPinElements((previous) => new Map(previous).set(instanceId, element));
      return () =>
        setPinElements((previous) => {
          if (previous.get(instanceId) !== element) return previous;
          const next = new Map(previous);
          next.delete(instanceId);
          return next;
        });
    },
  };
};
