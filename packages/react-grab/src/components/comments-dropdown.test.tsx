import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { For } from "solid-js";
import type { CommentItem } from "../types.js";
import type { SelectionGroup } from "../features/selection-groups/types.js";
import { GroupCollapsible } from "../features/selection-groups/components/group-collapsible.jsx";
import { UngroupedSection } from "../features/selection-groups/components/ungrouped-section.jsx";
import { isPresentedAsLoose } from "../features/selection-groups/business/membership.js";
import { groupComments } from "../features/selection-groups/business/group-operations.js";
import { filterUserFacingGroups } from "../features/selection-groups/business/synthetic-group.js";

/**
 * Thin wrapper around the grouped-list section of comments-dropdown.tsx.
 * Mounting the full dropdown would require the anchored-dropdown DOM
 * machinery, so we test the composition contract here directly:
 *   - data-react-grab-group-list is the container
 *   - UngroupedSection renders for items in synthetic groups (presented as loose)
 *   - GroupCollapsible renders one card per user-facing group
 */
const GroupListHarness = (props: {
  selections: CommentItem[];
  groups: SelectionGroup[];
}) => {
  const ungrouped = () =>
    props.selections.filter((item) =>
      isPresentedAsLoose(item, props.groups, props.selections),
    );
  const visibleGroups = () => filterUserFacingGroups(props.groups);
  const grouped = () => groupComments(visibleGroups(), props.selections);
  return (
    <div data-react-grab-group-list>
      {ungrouped().length > 0 && (
        <UngroupedSection
          items={ungrouped()}
          isFirst={true}
          renderItem={(item) => <div data-row={item.id}>{item.id}</div>}
        />
      )}
      <For each={grouped()}>
        {(entry, index) => (
          <GroupCollapsible
            group={entry.group}
            items={entry.items}
            isFirst={index() === 0 && ungrouped().length === 0}
            onRename={() => {}}
            onDelete={() => {}}
            onToggleRevealed={() => {}}
            renderItem={(item) => <div data-row={item.id}>{item.id}</div>}
          />
        )}
      </For>
    </div>
  );
};

describe("comments-dropdown group-list composition", () => {
  it("renders loose selections (synthetic group) and user groups under one container", () => {
    const synthGroup: SelectionGroup = {
      id: "synth1", name: "Button", createdAt: 0, revealed: false, synthetic: true,
    };
    const realGroup: SelectionGroup = {
      id: "g1", name: "Alpha", createdAt: 0, revealed: false,
    };
    const selections = [
      { id: "u1", groupId: "synth1" },
      { id: "g1-item", groupId: "g1" },
    ] as unknown as CommentItem[];

    const { container } = render(() => (
      <GroupListHarness selections={selections} groups={[synthGroup, realGroup]} />
    ));

    const list = container.querySelector("[data-react-grab-group-list]");
    expect(list).toBeTruthy();
    expect(
      list!.querySelector("[data-react-grab-ungrouped-section]"),
    ).toBeTruthy();
    expect(list!.textContent).toContain("Ungrouped");
    expect(list!.textContent).toContain("Alpha");
  });

  it("hides the ungrouped section when all selections are in real groups", () => {
    const selections = [
      { id: "g1-item", groupId: "g1" },
    ] as unknown as CommentItem[];
    const groups: SelectionGroup[] = [
      { id: "g1", name: "Alpha", createdAt: 0, revealed: false },
    ];

    const { container } = render(() => (
      <GroupListHarness selections={selections} groups={groups} />
    ));

    expect(
      container.querySelector("[data-react-grab-ungrouped-section]"),
    ).toBeNull();
    expect(container.textContent).toContain("Alpha");
  });
});
