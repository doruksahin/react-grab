import { generateSnippet as generateUpstreamSnippet } from "react-grab-upstream/core";
import { PREVIEW_TEXT_MAX_LENGTH } from "../constants.js";
import { truncateString } from "./truncate-string.js";

interface GenerateSnippetOptions {
  maxLines?: number;
}

export const generateSnippet = async (
  elements: Element[],
  options: GenerateSnippetOptions = {},
): Promise<string[]> => {
  const snippets = await generateUpstreamSnippet(elements, options);
  return snippets.map((snippet, index) => {
    const element = elements[index];
    const text = truncateString(
      (element instanceof HTMLElement
        ? element.innerText
        : element.textContent
      )?.trim() ?? "",
      PREVIEW_TEXT_MAX_LENGTH,
    );
    return text && !snippet.includes(text)
      ? `${snippet}\n  text: ${JSON.stringify(text)}`
      : snippet;
  });
};
