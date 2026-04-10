import type { DB } from "../store/db.js";
import { appendEvent, loadCursor, loadOpenClawSnapshot, loadPairingState, recentEvents, saveCursor, saveOpenClawSnapshot, savePairingState, upsertCommandHistory } from "../store/repository.js";
import type { CloudCommand, CommandResult, ConnectorStatusPayload, OpenClawSnapshot, PairingState } from "../types/domain.js";
import type { Env } from "../config/env.js";
import { CloudApi } from "./cloudApi.js";
import { OpenClawClient } from "./openclawClient.js";
import { errorToText } from "../utils/text.js";
import os from "node:os";

export class ConnectorManager {
  constructor(
    private readonly db: DB,
    private readonly env: Env,
    private readonly cloudApi: CloudApi,
    private readonly openclaw: OpenClawClient
  ) {}

  status(): ConnectorStatusPayload {
    return {
      connectorName: this.env.CONNECTOR_NAME,
      version: "0.1.0",
      host: {
        hostname: os.hostname(),
        platform: process.platform,
        arch: process.arch
      },
      pairing: loadPairingState(this.db),
      openclaw: loadOpenClawSnapshot(this.db),
      recentEvents: recentEvents(this.db, 50)
    };
  }

  async discoverOpenClaw(): Promise<OpenClawSnapshot> {
    const snapshot = await this.openclaw.discover();
    saveOpenClawSnapshot(this.db, snapshot);
    appendEvent(
      this.db,
      snapshot.healthy ? "info" : "warn",
      "openclaw.discover",
      snapshot.healthy ? `OpenClaw healthy at ${snapshot.baseUrl}` : "OpenClaw discovery failed",
      {
        baseUrl: snapshot.baseUrl,
        agents: snapshot.agents.map((a) => a.id),
        models: snapshot.models,
        error: snapshot.lastError
      }
    );
    return snapshot;
  }

  async pair(cloudBaseUrl: string, pairingToken: string): Promise<PairingState> {
    const snapshot = await this.discoverOpenClaw();
    savePairingState(this.db, {
      ...loadPairingState(this.db),
      cloudBaseUrl,
      pairingToken,
      status: "pairing",
      lastError: null,
      updatedAt: Date.now(),
      connectorId: null,
      connectorSecret: null
    });

    try {
      const result = await this.cloudApi.register(pairingToken, cloudBaseUrl, snapshot);
      const state: PairingState = {
        connectorId: result.connectorId,
        connectorSecret: result.connectorSecret,
        cloudBaseUrl,
        pairingToken,
        status: "paired",
        lastError: null,
        heartbeatIntervalSec: result.heartbeatIntervalSec ?? this.env.CONNECTOR_HEARTBEAT_INTERVAL_SEC,
        commandPollIntervalSec: result.commandPollIntervalSec ?? this.env.CONNECTOR_COMMAND_POLL_INTERVAL_SEC,
        updatedAt: Date.now()
      };
      savePairingState(this.db, state);
      appendEvent(this.db, "info", "pairing.success", `Paired connector ${result.connectorId}`, { cloudBaseUrl });
      return state;
    } catch (error) {
      const state: PairingState = {
        ...loadPairingState(this.db),
        status: "error",
        lastError: errorToText(error),
        updatedAt: Date.now()
      };
      savePairingState(this.db, state);
      appendEvent(this.db, "error", "pairing.error", state.lastError || "Pairing failed", { cloudBaseUrl });
      throw error;
    }
  }

  clearPairing(): PairingState {
    const state: PairingState = {
      connectorId: null,
      connectorSecret: null,
      cloudBaseUrl: null,
      pairingToken: null,
      status: "unpaired",
      lastError: null,
      heartbeatIntervalSec: this.env.CONNECTOR_HEARTBEAT_INTERVAL_SEC,
      commandPollIntervalSec: this.env.CONNECTOR_COMMAND_POLL_INTERVAL_SEC,
      updatedAt: Date.now()
    };
    savePairingState(this.db, state);
    saveCursor(this.db, null);
    appendEvent(this.db, "info", "pairing.clear", "Pairing cleared");
    return state;
  }

