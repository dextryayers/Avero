import { describe, it, expect } from "vitest";
import { parsePromptToActions } from "./prompt";

describe("prompt-to-edit", () => {
  it("sunset menghasilkan warm + exposure", () => {
    const a = parsePromptToActions("buat langit jadi sunset dramatis");
    expect(a.some((x) => x.id === "hueSaturation")).toBe(true);
  });
  it("hapus background memicu AI", () => {
    const a = parsePromptToActions("hapus background jadi transparan");
    expect(a.some((x) => x.kind === "ai" && x.id === "background-remove")).toBe(true);
  });
  it("prompt kosong fallback auto enhance", () => {
    const a = parsePromptToActions("asdf qwer");
    expect(a.length).toBeGreaterThan(0);
  });
});
