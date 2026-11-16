import { saveAs } from "file-saver";
import type { UserFlow } from "./business/to-user-flow.js";

const JSON_INDENT_SPACES = 2;

/**
 * Saves a flow as a JSON file, the form the DevTools Recorder imports
 * (ADR-0025, phase 3), with FileSaver.js.
 */
export const downloadUserFlow = (flow: UserFlow, fileName: string): void =>
  saveAs(
    new Blob([JSON.stringify(flow, null, JSON_INDENT_SPACES)], {
      type: "application/json",
    }),
    fileName,
  );
