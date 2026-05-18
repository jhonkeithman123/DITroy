import { describe, it, expect } from "vitest";
import { handleOnce } from "@ditroy/interfaces";

describe("app demo helper", () => {
  it("can call handleOnce via interfaces", async () => {
    const out = await handleOnce("hello");
    expect(typeof out).toBe("string");
  });
});
