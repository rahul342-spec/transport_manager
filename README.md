# Transport Business Management System (MVP)

A web app for a transport business owner to record daily work/trips, payments and expenses, and see monthly revenue, expenses and profit/loss. Multi-business (SaaS) from day one.

**Stack:** React + Vite + Tailwind + Recharts · Node.js + Express · MongoDB + Mongoose · JWT · PDFKit

## Run it locally

You need Node 18+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# 1. Install
npm run install:all

# 2. Configure the API
cp server/.env.example server/.env
#    edit server/.env: set MONGO_URI and a long random JWT_SECRET

# 3. (Optional) Load demo data: 3 clients, 3 vehicles, 3 drivers, ~6 months of trips & expenses
npm run seed
#    login: demo@transport.test / demo12345

# 4. Start both (two terminals)
npm run dev:server   # http://localhost:5000
npm run dev:client   # http://localhost:5173
```

Or skip the seed and click **Create an account** to set up a fresh business.

## Folder structure

```
server/src
  index.js              app entry, route mounting
  middleware/auth.js    JWT check -> req.businessId (from the DB user, never the browser)
  models/               Business, User, Client, Vehicle, Driver, WorkEntry, Payment, Expense, Invoice
  routes/               auth, business, masters (clients/vehicles/drivers/expenses), work,
                        payments, invoices, dashboard, reports
  services/             tenant checks, payment sync, invoice PDF
  utils/                calc.js (spec §15 formulas), generic tenant-scoped CRUD, CSV
  seed.js               demo data
client/src
  pages/                Dashboard, Work, Payments, Expenses, Invoices, Reports,
                        Clients, Vehicles, Drivers, Settings, Login, Register
  components/           Layout (sidebar), MasterPage (generic list/add/edit), ui.jsx
  lib/                  api client, formatters, hooks
```

## API

All routes except `/api/auth/*` need `Authorization: Bearer <token>`.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | Creates a business + owner, returns token |
| POST | `/api/auth/login` | |
| GET | `/api/auth/me` | |
| POST | `/api/auth/change-password` | |
| GET / PUT | `/api/business` | Business profile, GST, invoice prefix, payment terms |
| CRUD | `/api/clients` | `?q=&active=`; plus `GET /summary`, `GET /:id/history` |
| CRUD | `/api/vehicles`, `/api/drivers` | Delete is blocked if used in work — deactivate instead |
| CRUD | `/api/expenses` | `?from&to&category&vehicleId`; `GET /categories` |
| CRUD | `/api/work` | `?from&to&clientId&vehicleId&driverId&status&invoiced=false&pendingOnly=true` |
| CRUD | `/api/payments` | `GET /pending` = reminders list |
| GET/POST/DELETE | `/api/invoices` | `GET /:id/pdf` streams the PDF |
| GET | `/api/dashboard` | `?month=YYYY-MM` or `?from&to` |
| GET | `/api/reports`, `/api/reports/:type` | `&format=csv` to download |

Report types: `daily-work`, `monthly-revenue`, `monthly-expense`, `profit-loss`, `client-revenue`, `pending`, `vehicle`, `driver`, `payments`.

## Design decisions worth knowing

**Tenant isolation (spec §17).** `requireAuth` loads the user from MongoDB and sets `req.businessId` from that record. Every query adds `businessId`; any referenced ID (client, vehicle, driver, work entry, invoice) is checked with `assertOwned()` before it's saved. A `businessId` sent from the browser is stripped and ignored. Query-string filters accept plain strings only, which blocks `?clientId[$ne]=` style injection.

**Payments are the single source of truth.** "Payment received" on the Add Daily Work form creates a real Payment record. A work entry's `received`, `pendingAmount` and `status` are recalculated from its payments every time one is added, edited or deleted (`services/payments.js`). So the Payments list, client balances, the dashboard and reports always agree.

**Status** follows spec §15 exactly and is calculated automatically, not typed in.

**GST.** Job amounts are treated as pre-GST. GST is added on the invoice. Payments are recorded against job amounts; the invoice's "received" is scaled to its GST-inclusive total, so a fully paid job shows as a fully paid invoice. GST is not counted as revenue.

**Advance payments.** A payment can be saved without linking a job (shown as "Advance"). It counts in "Received" but does not reduce any job's pending amount.

**Deleting.** Work on an invoice can't be deleted until the invoice is deleted. Deleting work deletes its payments. Clients, vehicles and drivers with work can only be deactivated.

## MVP acceptance checklist (spec §25)

- [x] Owner can log in securely (bcrypt, JWT, rate-limited auth)
- [x] Create clients, vehicles and drivers
- [x] Daily work entry with all agreed fields; hours auto-calculated (handles overnight shifts)
- [x] Received and pending calculated correctly
- [x] Diesel, salary and other expenses
- [x] Dashboard: monthly revenue, expenses, profit/loss, 6-month trend, expense breakdown
- [x] Pending client payments
- [x] PDF invoice
- [x] Payment reminders in the app (due dates, overdue flag, reminder status)
- [x] A second business can't see the first business's data

## Deploying (spec §24, phase 6)

1. Build the client: `npm run build` → serve `client/dist` from Nginx (or any static host). Set `VITE_API_URL` if the API is on a different domain.
2. Run the API with PM2: `pm2 start server/src/index.js --name transport-api`. Set `NODE_ENV=production`, `CLIENT_URL` to your site's URL.
3. Nginx reverse-proxy `/api` → `localhost:5000`; free SSL with Let's Encrypt (certbot).
4. MongoDB Atlas free/shared tier to start; turn on daily backups.

## Not included (spec §21 non-goals)

GPS tracking, ledger accounting, payroll, GST filing, fleet maintenance scheduling, driver app, WhatsApp/email automation, multi-user roles. The data model leaves room for each — for example, `User.role` exists but only `owner` is used.

rahulacer342@gmail.com
Rahul@1234