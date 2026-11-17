# Fleet Service Planning & Garage Management System

Full-stack **Angular 19 + TypeScript** and **Node.js / Express + TypeScript** commercial fleet service planning and single-garage workshop management platform. Zero external AI/LLM dependencies — every workflow, inventory movement, template calculation, and tax invoice is handled deterministically by the custom Express REST API and persisted to database storage.

---

## Project Architecture

```
├── frontend/                   # Standalone Angular 19 + Tailwind CSS v4 SPA (Vercel-ready)
│   ├── angular.json
│   ├── package.json
│   ├── vercel.json             # SPA rewrites + optional /api proxy
│   ├── proxy.conf.json         # Local dev proxy (/api -> http://localhost:3000)
│   ├── public/assets/vehicles/ # Commercial vehicle PNG renders
│   └── src/
│       ├── environments/       # environment.ts / environment.prod.ts (API base URL)
│       └── app/
│           ├── models/         # Shared TypeScript interfaces
│           ├── services/       # FleetApiService (Angular Signals + HttpClient) & FirebaseClientService
│           └── components/     # 18 standalone Angular components
├── backend/                    # Standalone Node.js + Express + TypeScript REST API
│   ├── database/schema.sql     # Complete PostgreSQL DDL schema for external PostgreSQL hosting
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── config/             # Firebase Admin & DB initialization
│       ├── data/               # Initial commercial fleet, inventory, supplier & template seed data
│       ├── routes/             # Express REST endpoints (/api/*)
│       ├── services/           # Transactional garage workflows & persistence
│       └── types/              # Backend TypeScript domain models
├── server.ts                   # Single-port (3000) Node/Express entrypoint serving /api + Angular dist
├── firestore.rules             # Firestore security rules
├── firebase-blueprint.json     # Firestore collection schema blueprint
└── package.json                # Unified workspace scripts
```

---

## Core Modules

1. **Overview & 4-Stage Workflow Board**: Preliminary Bookings → Confirmed Bookings → In Progress → Completed & History, plus Overview Low-Stock Inventory Alerts and Recent Stock Movements.
2. **Service Planning Calendar**: Weekly and Daily bay schedule with color-coded status filters (`Draft`, `Planned`, `Confirmed`, `In Service`, `Completed`, `Waiting for Parts`, `Canceled`), quick-create slots, and full edit/cancel modal.
3. **6-Step Service Booking Wizard**: Customer & Vehicle lookup, Bay & Time Slot selection, Activity Scope, Service Checklist, Material Estimation & Spare-Parts Shortage Alerts (with quick restock/PO preview), and Summary Confirmation.
4. **Inventory, Suppliers & Stock Movements Audit Trail**: Full CRUD for spare parts (`Add`, `Edit`, `Adjust +/- Stock`, `View Audit Ledger`, `Deactivate/Activate`), supplier directory, and global immutable stock movements ledger.
5. **Mechanic Job Materials & Consumption Modal**: Live actual vs. estimated spare parts quantities, additional parts issuance, labour charges, additional services, and discounts.
6. **Tax Invoices & PDF Export**: Automatic invoice generation with SGST/CGST calculation, payment status/method tracking, printable invoice view, and client-side `jsPDF` download.
7. **Garage Settings & Reusable Service Templates**: Garage profile, GSTIN, invoice numbering prefixes, and reusable parts+labour service templates.

---

## Local Development

Install dependencies:

```bash
npm install
```

Start the Express API + serve the Angular production bundle on port `3000`:

```bash
npm run dev
```

Or run Angular CLI dev server on port `4200` with `/api` proxied to Express on port `3000`:

```bash
# Terminal 1 (Backend API)
npm run start

# Terminal 2 (Angular Dev Server)
cd frontend && npx ng serve --proxy-config proxy.conf.json
```

---

## REST API Endpoints (`/api`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/bootstrap` | Initial fleet, bookings, inventory, suppliers, templates, invoices & garage config |
| `PATCH` | `/api/garage-config` | Update garage profile, tax & invoice configuration |
| `POST` | `/api/vehicles` | Register a commercial vehicle |
| `POST` | `/api/vehicles/:id/unplanned-activities` | Log unplanned service activity on a vehicle |
| `POST` | `/api/vehicles/:id/unplanned-repairs` | Log breakdown/unplanned repair item on a vehicle |
| `POST` | `/api/bookings` | Create 6-step service booking |
| `PATCH` | `/api/bookings/:id` | Update booking schedule, scope, or status |
| `DELETE` | `/api/bookings/:id` | Cancel booking |
| `POST` | `/api/bookings/:id/approve` | Approve preliminary booking → Confirmed |
| `POST` | `/api/bookings/:id/reject` | Reject preliminary booking |
| `POST` | `/api/bookings/:id/start` | Start confirmed job → In Progress (reserves/deducts stock) |
| `POST` | `/api/bookings/:id/complete` | Complete job & reconcile parts stock |
| `PATCH` | `/api/bookings/:id/actual-materials/:lineId` | Update mechanic actual material quantity |
| `POST` | `/api/bookings/:id/additional-materials` | Issue additional part to repair job |
| `PATCH` | `/api/bookings/:id/additional-materials/:lineId` | Update additional part line |
| `DELETE` | `/api/bookings/:id/additional-materials/:lineId` | Remove additional part line |
| `PATCH` | `/api/bookings/:id/charges` | Update customer snapshot, work performed, labour & discounts |
| `POST` | `/api/inventory` | Create spare part item |
| `PATCH` | `/api/inventory/:id` | Edit spare part item |
| `POST` | `/api/inventory/:id/toggle-active` | Activate / deactivate part |
| `POST` | `/api/inventory/:id/adjust-stock` | Record `IN`, `OUT`, or `ADJUST` stock movement |
| `POST` | `/api/suppliers` | Add supplier |
| `PATCH` | `/api/suppliers/:id` | Update supplier |
| `POST` | `/api/service-templates` | Create reusable service template |
| `POST` | `/api/bookings/:id/invoice` | Generate GST tax invoice for job |
| `PATCH` | `/api/invoices/:id/payment` | Update payment status, method, and charges |
| `POST` | `/api/invoices/:id/cancel` | Cancel active invoice |
| `POST` | `/api/notifications/:id/dismiss` | Dismiss single alert notification |
| `POST` | `/api/notifications/dismiss-all` | Dismiss all alert notifications |
| `POST` | `/api/notifications/reset` | Restore alert notifications |

---

## Deployment

### 1. Frontend on Vercel (`/frontend`)
1. Import the GitHub repository in **Vercel**.
2. Set **Root Directory** to `frontend`.
3. **Framework Preset**: `Angular` (Build Command: `npm run build` / `ng build --configuration production`, Output Directory: `dist/fleet-app/browser`).
4. Point `frontend/src/environments/environment.prod.ts` `apiBaseUrl` (or `frontend/vercel.json` `/api/:path*` rewrite) to your hosted Node/Express backend URL.

### 2. Backend Hosting (`/backend` or root Express server)
1. Deploy the Express server (`server.ts` / `backend/`) on Render, Railway, Cloud Run, or Fly.io with `PORT` and `CORS_ORIGIN` configured from `.env.example`.
2. **PostgreSQL Setup (External Hosting)**: Run `backend/database/schema.sql` against your PostgreSQL database instance and set `DATABASE_URL`.
3. **Firestore Persistence**: Automatically connects via Firebase Admin / `firebase-applet-config.json` when running in a Firebase-configured environment.
