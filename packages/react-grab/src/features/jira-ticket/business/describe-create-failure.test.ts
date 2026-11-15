import { describe, expect, it } from "vitest";
import {
  CONNECTION_FAILURE_HINT,
  describeCreateFailure,
} from "./describe-create-failure.js";

describe("describeCreateFailure", () => {
  it("shows the server's reason", () => {
    expect(describeCreateFailure(new Error("JIRA rejected the request"))).toBe(
      "JIRA rejected the request",
    );
  });

  it("asks to check the connection when the request got no answer", () => {
    expect(describeCreateFailure(new TypeError("Failed to fetch"))).toBe(
      CONNECTION_FAILURE_HINT,
    );
  });

  it("asks to check the connection for anything without a message", () => {
    expect(describeCreateFailure("boom")).toBe(CONNECTION_FAILURE_HINT);
    expect(describeCreateFailure(new Error(""))).toBe(CONNECTION_FAILURE_HINT);
  });
});
