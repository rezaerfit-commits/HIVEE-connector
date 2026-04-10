import { describe, expect, it } from "vitest";
import { inferAgentsFromModels } from "../src/utils/openclaw.js";

describe("inferAgentsFromModels", () => {
  it("extracts openclaw-prefixed models as agents", () => {
    const out = inferAgentsFromModels(["openclaw/main", "gpt-4o-mini", "openclaw/default"]);
    expect(out).toEqual([
      { id: "openclaw/main", name: "openclaw/main" },
      { id: "openclaw/default", name: "openclaw/default" }
    ]);
  });
});
