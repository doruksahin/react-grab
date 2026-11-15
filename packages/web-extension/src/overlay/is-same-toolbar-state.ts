import type { ToolbarState } from "react-grab";

export const isSameToolbarState = (
  left: ToolbarState,
  right: ToolbarState,
): boolean => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every(
    (key) => Reflect.get(left, key) === Reflect.get(right, key),
  );
};
