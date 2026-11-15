export const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));
