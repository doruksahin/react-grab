import { getApiBaseUrl } from "../../generated/custom-fetch.js";

export type CommentSegment =
  | { kind: "text"; text: string }
  | { kind: "image"; alt: string; url: string }
  | { kind: "mention"; name: string };

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const MENTION_RE = /@(\p{Lu}\p{L}+(?:\s\p{Lu}\p{L}+)+)/gu;

export function parseCommentBody(body: string): CommentSegment[] {
  const base = getApiBaseUrl();

  const rawSegments: CommentSegment[] = [];
  let last = 0;
  for (const m of body.matchAll(IMG_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) rawSegments.push({ kind: "text", text: body.slice(last, idx) });
    const url = m[2]!.startsWith("/") ? `${base}${m[2]}` : m[2]!;
    rawSegments.push({ kind: "image", alt: m[1]!, url });
    last = idx + m[0]!.length;
  }
  if (last < body.length) rawSegments.push({ kind: "text", text: body.slice(last) });

  const segments: CommentSegment[] = [];
  for (const seg of rawSegments) {
    if (seg.kind !== "text") {
      segments.push(seg);
      continue;
    }
    let textLast = 0;
    for (const m of seg.text.matchAll(MENTION_RE)) {
      const idx = m.index ?? 0;
      if (idx > textLast) segments.push({ kind: "text", text: seg.text.slice(textLast, idx) });
      segments.push({ kind: "mention", name: m[1]! });
      textLast = idx + m[0]!.length;
    }
    if (textLast < seg.text.length) segments.push({ kind: "text", text: seg.text.slice(textLast) });
  }

  return segments;
}
