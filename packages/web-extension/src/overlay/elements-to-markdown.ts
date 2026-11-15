import TurndownService from "turndown";

const turndownService = new TurndownService();

export const elementsToMarkdown = (elements: Element[]): string =>
  turndownService.turndown(
    elements.map((element) => element.outerHTML).join("\n\n"),
  );
