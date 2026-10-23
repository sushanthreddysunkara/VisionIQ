# VisionIQ

VisionIQ is a React + Vite application with a Django REST Framework backend.
The frontend is in `frontend/`, and the API/backend is in `backend/`. Django
serves the existing API contracts and connects to the configured MySQL
database; it does not replace MySQL with SQLite.

## Project layout

```text
VisionIQ/
├── backend/
│   ├── manage.py
│   ├── config/                 # Django settings, URLs, ASGI and WSGI
│   ├── visioniq/               # API, unmanaged legacy models and services
│   ├── data/                   # Existing backend data files
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/                    # Existing React application
│   ├── public/                 # Vite static assets and sample feed
│   ├── data/                   # Local spreadsheet (not publicly served)
│   ├── scripts/                # Frontend data utilities
│   ├── package.json
│   └── vite.config.js          # Proxies API and Socket.IO to Django
├── README.md
└── LAN_SETUP.md
```

## Prerequisites

- Python 3.14 (Django 5.2 LTS; the dependency ranges are validated on Python
  3.14).
- Node.js 24 or a compatible current Node.js release.
- Access to the existing MySQL database and its existing telemetry/network
  tables.
- Optional: Ollama, if AI-assisted query parsing is desired.

## Local setup

### Backend — Windows PowerShell

From the repository root:

```powershell
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
py -3.14 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Edit `backend\.env` and provide:

- `DJANGO_SECRET_KEY`: a unique random value of at least 32 characters.
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and
  `MYSQL_DATABASE`: the existing MySQL connection.
- `FRONTEND_URL`: exact React origin(s), comma-separated if needed.
- `DJANGO_ALLOWED_HOSTS`: hostnames/IPs used to reach Django, comma-separated.
- Optional `MYSQL_SSL`, `DJANGO_DEBUG`, `HOST`, `PORT`, `OLLAMA_HOST`,
  `OLLAMA_MODEL`, `STREAM_INTERVAL`, `DATA_DIRECTORY`, and `AI_MODEL_PATH`.

Do not commit `backend\.env`. It contains local secrets and is ignored by Git.
Use only `backend\.env.example` as the placeholder template.

Check the configuration and review migrations before applying:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py migrate --plan
.\.venv\Scripts\python.exe manage.py migrate --noinput
```

The legacy network and telemetry tables are represented by unmanaged Django
models, verified against the configured MySQL schema with `inspectdb`; their
data and schema are not recreated. The initial migration creates `users` only
if it does not already exist. To create configured administrator accounts
without changing existing users:

```powershell
.\.venv\Scripts\python.exe manage.py seed_users
```

The Django signing key is intentionally separate from the legacy Node.js JWT
key, so users with a token already stored in the browser may need to sign in
once after migration. The seed command creates missing accounts and never
changes existing passwords.

Start the ASGI server (required for Socket.IO):

```powershell
.\.venv\Scripts\python.exe manage.py serve
```

By default this uses `HOST` and `PORT` from `backend\.env`. For a private LAN,
use `HOST=0.0.0.0`, restrict `DJANGO_ALLOWED_HOSTS`/`FRONTEND_URL` to the
actual hosts, and do not expose the development API publicly.

### Backend — Linux/macOS

```bash
if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env; fi
python3.14 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
.venv/bin/python manage.py check
.venv/bin/python manage.py migrate --plan
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py serve
```

### Frontend — Windows PowerShell

Open a second terminal at the repository root:

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

On Linux/macOS:

```bash
cd frontend
npm ci
npm run dev
```

Vite proxies `/api`,
`/socket.io`, `/images`, and `/evidence` to `http://127.0.0.1:8000`. For a
separately hosted frontend, set `VITE_API_URL` to the Django API origin and add
the frontend's exact origin to `FRONTEND_URL`.

Run a production frontend build from `frontend/` with `npm.cmd run build`
(PowerShell) or `npm run build` (Linux/macOS).

## Migrated API and event contracts

The API routes are unauthenticated except `GET /api/auth/me`, which requires
the existing bearer-token flow. Login continues to return `{token, user}`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend health |
| `POST` | `/api/vehicles/upload` | Store browser-parsed CSV/XLSX row batches |
| `GET` | `/api/vehicles` | List telemetry rows |
| `GET` | `/api/vehicles/search` | Search vehicle records and dossier details |
| `GET` | `/api/vehicles/random-batch` | Fetch the next telemetry stream batch |
| `GET`, `POST` | `/api/vehicles/stream-control` | Pause, resume, or trigger the stream |
| `GET` | `/api/vehicles/stats` | Telemetry summary statistics |
| `GET` | `/api/vehicles/incidents` | Telemetry-derived incidents |
| `GET` | `/api/corridors` | Corridor KPIs, cameras, incidents, risk and impact |
| `GET` | `/api/cameras` | Existing six-camera registry |
| `POST` | `/api/auth/login` | Username/email login |
| `GET` | `/api/auth/me` | Resolve the current bearer-token user |
| `GET` | `/api/query/ollama-status` | Ollama connectivity and model status |
| `POST` | `/api/query/ai-parse` | Traffic-language filters with rule fallback |
| `POST` | `/api/query/natural-to-cypher` | Generate or pass through Cypher text |
| `GET`, `HEAD` | `/evidence/<path>` | Serve existing evidence files |
| `GET`, `HEAD` | `/images/<path>` | Serve existing image files |

Socket.IO keeps the existing `newVehicleBatch`, `vehicleStreamStatus`, and
`vehicleStreamComplete` events. Cypher is generated as text only; no graph
database executes it. There are no `/api/network/*` or `/api/toll-rates`
endpoints in the existing backend. Network, ontology, camera feeds, dashboards,
projects and other features that already use local/static data or browser
storage remain frontend-managed rather than receiving invented server data.

## Database and safety

The current MySQL schema includes `users`, `vehicle_events`, corridor/KPI,
camera, incident, risk, impact, traffic-flow, vehicle, toll-rate and knowledge
graph tables. Their Django models use `managed = False`, based on the actual
connected schema. Django does not modify these tables. `migrate` only applies
the idempotent legacy-users bootstrap and records Django migration state; it
does not drop or reset data.

The telemetry upload operation is transactional. It writes to the existing
`vehicle_events` schema. The application does not auto-seed sample telemetry at
startup. The frontend's existing sample feed and local dashboard fixtures
remain unchanged.

## Testing

```powershell
Set-Location backend
.\.venv\Scripts\python.exe manage.py test visioniq
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

The model integration can be inspected without changing data using:

```powershell
.\.venv\Scripts\python.exe manage.py inspectdb
```

For a MySQL connection failure, missing legacy table, or Ollama outage, the
backend returns/logs an explicit error or uses the documented deterministic
query fallback; it does not silently replace the configured database or claim
to have generated AI predictions.

Future image/video-frame inference is isolated behind
`backend/visioniq/services/inference.py`. It validates JPEG/PNG/WebP frame
content and size and reports that inference is unavailable until a model
adapter is configured. No model is created, loaded, or trained as part of this
migration.
