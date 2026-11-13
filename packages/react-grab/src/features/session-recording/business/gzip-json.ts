/** Serializes a value to JSON and gzips it with the browser's built-in CompressionStream. */
export const gzipJson = (value: unknown): Promise<Blob> =>
  new Response(
    new Response(JSON.stringify(value)).body?.pipeThrough(
      new CompressionStream("gzip"),
    ),
  ).blob();
