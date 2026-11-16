import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import { selectionTree } from "../../features/selection-groups/business/selection-tree.js";
import { SelectionTreeView } from "./selection-tree-view.jsx";

const group: SelectionGroup = {
  id: "g1",
  name: "Checkout",
  createdAt: 0,
  revealed: false,
};
const items: CommentItem[] = [
  {
    id: "a",
    groupId: "g1",
    content: "<button>Pay</button>",
    elementName: "button",
    tagName: "button",
    timestamp: 0,
  },
];

const sectionBody = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(
    "[data-react-grab-group-collapsible] > div + div",
  );

describe("SelectionTreeView", () => {
  it("keeps a section and its rows when the data changes", () => {
    let rowMounts = 0;
    const [groups, setGroups] = createSignal([group]);
    const { container } = render(() => (
      <SelectionTreeView
        tree={selectionTree(items, groups())}
        renderItem={(item) => {
          rowMounts += 1;
          return <div>{item.id}</div>;
        }}
      />
    ));
    container
      .querySelector<HTMLElement>("[data-react-grab-group-collapsible] > div")
      ?.click();
    expect(sectionBody(container)?.style.gridTemplateRows).toBe("0fr");

    setGroups([{ ...group, revealed: true }]);

    expect(sectionBody(container)?.style.gridTemplateRows).toBe("0fr");
    expect(rowMounts).toBe(1);
  });

  it("opens a collapsed section that holds the selection to reveal", () => {
    const [revealItemId, setRevealItemId] = createSignal<string | null>(null);
    const { container } = render(() => (
      <SelectionTreeView
        tree={selectionTree(items, [group])}
        renderItem={(item) => <div>{item.id}</div>}
        revealItemId={revealItemId()}
      />
    ));
    container
      .querySelector<HTMLElement>("[data-react-grab-group-collapsible] > div")
      ?.click();
    setRevealItemId("a");
    expect(sectionBody(container)?.style.gridTemplateRows).toBe("1fr");
  });
});