  async heartbeat(): Promise<void> {
    const state = loadPairingState(this.db);
    const openclaw = loadOpenClawSnapshot(this.db);
    if (state.status !== "paired") return;
    await this.cloudApi.heartbeat(state, openclaw);
    appendEvent(this.db, "info", "heartbeat.ok", "Heartbeat sent", {
      connectorId: state.connectorId,
      cloudBaseUrl: state.cloudBaseUrl
    });
  }

  async pollAndExecute(): Promise<void> {
    const state = loadPairingState(this.db);
    if (state.status !== "paired") return;

    const cursor = loadCursor(this.db);
    const response = await this.cloudApi.pollCommands(state, cursor);
    if (response.cursor !== cursor) {
      saveCursor(this.db, response.cursor ?? null);
    }

    for (const command of response.commands) {
      await this.executeCloudCommand(command);
    }
  }

  async executeCloudCommand(command: CloudCommand): Promise<CommandResult> {
    const state = loadPairingState(this.db);
    const snapshot = loadOpenClawSnapshot(this.db);
    const startedAt = Date.now();

    upsertCommandHistory(this.db, {
      cloudCommandId: command.id,
      type: command.type,
      status: "running",
      requestJson: command.payload
    });

    try {
      let output: Record<string, unknown> = {};

      switch (command.type) {
        case "connector.ping":
          output = { pong: true, observedAt: Date.now() };
          break;
        case "openclaw.discover": {
          const fresh = await this.discoverOpenClaw();
          output = { snapshot: fresh };
          break;
        }
        case "openclaw.list_agents":
          output = { agents: snapshot.agents, models: snapshot.models };
          break;
        case "openclaw.chat": {
          const message = String(command.payload.message || "").trim();
          const agentId = command.payload.agentId ? String(command.payload.agentId) : undefined;
          const sessionKey = command.payload.sessionKey ? String(command.payload.sessionKey) : undefined;
          const chat = await this.openclaw.chat({ message, agentId, sessionKey }, snapshot);
          if (!chat.ok) throw new Error(chat.error || "OpenClaw chat failed");
          output = chat as unknown as Record<string, unknown>;
          break;
        }
        case "openclaw.proxy_http": {
          const method = String(command.payload.method || "GET").toUpperCase();
          const path = String(command.payload.path || "");
          output = await this.openclaw.proxyHttp(snapshot, method, path, command.payload.body);
          break;
        }
        default:
          throw new Error(`Unsupported command type: ${command.type}`);
      }

      const result: CommandResult = {
        ok: true,
        commandId: command.id,
        type: command.type,
        output,
        startedAt,
        finishedAt: Date.now()
      };

      upsertCommandHistory(this.db, {
        cloudCommandId: command.id,
        type: command.type,
        status: "done",
        requestJson: command.payload,
        responseJson: result
      });

      await this.cloudApi.postCommandResult(state, command.id, result);
      appendEvent(this.db, "info", "command.done", `Executed ${command.type}`, { commandId: command.id });
      return result;
    } catch (error) {
      const result: CommandResult = {
        ok: false,
        commandId: command.id,
        type: command.type,
        error: errorToText(error),
        startedAt,
        finishedAt: Date.now()
      };
      upsertCommandHistory(this.db, {
        cloudCommandId: command.id,
        type: command.type,
        status: "error",
        requestJson: command.payload,
        responseJson: result,
        errorText: result.error
      });
      await this.cloudApi.postCommandResult(state, command.id, result);
      appendEvent(this.db, "error", "command.error", `Failed ${command.type}`, {
        commandId: command.id,
        error: result.error
      });
      return result;
    }
  }
}
