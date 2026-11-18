import { createSerialQueue } from "../utils/serial-queue.js";

export const siteTrustQueue = createSerialQueue();

export const settingsWriteQueue = createSerialQueue();
