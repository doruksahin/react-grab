export interface StepBuffer<Entry> {
  add: (entry: Entry) => void;
  entries: () => ReadonlyArray<Entry>;
}

/** Keeps the most recent entries, dropping the oldest past the capacity. */
export const createStepBuffer = <Entry>(
  capacity: number,
): StepBuffer<Entry> => {
  const kept: Entry[] = [];
  return {
    add: (entry) => {
      kept.push(entry);
      if (kept.length > capacity) kept.shift();
    },
    entries: () => [...kept],
  };
};
