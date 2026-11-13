import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { authorized } from "../../test/api-token.js";

/**
 * SPEC-020 / ADR-0021 through the Worker's own entry point, against real R2.
 * Uploading needs the token; watching needs only the link.
 */

let BASE: string;

beforeEach(() => {
  BASE = `https://sync.test/workspaces/ws-${crypto.randomUUID()}`;
});

const gzip = async (text: string): Promise<ArrayBuffer> =>
  new Response(
    new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();

const gunzip = async (response: Response): Promise<string> =>
  new Response(
    response.body!.pipeThrough(new DecompressionStream("gzip")),
  ).text();

const EVENTS = JSON.stringify([{ type: 4, timestamp: 1, data: {} }]);

const upload = async (): Promise<string> => {
  const response = await SELF.fetch(`${BASE}/recordings/comment-1`, {
    method: "PUT",
    headers: authorized({ "content-type": "application/gzip" }),
    body: await gzip(EVENTS),
  });
  expect(response.status).toBe(200);
  const { recordingUrl } = await response.json<{ recordingUrl: string }>();
  return recordingUrl;
};

describe("uploading a recording", () => {
  it("refuses an upload without the token", async () => {
    const response = await SELF.fetch(`${BASE}/recordings/comment-1`, {
      method: "PUT",
      headers: { "content-type": "application/gzip" },
      body: await gzip(EVENTS),
    });
    expect(response.status).toBe(401);
  });

  it("refuses a body that is not gzip", async () => {
    const response = await SELF.fetch(`${BASE}/recordings/comment-1`, {
      method: "PUT",
      headers: authorized({ "content-type": "application/json" }),
      body: EVENTS,
    });
    expect(response.status).toBe(415);
  });

  it("returns a link on this Worker with an unguessable id", async () => {
    const recordingUrl = await upload();
    expect(recordingUrl).toMatch(
      /^https:\/\/sync\.test\/r\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("gives every upload its own link", async () => {
    expect(await upload()).not.toBe(await upload());
  });
});

describe("watching a recording by its link", () => {
  it("serves the player page without a token, kept out of referrers and indexes", async () => {
    const response = await SELF.fetch(await upload());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(await response.text()).toContain("rrweb-player@2.2.2");
  });

  it("keeps the replay frame sandboxed: no UNSAFE_replayCanvas", async () => {
    const page = await (await SELF.fetch(await upload())).text();
    expect(page).not.toContain("UNSAFE_replayCanvas");
  });

  it("serves the uploaded events with ?events, byte for byte", async () => {
    const response = await SELF.fetch(`${await upload()}?events`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/gzip");
    expect(await gunzip(response)).toBe(EVENTS);
  });

  it("answers 404 for an id that was never issued", async () => {
    const response = await SELF.fetch(
      `https://sync.test/r/${crypto.randomUUID()}`,
    );
    expect(response.status).toBe(404);
  });

  it("rejects an id that is not a share id", async () => {
    const response = await SELF.fetch("https://sync.test/r/not-a-uuid");
    expect(response.status).toBe(400);
  });
});
