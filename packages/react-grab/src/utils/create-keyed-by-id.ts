import { type Accessor, createMemo } from "solid-js";
import { isSameIdList } from "./is-same-id-list.js";

export interface KeyedById<Entry> {
  /** The ids in order; changes only when an id is added, removed or moved. */
  ids: Accessor<string[]>;
  /** The current entry for an id. */
  byId: Accessor<ReadonlyMap<string, Entry>>;
}

/**
 * Splits a list whose entries are rebuilt as new objects into stable ids and
 * a lookup, so `<For each={ids()}>` keeps one scope (and DOM node) per id
 * while each row reads its current entry.
 */
export const createKeyedById = <Entry extends { id: string }>(
  list: Accessor<readonly Entry[]>,
): KeyedById<Entry> => ({
  ids: createMemo(() => list().map((entry) => entry.id), [], {
    equals: isSameIdList,
  }),
  byId: createMemo(() => new Map(list().map((entry) => [entry.id, entry]))),
});
