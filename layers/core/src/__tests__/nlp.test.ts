import { describe, it, expect } from "vitest";
import { parse } from "../index.js";

describe("nlp.parse", () => {
  it("detects greeting intent", () => {
    const res = parse("Hello there");
    expect(res.intent).toBe("greet");
  });
});
