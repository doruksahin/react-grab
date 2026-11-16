import { compareStatuses } from "./status-filter.js";

export interface StatusSection<Item> {
  status: string;
  items: Item[];
}

/** Selections grouped by their status, sections in workflow order. */
export const sectionsByStatus = <Item>(
  items: readonly Item[],
  statusOf: (item: Item) => string,
): StatusSection<Item>[] => {
  const sections = new Map<string, Item[]>();
  for (const item of items) {
    const status = statusOf(item);
    sections.set(status, [...(sections.get(status) ?? []), item]);
  }
  return [...sections.entries()]
    .sort(([left], [right]) => compareStatuses(left, right))
    .map(([status, sectionItems]) => ({ status, items: sectionItems }));
};
