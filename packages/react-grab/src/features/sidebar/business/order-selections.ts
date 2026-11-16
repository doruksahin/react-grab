/** How the sidebar orders selections within a section. */
export type SelectionOrder = "attention" | "newest";

export const SELECTION_ORDER_LABEL: Record<SelectionOrder, string> = {
  attention: "Attention first",
  newest: "Newest first",
};

/**
 * Newest first, and with "attention" the ones that need attention before
 * the rest. Returns a new array; equal items keep their order.
 */
export const orderSelections = <Item extends { timestamp: number }>(
  items: readonly Item[],
  order: SelectionOrder,
  needsAttention: (item: Item) => boolean,
): Item[] =>
  [...items].sort((left, right) => {
    if (order === "attention") {
      const byAttention =
        Number(needsAttention(right)) - Number(needsAttention(left));
      if (byAttention !== 0) return byAttention;
    }
    return right.timestamp - left.timestamp;
  });
