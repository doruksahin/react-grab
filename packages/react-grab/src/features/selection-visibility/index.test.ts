import { describe, expect, it, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";
import type { CommentItem, OverlayBounds, ToolbarState } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import { createSelectionVisibility } from "./index.js";
import type { PreviewEntry, SelectionVisibilityDeps } from "./types.js";

const bounds: OverlayBounds = {
  borderRadius: "0px",
  height: 10,
  transform: "none",
  width: 10,
  x: 0,
  y: 0,
};

const selection = (id: string, revealed: boolean): CommentItem => ({
  id,
  groupId: null,
  content: `<li>${id}</li>`,
  elementName: "li",
  tagName: "li",
  commentText: `Comment ${id}`,
  timestamp: 0,
  revealed,
});

const setup = (initialItems: CommentItem[]) =>
  createRoot((dispose) => {
    const [items, setItems] = createSignal(initialItems);
    const [disconnected, setDisconnected] = createSignal(new Set<string>());
    const elements = new Map(
      initialItems.map((item) => [item.id, [document.createElement("li")]]),
    );
    const removeGrabbedBox = vi.fn<(boxId: string) => void>();
    const removeLabelInstance = vi.fn<(labelId: string) => void>();
    const addCommentItemPreview = vi.fn(
      (
        item: CommentItem,
        _bounds: OverlayBounds[],
        _elements: Element[],
        prefix: string,
        tracking: PreviewEntry[],
      ) => {
        tracking.push({
          boxId: `${prefix}-${item.id}-0`,
          labelId: `${prefix}-label-${item.id}`,
        });
      },
    );
    const deps: SelectionVisibilityDeps = {
      commentItems: items,
      setCommentItems: setItems,
      persistCommentItems: (next) => {
        setItems(next);
        return next;
      },
      getConnectedCommentElements: (item) => elements.get(item.id) ?? [],
      disconnectedItemIds: disconnected,
      createElementBounds: () => bounds,
      addCommentItemPreview,
      actions: { removeGrabbedBox, removeLabelInstance },
      currentToolbarState: () => null,
      updateToolbarState: (updates) => ({ ...updates }) as ToolbarState,
      groups: () => [] as SelectionGroup[],
      persistGroups: (groups) => groups,
    };
    const api = createSelectionVisibility(deps);
    return {
      api,
      dispose,
      setItems,
      setDisconnected,
      addCommentItemPreview,
      removeGrabbedBox,
      removeLabelInstance,
    };
  });

const addsFor = (
  add: ReturnType<typeof setup>["addCommentItemPreview"],
  id: string,
) => add.mock.calls.filter(([item]) => item.id === id).length;

describe("revealed selection previews", () => {
  it("toggling one selection leaves the other revealed previews in place", () => {
    const view = setup([selection("a", true), selection("b", true)]);
    expect(addsFor(view.addCommentItemPreview, "a")).toBe(1);

    view.api.handleToggleItem("b");

    expect(view.removeGrabbedBox).toHaveBeenCalledWith("reveal-pinned-b-0");
    expect(view.removeGrabbedBox).not.toHaveBeenCalledWith("reveal-pinned-a-0");
    expect(view.removeLabelInstance).not.toHaveBeenCalledWith(
      "reveal-pinned-label-a",
    );
    expect(addsFor(view.addCommentItemPreview, "a")).toBe(1);

    view.api.handleToggleItem("b");
    expect(addsFor(view.addCommentItemPreview, "b")).toBe(2);
    expect(addsFor(view.addCommentItemPreview, "a")).toBe(1);
    view.dispose();
  });

  it("a change to another selection does not redraw a revealed one", () => {
    const view = setup([selection("a", true), selection("b", false)]);
    view.setItems((items) => [
      ...items.map((item) =>
        item.id === "b" ? { ...item, commentText: "edited" } : { ...item },
      ),
      selection("c", false),
    ]);
    view.setDisconnected(new Set<string>());

    expect(addsFor(view.addCommentItemPreview, "a")).toBe(1);
    expect(view.removeGrabbedBox).not.toHaveBeenCalled();
    view.dispose();
  });

  it("redraws a selection whose own label content changed", () => {
    const view = setup([selection("a", true)]);
    view.setItems((items) =>
      items.map((item) => ({ ...item, commentText: "edited" })),
    );
    expect(view.removeGrabbedBox).toHaveBeenCalledWith("reveal-pinned-a-0");
    expect(addsFor(view.addCommentItemPreview, "a")).toBe(2);
    view.dispose();
  });

  it("removes the preview of a selection whose element disconnected", () => {
    const view = setup([selection("a", true), selection("b", true)]);
    view.setDisconnected(new Set(["a"]));
    expect(view.removeGrabbedBox).toHaveBeenCalledTimes(1);
    expect(view.removeGrabbedBox).toHaveBeenCalledWith("reveal-pinned-a-0");
    view.dispose();
  });

  it("removes every preview on disposal", () => {
    const view = setup([selection("a", true), selection("b", true)]);
    view.dispose();
    expect(view.removeGrabbedBox.mock.calls.map(([id]) => id).sort()).toEqual([
      "reveal-pinned-a-0",
      "reveal-pinned-b-0",
    ]);
    expect(view.removeLabelInstance).toHaveBeenCalledTimes(2);
  });
});
