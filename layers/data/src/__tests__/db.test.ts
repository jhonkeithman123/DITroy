import { describe, it, expect } from "vitest";
import { getCachedResponse } from "../db.js";

describe("data.getCachedResponse", () => {
  it("returns null for unknown key", async () => {
    const res = await getCachedResponse(
      "this-key-should-not-exist-" + Date.now(),
    );
    expect(res).toBeNull();
  });
});
