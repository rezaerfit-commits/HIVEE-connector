# Architecture notes

## Core idea

This connector is the **edge runtime** that sits near OpenClaw.

It should not contain full project/task business logic.
That belongs in Hivee Cloud.

## Why not direct user-to-OpenClaw?

Direct user-to-OpenClaw becomes fragile because:

- public WSS routing often breaks
- users should not debug reverse proxies
- users should not manage SSH tunnels manually every session
- OpenClaw is safest when treated as local/private infrastructure

## Why outbound connector-to-cloud instead of cloud-to-user SSH?

Because outbound is simpler for end users and scales better operationally.

The cloud should not need to:

- discover user VPS IPs
- manage SSH keys/passwords for every tenant
- open ad-hoc tunnels into arbitrary customer hosts

## Current MVP communication

- connector -> cloud: HTTP register/heartbeat/poll/result
- connector -> openclaw: local WS first, HTTP fallback

## Future upgrade path

- connector -> cloud: outbound WebSocket stream
- optional streaming command logs
- stronger signed command envelopes
