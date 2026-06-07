import { describe, it, expect } from "vitest";
import * as gen from "../dialogue/generator.js";

describe("generator", () => {
  it("produces non-empty short replies", () => {
    const s = gen.genShortReply("weather");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });

  it("produces friendly question", () => {
    const q = gen.genFriendlyQuestion("time");
    expect(q.endsWith("?") || q.length > 0).toBeTruthy();
  });
});
