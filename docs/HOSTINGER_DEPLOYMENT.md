# Hostinger Deployment Notes

## Why this exists

Some Hostinger OpenClaw deployments expose the public UI on one port but keep the raw local gateway effectively loopback-only.

In that setup:
- `127.0.0.1:18789` works **inside** the OpenClaw container
- peer containers cannot reach `openclaw:18789`
- the public/app port can return HTML instead of the JSON API the connector expects

A practical workaround is to add an internal TCP bridge on `18790` and point Hivee Connector to that bridge.

## Working setup

- OpenClaw local gateway: `127.0.0.1:18789`
- Bridge for peer containers: `openclaw:18790`
- Hivee Connector base URL: `http://openclaw:18790`
- Connector transport: `http`

## Test from the connector container

```sh
docker exec -it hivee-connector sh -c 'curl -i http://openclaw:18790/v1/models -H "Authorization: Bearer YOUR_TOKEN"'
```

```sh
docker exec -it hivee-connector sh -c 'curl -i http://openclaw:18790/v1/chat/completions -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d "{\"model\":\"openclaw/main\",\"messages\":[{\"role\":\"user\",\"content\":\"ping from connector\"}]}"'
```

If both return JSON, the connector should be able to talk to OpenClaw.

## Important notes

- Do **not** point the connector to the public OpenClaw UI port if that port returns HTML.
- Prefer `OPENCLAW_TRANSPORT=http` for this deployment.
- Keep the bridge service in the same Hostinger project/network namespace as OpenClaw.
