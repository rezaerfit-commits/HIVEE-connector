import type { Env } from "../config/env.js";

export async function tryDockerDiscovery(env: Env): Promise<{ enabled: boolean; found: boolean; hints: string[] }> {
  if (!env.ENABLE_DOCKER_DISCOVERY) {
    return { enabled: false, found: false, hints: ["Docker discovery disabled"] };
  }

  // This repo keeps docker discovery intentionally conservative.
  // Mounting docker.sock is a privileged action and should remain optional.
  // In production, prefer explicit OPENCLAW_BASE_URL or same-network container DNS.
  return {
    enabled: true,
    found: false,
    hints: [
      "Docker discovery is enabled but not implemented by default in this scaffold.",
      "Prefer same-host OpenClaw and set OPENCLAW_BASE_URL=http://127.0.0.1:18789 or use service DNS."
    ]
  };
}
