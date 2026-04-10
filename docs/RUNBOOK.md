# Operator runbook

## Check service health

```bash
curl http://127.0.0.1:43137/health
curl http://127.0.0.1:43137/api/status
```

## Force rediscovery

```bash
curl -X POST http://127.0.0.1:43137/api/openclaw/discover
```

## Pair connector

```bash
curl -X POST http://127.0.0.1:43137/api/pairing/start \
  -H 'Content-Type: application/json' \
  -d '{
    "cloudBaseUrl":"https://cloud.example.com",
    "pairingToken":"pair_live_123"
  }'
```

## Common failure modes

### Discovery returns no agents
- verify local OpenClaw is running
- verify `OPENCLAW_BASE_URL` or `OPENCLAW_DISCOVERY_CANDIDATES`
- verify token if your local OpenClaw requires auth
- test local endpoints:

```bash
curl -i http://127.0.0.1:18789/v1/models
```

### WebSocket chat fails
That is expected in some deployments.
This connector already falls back to HTTP when using `openclaw.chat` with `OPENCLAW_TRANSPORT=auto`.

### Pairing fails
- check cloud URL
- check pairing token validity
- verify cloud register endpoint exists

## Data location
By default, connector state is stored in:

```text
./data/connector.db
```
