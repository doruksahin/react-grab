import type { ScreenshotStore } from "./types.js";

export class R2ScreenshotStore implements ScreenshotStore {
  constructor(private readonly bucket: R2Bucket) {}

  async upload(
    key: string,
    data: ArrayBuffer,
    contentType: string,
  ): Promise<void> {
    await this.bucket.put(key, data, {
      httpMetadata: { contentType },
    });
  }

  async get(
    key: string,
  ): Promise<{ body: ReadableStream; contentType: string } | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;

    return {
      body: object.body,
      contentType:
        object.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }
}
