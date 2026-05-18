import { describe, it, expect } from "vitest";
import { handleOnce } from "../console/cli.js";

describe("interfaces.handleOnce", () => {
  it("returns a decorated string for greeting", async () => {
    const out = await handleOnce("hello");
    expect(typeof out).toBe("string");
    expect(out).toContain("Thoughts");
  });
});
