// packages/react-grab/src/core/plugins/recorder/component-info.ts
import type { ReactGrabAPI, SourceInfo } from "../../../types.js";

export interface ComponentInfo {
  /** React component name; null if unresolvable */
  component: string | null;
  /** "filePath:lineNumber"; null if unresolvable. Column intentionally omitted (ADR-0010). */
  file: string | null;
}

export type ResolveComponentInfo = (element: Element) => Promise<ComponentInfo>;

export const createComponentInfoResolver = (
  api: Pick<ReactGrabAPI, "getSource">,
): ResolveComponentInfo => {
  return async (element: Element): Promise<ComponentInfo> => {
    try {
      const source: SourceInfo | null = await api.getSource(element);
      if (!source) return { component: null, file: null };
      const file =
        source.lineNumber !== null
          ? `${source.filePath}:${source.lineNumber}`
          : source.filePath;
      return {
        component: source.componentName ?? null,
        file: file ?? null,
      };
    } catch {
      return { component: null, file: null };
    }
  };
};
