import { describe, expect, it } from "vitest";
import { buildWsCandidates } from "../src/utils/openclaw.js";

describe("buildWsCandidates", () => {
  it("converts http base URL into ws candidates", () => {
    const out = buildWsCandidates("http://127.0.0.1:18789");
    expect(out[0]).toBe("ws://127.0.0.1:18789");
    expect(out).toContain("ws://127.0.0.1:18789/ws");
    expect(out).toContain("ws://127.0.0.1:18789/gateway/ws");
  });

  it("converts https base URL into wss candidates", () => {
    const out = buildWsCandidates("https://example.com");
    expect(out[0]).toBe("wss://example.com");
  });
});
