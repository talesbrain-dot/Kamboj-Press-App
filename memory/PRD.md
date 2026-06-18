# Kamboj Press App — PRD

## Original Problem Statement
React + FastAPI + MongoDB order management web app for a local print press. User (Hinglish speaker) imported existing codebase and is iteratively adding features.

## Personas
- **Admin**: full access — manages customers, orders, payments, team, branding, backups, balances, Google Drive sync.
- **Staff**: limited to assigned orders; can update product statuses but not record payments.

## Implemented (chronological)

### Iteration 1 — Initial bug fixes (Feb 2026)
- `GET /api/branding` + dynamic BrandingContext.
- `POST /api/reminders/dismiss` & `restore`.
- Status rename + auto-migration: `Cutting → Binding`, `Packing → Flex`; new `Screen Printing` status.
- `/api/backup` switched to multi-sheet Excel workbook via `openpyxl`.

### Iteration 2 — Quality of life (Feb 2026)
- **Customers list balance** — `GET /api/customers` aggregates `total_balance`, `total_orders`, `total_business`; UI shows colored balance per row.
- **Inline status update in Production Queue** — `PATCH /api/orders/<id>/products/<id>` from a Select on each queue row.
- **Balance page (`/balance`)** — admin-only, lists outstanding orders, summary cards, search.
- **Excel backup blob download** — `Settings.jsx` requests `/api/backup` with `responseType: 'blob'`.

### Iteration 3 — Status + Reporting + Drive (Feb 2026)
- **Sidebar rename**: "Digital Printing" → "Status"; default queue now opens at `Offset` filter.
- **Order Summary export** — `GET /api/backup/summary` returns a compact Excel with one row per product. Columns: `#, Order No, Order Date, Customer, Phone, Qty, Product, Price, Total, Advance, Balance`. Order-level fields (no/date/customer/phone/advance/balance) appear only on first product row of each order (matches user's previous app layout).
- **Google Drive auto-sync** — admin uploads a Service-Account JSON + Drive folder ID via Settings → app creates/updates a Google Sheet inside the folder. Auto-syncs after every order create / edit / status change / payment / delete (debounced 3s). Manual "Sync Now" + auto-sync toggle. Stored config: `db.gdrive_config.id='default'`.

## Tech Stack
- Frontend: React 18, React Router, Tailwind, shadcn/ui, lucide-react, axios.
- Backend: FastAPI, Motor, `openpyxl`, `google-auth`, `google-api-python-client`.
- Auth: JWT (bearer); admin seed `admin/admin123`.

## Architecture
```
/app
├── backend/
│   ├── server.py            # Routes incl. /gdrive/*, /backup/summary
│   ├── gdrive.py            # Service-account Drive/Sheets helpers
│   ├── tests/backend_test.py
│   └── requirements.txt
├── frontend/src/
│   ├── pages/               # Dashboard, Customers, CustomerDetail, NewOrder, OrderDetail,
│   │                          EditOrder, Invoice, Reminders, StatusQueue, Balance, Settings,
│   │                          Users, Login
│   ├── components/Layout.jsx (sidebar: Status, Balance, Customers …)
│   └── lib/api.js
└── memory/PRD.md
```

## Key API Endpoints (Iteration 3 additions in **bold**)
- `GET /api/branding`
- `GET /api/customers` — returns `total_balance`
- `GET /api/orders/balance/list`
- `PATCH /api/orders/{id}/products/{id}` — also schedules Drive sync
- `POST /api/reminders/dismiss` / `restore`
- `GET /api/backup` — full Excel
- **`GET /api/backup/summary`** — compact order summary Excel
- **`GET /api/gdrive/status`** — current connection status
- **`POST /api/gdrive/connect`** — `{service_account_json, folder_id, auto_sync}`
- **`POST /api/gdrive/sync`** — force sync now
- **`PATCH /api/gdrive/auto-sync`** — toggle
- **`DELETE /api/gdrive/disconnect`**

## MongoDB Collections
- `customers`, `orders`, `users`, `settings`, `reminder_state`
- **`gdrive_config`** (new): `{id:'default', service_account_json, folder_id, folder_name, spreadsheet_id, auto_sync, last_sync_at, last_sync_status, last_sync_error}`

## Pending / Backlog (P1/P2)
- P1: **Old MongoDB → New MongoDB data migration guide** (3 options documented in chat: same DB reuse / Compass copy / Import Backup feature). Implementation of an in-app "Import Data" feature pending.
- P1: Vercel deployment fixes — `.npmrc` (`legacy-peer-deps=true`) committed; if build still fails, set `CI=false` env on Vercel and switch install command to `yarn install`.
- P1: WhatsApp / SMS reminder for balance-due customers.
- P2: Mongo `$group` aggregation for customer balances at scale (>2000 orders).
- P2: Cleanup duplicate `@app.get('/backup')` / `@app.get('/stats')` dead routes.
- P2: E2E test of Google Drive sync against a real service account (currently only API endpoints unit-verified).

## Deployment
- Frontend → Vercel (Root Directory = `frontend`, `.npmrc` w/ legacy-peer-deps).
- Backend → Render (Python web service). Env: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`.
- Data migration: easiest is to point new Render `MONGO_URL` at the old Atlas DB — same schema, auto-status-migration runs on startup.

## Credentials
See `/app/memory/test_credentials.md` — `admin / admin123`.
