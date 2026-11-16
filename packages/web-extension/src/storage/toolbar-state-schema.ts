import type { ToolbarState } from "react-grab";
import { z } from "zod";

export const toolbarStateSchema = z.strictObject({
  edge: z.enum(["top", "bottom", "left", "right"]),
  ratio: z.number(),
  collapsed: z.boolean(),
  enabled: z.boolean(),
  devMode: z.boolean(),
  defaultAction: z.string().optional(),
  selectionsRevealed: z.boolean(),
}) satisfies z.ZodType<ToolbarState>;
