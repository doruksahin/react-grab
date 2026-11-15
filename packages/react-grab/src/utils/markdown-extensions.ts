import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

/**
 * The Tiptap extensions every markdown surface shares: the starter kit and
 * markdown in and out. Editors add their own on top (mentions, images).
 */
export const markdownBaseExtensions = [
  StarterKit,
  Markdown.configure({ html: false, transformPastedText: true }),
];
