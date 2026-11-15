/** Whether two id lists are equal, in order. For `createMemo`'s `equals`. */
export const isSameIdList = (
  previous: readonly string[] | undefined,
  next: readonly string[],
): boolean =>
  previous !== undefined &&
  previous.length === next.length &&
  previous.every((id, index) => id === next[index]);
