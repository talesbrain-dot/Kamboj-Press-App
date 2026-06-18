# Kamboj Press App — PRD

## Original Problem Statement
React + FastAPI + MongoDB order management web app for a local print press. User (Hinglish speaker) imported existing codebase and requested bug fixes followed by 4 new features.

## Core Requirements / Personas
- **Admin**: full access — manages customers, orders, payments, team, branding, backups, balances.
- **Staff**: limited to orders assigned to them; can update product statuses but not record payments.

## Implemented (chronological)

### Bug fixes (Iteration 1 — Feb 2026)
- `GET /api/branding` endpoint + dynamic BrandingContext (app name, logo reflect in header/login/title).
- `POST /api/reminders/dismiss` & `restore` routes for "Mark as Seen" / restore actions.
- Status rename + auto-migration: `Cutting → Binding`, `Packing → Flex`; new `Screen Printing` status added. Updates flowed to `PRODUCT_STATUSES`, `STATUS_COLORS`, and order detail UI.
- Backend `/api/backup` switched from JSON dict to a multi-sheet Excel workbook via `openpyxl`.

### New features (Iteration 2 — Feb 2026)
- **Customers list balance** — `GET /api/customers` now aggregates `total_balance`, `total_orders`, `total_business`. `Customers.jsx` renders the balance per row (rose for >0, emerald for 0) with `data-testid="customer-balance-<id>"`.
- **Inline status update in Production Queue** — `StatusQueue.jsx` now uses a per-row `Select` (`inline-status-<product_id>`) that calls `PATCH /api/orders/<order_id>/products/<product_id>`. Optimistic update via response payload; toast on success/failure; row disappears from current queue if status no longer matches.
- **Balance page (`/balance`)** — new admin-only route backed by `GET /api/orders/balance/list`. Summary cards (Orders Pending, Total Outstanding, Combined Order Value), search input, list of orders with product status badges. Sidebar link with `Wallet` icon between Reminders and Customers.
- **Excel backup download** — `Settings.jsx` now requests `/api/backup` with `responseType: 'blob'`, derives filename from `Content-Disposition`, and downloads the real `.xlsx` (validated PK header, 10.5 KB sample).

## Tech Stack
- Frontend: React 18, React Router, Tailwind, shadcn/ui, lucide-react, axios.
- Backend: FastAPI, Motor (async MongoDB), `openpyxl` for Excel export.
- Auth: JWT (bearer); admin seeded with `admin/admin123`.

## Architecture
```
/app
├── backend/
│   ├── server.py            # Routes, models, helpers, Excel backup builder
│   ├── tests/backend_test.py# Pytest covering customers, balance list, status PATCH, backup
│   └── requirements.txt
├── frontend/src/
│   ├── pages/               # Dashboard, Customers, CustomerDetail, NewOrder, OrderDetail,
│   │                          EditOrder, Invoice, Reminders, StatusQueue, Balance, Settings,
│   │                          Users, Login
│   ├── components/Layout.jsx (sidebar incl. Balance)
│   ├── context/             # Auth, Theme, Branding
│   └── lib/api.js           # axios instance + PRODUCT_STATUSES + STATUS_COLORS
└── memory/PRD.md
```

## Key API Endpoints
- `GET /api/branding`
- `GET /api/customers` — returns `total_balance`, `total_orders`, `total_business`
- `GET /api/orders/balance/list` — outstanding orders, sorted by balance desc
- `PATCH /api/orders/{order_id}/products/{product_id}` — `{ status }`
- `POST /api/reminders/dismiss` / `/api/reminders/restore`
- `GET /api/backup` — admin-only, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## Testing Status (Iteration 3)
- Backend pytest: **9/9 passed** (`/app/backend/tests/backend_test.py`).
- Frontend Playwright flow: **100%** — login, sidebar order, customers balance, /balance page (search + row click), inline status dropdown w/ toast + row removal, xlsx download.

## Backlog / Future Enhancements (P1/P2)
- P2: Replace duplicate `@app.get('/backup')` / `@app.get('/stats')` with single `@api.*` registration (currently dead code on the non-/api path).
- P2: Convert customer balance aggregation to a Mongo `$group` pipeline as order volume grows.
- P2: Server-side pagination / filtering for `Orders`, `Balance`, and `StatusQueue` once dataset crosses ~2000.
- P1: WhatsApp / SMS reminders for balance-due customers.
- P1: Customer ledger PDF export (alongside invoice).

## Credentials
See `/app/memory/test_credentials.md` — `admin / admin123`.
