import { createSerialQueue } from "./serial-queue.js";

export const siteTrustQueue = createSerialQueue();

export const settingsWriteQueue = createSerialQueue();
