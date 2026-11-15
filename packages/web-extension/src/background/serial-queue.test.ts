import { describe, expect, it } from "vitest";
import { createSerialQueue } from "./serial-queue.js";

describe("createSerialQueue", () => {
  it("runs tasks one after another, even when one fails", async () => {
    const queue = createSerialQueue();
    const events: string[] = [];
    const task =
      (name: string, fail = false) =>
      async () => {
        events.push(`start ${name}`);
        await Promise.resolve();
        events.push(`end ${name}`);
        if (fail) throw new Error(name);
        return name;
      };

    const results = await Promise.allSettled([
      queue.run(task("a")),
      queue.run(task("b", true)),
      queue.run(task("c")),
    ]);

    expect(events).toEqual([
      "start a",
      "end a",
      "start b",
      "end b",
      "start c",
      "end c",
    ]);
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
  });
});
