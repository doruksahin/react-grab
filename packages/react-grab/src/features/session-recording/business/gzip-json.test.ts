import { describe, expect, it } from "vitest";
import { gzipJson } from "./gzip-json.js";

const gunzipText = async (blob: Blob): Promise<string> =>
  new Response(
    new Response(await blob.arrayBuffer()).body?.pipeThrough(
      new DecompressionStream("gzip"),
    ),
  ).text();

describe("gzipJson", () => {
  it("round-trips through DecompressionStream", async () => {
    const value = [{ type: 4, timestamp: 1, data: { href: "https://x.test" } }];
    expect(JSON.parse(await gunzipText(await gzipJson(value)))).toEqual(value);
  });

  it("produces a gzip stream", async () => {
    const bytes = new Uint8Array(await (await gzipJson({})).arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
  });
});
