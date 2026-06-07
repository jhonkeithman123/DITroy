import { describe, it, expect } from "vitest";
import { parse } from "../index.js";
import { suggestClarification } from "../dialogue/index.js";

describe("nlp.parse", () => {
  it("detects greeting intent (sync)", () => {
    const res = parse("Hello there", { smart: false });
    expect((res as any).intent).toBe("greet");
  });

  it("detects greeting intent (async smart)", async () => {
    const res = (await parse("Hello there", {
      smart: true,
      thinkMs: 10,
    })) as any;
    expect(res.intent).toBe("greet");
  });

  it("suggestClarification for short token", () => {
    const s = suggestClarification("as");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });
});
