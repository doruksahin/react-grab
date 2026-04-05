/**
 * Extracts a source file path and optional line number from a comment's
 * content field (the element's HTML snapshot). The capture format is:
 *   "/absolute/path/to/Component.tsx:42"
 * or just a file path with no line number.
 *
 * Returns null when no recognisable file path is found.
 * Callers must handle null by omitting the UI row entirely (A-014).
 * Do not add fallback guessing — null is safer than a wrong path.
 */
export function extractFilePath(
  content: string,
): { path: string; line: number | null } | null {
  const match = content.match(
    /(\/[^\s"'`]+\.(?:tsx?|jsx?|m[tj]s|vue|svelte|css))(?::(\d+))?/,
  );
  if (!match) return null;
  return {
    path: match[1],
    line: match[2] ? parseInt(match[2], 10) : null,
  };
}
