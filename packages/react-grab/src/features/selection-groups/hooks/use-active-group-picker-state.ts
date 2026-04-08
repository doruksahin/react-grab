/**
 * Reactive view over the ticket-lock business rule for the
 * active-group picker.
 *
 * Owns no state. Given the groups list and the current selection's
 * groupId, it exposes two memos:
 *
 *   - `isLocked`: the picker should render a static, non-interactive
 *     trigger (the selection lives in a ticketed group).
 *   - `assignableGroups`: the filtered list the flyout should render.
 *     Already excludes ticketed and synthetic groups.
 *
 * Keeping the Solid primitives here (and *not* in business/ticket-lock)
 * preserves the pure-function testability of the business layer.
 */
import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import type { SelectionGroup } from "../types.js";
import {
  assignableGroupsFor,
  isSelectionLocked,
} from "../business/ticket-lock.js";

interface UseActiveGroupPickerStateDeps {
  groups: Accessor<SelectionGroup[]>;
  activeGroupId: Accessor<string | null | undefined>;
}

export interface ActiveGroupPickerState {
  isLocked: Accessor<boolean>;
  assignableGroups: Accessor<SelectionGroup[]>;
}

export const useActiveGroupPickerState = (
  deps: UseActiveGroupPickerStateDeps,
): ActiveGroupPickerState => {
  const currentItem = createMemo(() => ({
    groupId: deps.activeGroupId() ?? null,
  }));

  const isLocked = createMemo(() =>
    isSelectionLocked(currentItem(), deps.groups()),
  );

  const assignableGroups = createMemo(() =>
    assignableGroupsFor(currentItem(), deps.groups()),
  );

  return { isLocked, assignableGroups };
};
