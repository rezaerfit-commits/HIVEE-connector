import type { FastifyInstance } from "fastify";
import { WebSocketServer, WebSocket } from "ws";
import type { DB } from "../store/db.js";
import { loadOpenClawSnapshot } from "../store/repository.js";
import { buildWsCandidates } from "../utils/openclaw.js";
import type { Env } from "../config/env.js";

/**
 * Minimal local admin WS bridge.
 *
 * This endpoint is intentionally local/admin-facing, not public-SaaS-facing.
 * It allows a diagnostics client to connect to the connector and have the connector
 * relay frames to the local OpenClaw websocket.
 */
export function registerWsBridge(app: FastifyInstance, db: DB, env: Env): void {
  const wss = new WebSocketServer({ noServer: true });

  app.server.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/ws/openclaw-bridge")) return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (client) => {
    const snapshot = loadOpenClawSnapshot(db);
    if (!snapshot.baseUrl) {
      client.send(JSON.stringify({ type: "error", error: "No local OpenClaw base URL configured" }));
      client.close();
      return;
    }

    const token = (env.OPENCLAW_TOKEN || "").trim();
    const candidates = snapshot.wsCandidates.length ? snapshot.wsCandidates : buildWsCandidates(snapshot.baseUrl, env.OPENCLAW_WS_PATH || undefined);

    let upstream: WebSocket | null = null;
    let connected = false;
    let lastError = "No candidate tried";

    const connectNext = (index: number) => {
      if (index >= candidates.length) {
        client.send(JSON.stringify({ type: "error", error: `Bridge could not connect to local OpenClaw WS. ${lastError}` }));
        client.close();
        return;
      }

      const target = candidates[index];
      const ws = new WebSocket(target, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        handshakeTimeout: env.OPENCLAW_REQUEST_TIMEOUT_MS
      });

      ws.on("open", () => {
        connected = true;
        upstream = ws;
        client.send(JSON.stringify({ type: "bridge.ready", target }));
      });

      ws.on("message", (data) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
        }
      });

      ws.on("error", (error) => {
        lastError = error instanceof Error ? error.message : String(error);
      });

      ws.on("close", () => {
        if (!connected) {
          connectNext(index + 1);
          return;
        }
        if (client.readyState === WebSocket.OPEN) client.close();
      });
    };

    connectNext(0);

    client.on("message", (data) => {
      if (upstream && upstream.readyState === WebSocket.OPEN) {
        upstream.send(data.toString());
      }
    });

    client.on("close", () => {
      try {
        upstream?.close();
      } catch {}
    });
  });
}
