# Hivee Connector

Hivee Connector is an **edge bridge** that runs next to a user's local OpenClaw runtime.

It exists to make Hivee Cloud user-friendly:

- users should **not** need to expose OpenClaw directly to the public internet
- users should **not** need to configure SSH tunnels manually on every session
- users should **not** need to understand WebSocket paths, reverse proxies, or VPS routing

Instead:

1. user signs in to **Hivee Cloud**
2. user creates a **pairing token**
3. user installs **Hivee Connector** on the same VPS/host as OpenClaw
4. connector discovers local OpenClaw
5. connector registers itself with Hivee Cloud
6. Hivee Cloud sends commands to the connector
7. connector relays requests to OpenClaw over **local HTTP and/or WebSocket**

---

## What this repo contains

This repo is the **connector / edge agent** only.

It is intentionally separate from Hivee Cloud.

### Responsibilities of this connector

- stores local pairing/config state
- discovers local OpenClaw runtime
- tracks available local agents/models
- sends heartbeats to Hivee Cloud
- polls command queue from Hivee Cloud
- executes commands against local OpenClaw
- exposes a small local admin UI for diagnostics
- supports **WebSocket bridge** and **HTTP fallback** to local OpenClaw

### Responsibilities that belong to Hivee Cloud (not this repo)

- user authentication
- organizations / workspaces
- project/task workflow
- approvals
- usage/billing
- command queue storage
- frontend web app used by end users

---

## Why this connector exists

OpenClaw is generally healthiest when it runs **close to the machine that owns it**.

In real deployments, direct remote access to OpenClaw often becomes messy because of:

- reverse proxy / WSS path issues
- auth mode mismatch
- HTML login pages being served instead of JSON APIs
- user confusion around gateway URLs and VPS setup

This connector avoids that by treating OpenClaw as a **local private dependency**.

Hivee Cloud talks to the connector.
The connector talks to OpenClaw.

---

## Architecture

```text
User Browser
   |
   v
Hivee Cloud (control plane)
   |
   |  commands / results / heartbeats
   v
Hivee Connector (this repo)
   |
   |  local HTTP + local WS
   v
OpenClaw (same VPS / private network)
```

### Communication model

For MVP, the connector uses:

- **HTTP polling** to fetch commands from Hivee Cloud
- **HTTP + WebSocket** to call local OpenClaw

This is intentional.
It keeps product UX simple while avoiding fragile public WSS exposure.

Later, Hivee Cloud ↔ Connector can be upgraded to a persistent outbound WebSocket channel.

---

## Local admin UI

This repo ships with a lightweight local admin UI served by the connector itself.

The admin UI is **not** the end-user product.
It is only for:

- pairing the connector with Hivee Cloud
- inspecting OpenClaw connection status
- viewing agents/models discovered locally
- debugging command execution

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Copy environment file

```bash
cp .env.example .env
```

### 3. Start the connector

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:43137
```

---

## Docker quick start

```bash
docker compose up --build -d
```

Connector admin UI becomes available on:

```text
http://127.0.0.1:43137
```

> This repo does **not** mount `docker.sock` by default. That privilege should stay optional and admin-only.

---

## Pairing flow

### Recommended product flow

1. User logs in to Hivee Cloud
2. User clicks **Add Server**
3. Hivee Cloud returns a short-lived **pairing token**
4. User installs this connector on the VPS where OpenClaw is already running
5. User pastes the pairing token into the connector admin UI
6. Connector registers itself with Hivee Cloud
7. Connector starts heartbeats and command polling
8. Hivee Cloud shows this connector as online

### API contract expected from Hivee Cloud

This connector expects these cloud-side endpoints:

#### Register connector

`POST /api/connectors/register`

Request:

```json
{
  "pairingToken": "pair_live_xxx",
  "connectorName": "My VPS Connector",
  "version": "0.1.0",
  "host": {
    "hostname": "vps-01",
    "platform": "linux",
    "arch": "x64"
  },
  "openclaw": {
    "baseUrl": "http://127.0.0.1:18789",
    "transport": "auto",
    "agents": [
      {"id": "openclaw/main", "name": "openclaw/main"},
      {"id": "openclaw/default", "name": "openclaw/default"}
    ],
    "models": ["openclaw/main", "openclaw/default"]
  }
}
```

Response:

```json
{
  "connectorId": "conn_123",
  "connectorSecret": "sec_live_xxx",
  "heartbeatIntervalSec": 15,
  "commandPollIntervalSec": 5
}
```

#### Heartbeat

`POST /api/connectors/:connectorId/heartbeat`

Request uses `Authorization: Bearer <connectorSecret>`.

#### Poll commands

`GET /api/connectors/:connectorId/commands?cursor=abc`

#### Send command result

`POST /api/connectors/:connectorId/commands/:commandId/result`

---

## Commands supported by this connector

The command executor in this repo supports a minimal but useful command set.

### `connector.ping`
Checks that the connector is online.

### `openclaw.discover`
Re-runs local OpenClaw discovery and returns current agents/models.

### `openclaw.list_agents`
Returns the agent/model snapshot known to the connector.

### `openclaw.chat`
Sends a message to local OpenClaw.

The connector will try this transport order by default:

1. local WebSocket bridge to OpenClaw
2. local HTTP chat fallback

### `openclaw.proxy_http`
Proxies a local OpenClaw HTTP call with controlled allow-listing.

---

## WebSocket strategy

This connector includes a **best-effort WebSocket bridge** to OpenClaw.

Why best-effort?
Because OpenClaw deployments vary:

- some expose `/ws`
- some expose `/gateway/ws`
- some require a different upgrade path
- some work over HTTP but fail over public WSS because of reverse proxy issues

The connector is installed on the same host/private network as OpenClaw, so it can try local WS paths first.

If WebSocket fails, the connector can fall back to HTTP.

That makes the product more reliable for non-technical users.

---

## Security principles

This repo intentionally follows these rules:

- no SSH tunnel requirement for normal users
- no public OpenClaw exposure requirement
- no Docker socket mount by default
- connector initiates outbound traffic to Hivee Cloud
- sensitive tokens are stored locally on the connector host
- cloud only sees the connector secret, not the raw OpenClaw internals unless needed

---

## Repo structure

```text
src/
  config/
  routes/
  services/
  store/
  types/
  utils/
public/
  index.html
  app.js
  styles.css
tests/
  discovery.test.ts
  wsCandidates.test.ts
```

---

## Roadmap

### MVP

- pairing token flow
- local OpenClaw discovery
- heartbeat
- polling command queue
- local OpenClaw WS + HTTP transport
- local admin UI

### Next

- outbound connector WebSocket to Hivee Cloud
- streaming logs and live command updates
- signed command envelopes
- optional Docker discovery helper
- multi-OpenClaw target support per host

---

## Important product guidance

This connector is the **edge runtime**, not the end-user SaaS.

If you are building Hivee as a product:

- keep user/project/business logic in Hivee Cloud
- keep local runtime glue inside this connector
- do not make average users handle VPS IPs, SSH users, WSS paths, or OpenClaw gateway debugging

That is the entire reason this repo should exist.
