# Hivee Cloud expectations for this connector

This connector is only useful if Hivee Cloud exposes a few stable endpoints.

## Required

### 1. Create pairing token
Cloud-side feature for authenticated users.

Example response from cloud UI/API:

```json
{
  "pairingToken": "pair_live_abc123",
  "expiresAt": 1740000000000,
  "workspaceId": "ws_123"
}
```

### 2. Register connector
`POST /api/connectors/register`

### 3. Heartbeat endpoint
`POST /api/connectors/:connectorId/heartbeat`

### 4. Command polling endpoint
`GET /api/connectors/:connectorId/commands?cursor=...`

### 5. Command result ingestion
`POST /api/connectors/:connectorId/commands/:commandId/result`

## Strong recommendation

Cloud should store:

- connector owner user/workspace
- connector display name
- last heartbeat time
- connector version
- current OpenClaw agent snapshot
- last error state

## Good future additions

- connector revoke / rotate secret
- audit trail
- command cancellation
- outbound WS stream support
- connector upgrade notices
