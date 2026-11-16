import { enabledItem } from "../storage/overlay-items.js";

export const toggleEnabled = async (): Promise<boolean> => {
  const enabled = !(await enabledItem.getValue());
  await enabledItem.setValue(enabled);
  return enabled;
};
