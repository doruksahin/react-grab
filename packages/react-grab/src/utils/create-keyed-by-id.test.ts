import { describe, expect, it } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { createKeyedById } from "./create-keyed-by-id.js";

describe("createKeyedById", () => {
  it("keeps the same id list while entries are rebuilt, and serves the current entry", () => {
    createRoot((dispose) => {
      const [list, setList] = createSignal([
        { id: "a", text: "one" },
        { id: "b", text: "two" },
      ]);
      const keyed = createKeyedById(list);
      const firstIds = keyed.ids();

      setList((entries) => entries.map((entry) => ({ ...entry, text: "new" })));

      expect(keyed.ids()).toBe(firstIds);
      expect(keyed.byId().get("a")?.text).toBe("new");

      setList((entries) => entries.slice(1));
      expect(keyed.ids()).toEqual(["b"]);
      dispose();
    });
  });
});
