// packages/react-grab/src/core/plugins/recorder/format-text.ts
import type { CapturedStep } from "./types.js";
import type { ResolveComponentInfo } from "./component-info.js";

const describe = (step: CapturedStep): string => {
  if (step.kind.type === "click") return `Click ${step.selector}`;
  return `Type ${JSON.stringify(step.kind.value)} into ${step.selector}`;
};

export const toHumanText = async (
  steps: CapturedStep[],
  resolve: ResolveComponentInfo,
): Promise<string> => {
  if (steps.length === 0) return "(no recorded steps)";
  const lines = await Promise.all(
    steps.map(async (step, index) => {
      const { component, file } = await resolve(step.element);
      const annotation = component && file ? ` in ${component} at ${file}` : "";
      return `${index + 1}. ${describe(step)}${annotation}`;
    }),
  );
  return lines.join("\n");
};
