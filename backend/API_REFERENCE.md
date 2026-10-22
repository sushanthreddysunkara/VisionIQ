# VisionIQ Backend API Reference

This document lists the HTTP endpoints and real-time events exposed or used by the backend.

## Base URL

The backend listens on `http://localhost:5000` by default. Set `PORT` to change the port.
All HTTP API routes below use the `/api` prefix. JSON request bodies are accepted for
`POST` endpoints.

## REST API

| Method | Endpoint | Purpose | Parameters / body |
|---|---|---|---|
| `GET` | `/api/health` | Check that the API is running. | None |
| `GET` | `/api/toll-rates` | Retrieve toll rates grouped by vehicle class. | None |
| `POST` | `/api/vehicles/upload` | Store uploaded vehicle records and optionally broadcast the new dataset. | JSON: `fileName` (required), `rows` (required array), `isAppend` (optional, default `false`), `isLastChunk` (optional, default `true`), `totalRecords` (optional). |
| `GET` | `/api/vehicles` | Load stored vehicle records. | Query: `limit` (default `20`), `fileName` (optional). |
| `GET` | `/api/vehicles/search` | Search vehicle records and return a vehicle dossier for specific vehicle/plate queries. | Query: `q`, `query`, or `plate`; `limit` (default `50`). |
| `GET` | `/api/vehicles/random-batch` | Fetch a random batch of vehicle records. | Query: `count`, `fileName`, `force=true` (fetch even if the stream is paused), `broadcast=true` (broadcast the batch and status). |
| `GET` | `/api/vehicles/stream-control` | Read whether the vehicle stream is paused. | None |
| `POST` | `/api/vehicles/stream-control` | Control the vehicle stream or request an immediate batch. | JSON: `action` = `pause`, `stop`, `resume`, `start`, `trigger`, or `next`. |
| `GET` | `/api/vehicles/stats` | Retrieve vehicle-pool statistics. | Query: `fileName` (optional). |
| `GET` | `/api/vehicles/incidents` | Retrieve incidents, involved vehicles, impact analysis, and risk information. | Query: `limit` (default `200`, capped at `1000`). |
| `GET` | `/api/cameras` | Retrieve camera locations and detection counts. | None |
| `POST` | `/api/auth/login` | Authenticate a user and return a JWT and public user details. | JSON: `identifier`, `email`, or `username`, plus `password`. |
| `GET` | `/api/auth/me` | Return the authenticated user's public details. | Header: `Authorization: Bearer <token>`. |
| `GET` | `/api/query/ollama-status` | Check Ollama connectivity and available models. | None |
| `POST` | `/api/query/ai-parse` | Convert a natural-language traffic query into structured filters. | JSON: `query` (required string), `facets` (optional; may include `types`, `locations`, and `cameras`). |
| `POST` | `/api/query/natural-to-cypher` | Convert a natural-language query into a Cypher query, or pass through an existing Cypher query. | JSON: `query` (required string). |
| `GET` | `/api/network/overview` | Retrieve the network dataset tables (corridors, zones, road segments, cameras, vehicles, incidents, traffic flow, risk profiles, and related data). | None |

### Common response behavior

- Most endpoints return JSON with a `success` property.
- Authentication failures from `/api/auth/me` return HTTP `401`.
- Missing required query/upload input generally returns HTTP `400`.
- Database-dependent endpoints can return HTTP `503` when their required database is unavailable.
- `/api/query/ai-parse` and `/api/query/natural-to-cypher` can use rule-based fallbacks when Ollama is offline.

## Real-time API (Socket.IO)

The Socket.IO server shares the backend host and port.

### Server-to-client events

| Event | Purpose |
|---|---|
| `vehicleStreamStatus` | Publishes stream status, including dataset switches, batches, and pause/resume state. A connected client may receive the latest status immediately after connecting. |
| `newVehicleBatch` | Publishes a batch of vehicle records, including newly uploaded or streamed records. |

These are emitted by the server; the backend does not define client-to-server Socket.IO events.

## Image and evidence resources

These are asset routes rather than JSON API endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/evidence/*` | Serve evidence assets; if no matching asset exists, return a generated SVG preview. |
| `GET` | `/images/*` | Serve vehicle image assets; if no matching asset exists, return a generated SVG preview. |

## External API calls made by the backend

The query controller calls the Ollama service. Its host is configured by `OLLAMA_HOST`
and defaults to `http://localhost:11434`.

| Method | Ollama path | Purpose |
|---|---|---|
| `GET` | `/api/tags` | Check the Ollama service and list installed models. |
| `POST` | `/api/generate` | Generate structured query filters or Cypher from a prompt. |
