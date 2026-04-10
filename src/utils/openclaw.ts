import { ensureTrailingSlashless } from "./text.js";

const DEFAULT_WS_PATHS = ["", "/ws", "/gateway/ws", "/__openclaw__/ws", "/api/ws", "/v1/ws"];

export function buildWsCandidates(baseUrl: string, explicitPath?: string): string[] {
  const normalized = ensureTrailingSlashless(baseUrl);
  const asWs = normalized.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const paths = explicitPath ? [explicitPath, ...DEFAULT_WS_PATHS] : DEFAULT_WS_PATHS;
  const dedup = new Set<string>();
  for (const rawPath of paths) {
    const path = rawPath || "";
    dedup.add(`${asWs}${path}`);
  }
  return Array.from(dedup);
}

export function inferAgentsFromModels(models: string[]): { id: string; name: string }[] {
  const seen = new Set<string>();
  const agents: { id: string; name: string }[] = [];
  for (const model of models) {
    const normalized = String(model || "").trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (normalized.startsWith("openclaw/")) {
      agents.push({ id: normalized, name: normalized });
    }
  }
  return agents;
}
