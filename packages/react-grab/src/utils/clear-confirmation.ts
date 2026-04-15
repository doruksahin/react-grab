import { logRecoverableError } from "./log-recoverable-error.js";

const CLEAR_CONFIRMED_KEY = "react-grab-clear-confirmed";

const readSessionFlag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

let didConfirmClear = readSessionFlag(CLEAR_CONFIRMED_KEY);

export const isClearConfirmed = (): boolean => didConfirmClear;

export const confirmClear = (): void => {
  didConfirmClear = true;
  try {
    localStorage.setItem(CLEAR_CONFIRMED_KEY, "1");
  } catch (error) {
    // HACK: localStorage can throw in private browsing or when quota is exceeded
    logRecoverableError("Failed to save clear preference to localStorage", error);
  }
};
