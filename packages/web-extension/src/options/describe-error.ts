import { ZodError } from "zod";

export const describeError = (error: unknown): string => {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(". ");
  }
  return error instanceof Error ? error.message : String(error);
};
