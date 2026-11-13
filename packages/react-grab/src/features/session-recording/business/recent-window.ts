export interface RecentWindow<Event> {
  add: (event: Event, isCheckout: boolean) => void;
  take: () => Event[];
}

/**
 * Keeps the events since the previous checkout, following rrweb's documented
 * "last N minutes" recipe: rrweb takes a full snapshot at every checkout, so
 * the previous chunk plus the current one always starts with a full snapshot
 * and replays on its own. The window is one to two checkout periods long.
 */
export const createRecentWindow = <Event>(): RecentWindow<Event> => {
  let previous: Event[] = [];
  let current: Event[] = [];
  return {
    add: (event, isCheckout) => {
      if (isCheckout) {
        previous = current;
        current = [];
      }
      current.push(event);
    },
    take: () => [...previous, ...current],
  };
};
