import { getApiBaseUrl } from "../../generated/custom-fetch.js";

export type CommentSegment =
  | { kind: "text"; text: string }
  | { kind: "image"; alt: string; url: string };

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function parseCommentBody(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  const base = getApiBaseUrl();
  for (const m of body.matchAll(IMG_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ kind: "text", text: body.slice(last, idx) });
    const url = m[2]!.startsWith("/") ? `${base}${m[2]}` : m[2]!;
    segments.push({ kind: "image", alt: m[1]!, url });
    last = idx + m[0]!.length;
  }
  if (last < body.length) segments.push({ kind: "text", text: body.slice(last) });
  return segments;
}
