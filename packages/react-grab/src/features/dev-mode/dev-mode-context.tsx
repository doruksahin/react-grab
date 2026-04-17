import { createContext, useContext, type ParentComponent } from "solid-js";

const DevModeContext = createContext<() => boolean>(() => false);

export interface DevModeProviderProps {
  isDevMode: boolean;
}

export const DevModeProvider: ParentComponent<DevModeProviderProps> = (props) => {
  return (
    <DevModeContext.Provider value={() => props.isDevMode}>
      {props.children}
    </DevModeContext.Provider>
  );
};

/** Returns a reactive accessor for the current dev mode state. */
export const useDevMode = (): (() => boolean) => useContext(DevModeContext);
