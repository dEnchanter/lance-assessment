# Wallet service

A wallet service built for the Full Stack Engineer take-home assessment. Users can register, deposit money, transfer funds to each other, and view their balance and transaction history. The system is designed around financial correctness — balances stay consistent even when things go wrong mid-request or when multiple transfers hit the same wallet at the same time.

## Architecture

The project is a monorepo with two separate applications:

```
lance-assessment/
├── backend/          # Express API (Node.js + TypeScript)
│   ├── src/
│   │   ├── server.ts
│   │   ├── config/       # DB connection, env vars
│   │   ├── middleware/   # JWT auth, zod validation
│   │   ├── routes/       # auth, wallet, users
│   │   ├── services/     # business logic (auth, deposit, transfer)
│   │   ├── db/
│   │   │   ├── migrations/   # SQL schema
│   │   │   └── queries/      # raw SQL query functions
│   │   ├── utils/        # decimal arithmetic
│   │   └── types/        # shared TypeScript interfaces
├── frontend/         # Next.js (React, App Router, Tailwind)
│   ├── src/
│   │   ├── app/          # pages (dashboard, deposit, transfer, etc.)
│   │   ├── components/   # Navbar, TransactionList
│   │   ├── lib/          # API client, auth context
│   │   └── types/
├── docker-compose.yml    # PostgreSQL
└── README.md
```

The backend runs on port 3001, the frontend on port 3000. The frontend proxies API requests through Next.js rewrites (`/api/*` -> `localhost:3001/*`), so the browser only talks to one origin.

### How the data model works

The system uses a double-entry ledger. Every financial operation creates paired entries: a transfer produces a DEBIT entry on the sender's wallet and a CREDIT entry on the receiver's, linked by a shared transaction ID. Deposits create a single CREDIT entry.

The `wallets` table has a `balance` column, but it's a cache. The ledger entries are the source of truth. The cached balance gets updated atomically inside the same database transaction that writes the ledger entries. If they ever drift apart, the ledger wins — you can always reconstruct the correct balance by summing ledger entries for a wallet.

I chose `NUMERIC(18,2)` for all monetary values. Floats and money don't mix.

## Design decisions

I went through five decisions before writing code. For each one, I thought through the options and picked based on what made sense for this specific context — a fintech take-home that's primarily evaluating backend architecture and financial correctness.

### Authentication: JWT

I considered JWT, API keys, and session cookies. JWT won because it's stateless (no Redis dependency), demonstrates understanding of token-based auth flows, and maps to how real fintech APIs work. API keys would have been simpler but would skip the login/registration flow, missing a chance to show security awareness. Session cookies introduce server-side state that doesn't add anything here.

### Database access: raw SQL with pg

I considered Prisma, Drizzle, and raw SQL. I went with raw SQL because the core of this assessment is financial correctness and concurrency handling. `SELECT FOR UPDATE`, transaction isolation, and double-entry inserts are all things I wanted explicit control over. With an ORM, I'd end up fighting the abstraction to express those patterns, and the evaluators wouldn't see what's actually happening at the database level.

### Ledger model: double-entry

I considered single-entry (one record per operation) and double-entry (paired debit/credit entries). Double-entry is how real accounting systems work. The structural constraint that every debit has a matching credit means the system can't silently lose or create money. If you sum all ledger entries across all wallets (excluding deposits from the implicit system account), the total should always be zero.

### Concurrency: pessimistic locking (SELECT FOR UPDATE)

I considered pessimistic locking, optimistic locking with a version column, and serializable transaction isolation. Pessimistic locking won because for a wallet service, contention on hot wallets is expected, not exceptional. The second concurrent transfer waits for the first to finish rather than failing and retrying. Optimistic locking and serializable isolation both push complexity into retry logic.

One important detail: when a transfer involves two wallets, I lock them in ascending ID order. This prevents deadlocks — if user A transfers to user B while user B transfers to user A, both transactions lock the lower-ID wallet first.

### Project structure: monorepo

I considered a monorepo, separate repos, and a Next.js monolith (using API routes). The monorepo keeps everything in one place for easy reviewing while letting the backend stand on its own as a proper Express API with clear separation of concerns. A Next.js monolith would hide the backend architecture inside a framework, and separate repos would be overkill for a take-home.

## Assumptions

- This is a take-home, not a production system. I've made trade-offs accordingly.
- No rate limiting, no email verification, no password reset.
- No HTTPS — assumes a reverse proxy handles TLS in production.
- Idempotency keys are optional on API requests. The server handles them if present but doesn't reject requests without one.
- Single PostgreSQL instance. The scaling section below discusses what changes at higher volumes.
- JWT secret is in an env file. In production, this would come from a secrets manager.

## Running locally

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — recommended, or a local Postgres 14+ instance (see below)

### Option A — Docker (recommended)

No Postgres installation needed. Docker handles everything.

### Steps

**1. Clone the repo**
```bash
git clone <repo-url>
cd lance-assessment
```

**2. Start the database**
```bash
docker compose up -d
```
This spins up a PostgreSQL 16 container on port **5555** (not 5432, to avoid conflicts with any local Postgres instance you might have).

**3. Configure and start the backend**

Open a terminal in the `backend/` directory:
```bash
cd backend
cp .env.example .env   # default values work out of the box with Docker
npm install
npm run migrate        # creates tables and enums
npm run dev            # starts Express on http://localhost:3001
```

**4. Start the frontend**

Open a second terminal in the `frontend/` directory:
```bash
cd frontend
npm install
npm run dev            # starts Next.js on http://localhost:3000
```

**5. Open http://localhost:3000**

---

### Option B — Local Postgres (no Docker)

If you already have Postgres installed and prefer not to use Docker:

**1. Create the database and user** (run as your Postgres superuser):
```sql
psql -U postgres
CREATE USER wallet_user WITH PASSWORD 'wallet_pass';
CREATE DATABASE wallet_db OWNER wallet_user;
\q
```

**2. Update `backend/.env`** to point at your local instance (default port is 5432):
```bash
DATABASE_URL=postgresql://wallet_user:wallet_pass@localhost:5432/wallet_db
JWT_SECRET=change-this-to-a-long-random-secret
PORT=3001
```

**3. Run the rest of the setup as normal** — skip `docker compose up -d` and follow steps 3–5 from Option A above.

> **Note:** If you hit a Postgres auth error (`password authentication failed`), your local Postgres may be using `peer` or `ident` auth. Edit `pg_hba.conf` to use `md5` for local connections, or create the user without a password and remove the password from the `DATABASE_URL`.

---

### Testing the flow manually

The easiest way to test transfers is to have two accounts:

1. Register a user at http://localhost:3000/auth/register — deposit some funds
2. Open an **incognito window**, register a second user
3. In the first window, go to Transfer and send funds to the second user
4. Check both dashboards and transaction histories to confirm

### Running the test suite

The integration tests use a real database (not mocks), so Postgres must be running — either via Docker or locally:

```bash
cd backend
npm test               # all 53 tests
npm run test:unit      # decimal arithmetic only (no DB needed)
npm run test:integration  # wallet service + API routes
```

### Ports at a glance

| Service    | URL                        |
|------------|----------------------------|
| Frontend   | http://localhost:3000      |
| Backend    | http://localhost:3001      |
| PostgreSQL | localhost:5555             |

## Scaling to 10 million transactions per day

10 million transactions per day works out to roughly 115 per second sustained (10,000,000 ÷ 86,400 seconds in a day ≈ 115.74 TPS). That's the average assuming uniform traffic — in practice, peak hours could push 3–5× higher (350–575 TPS) since transaction volume clusters around mornings and evenings. The current design — single Postgres instance, synchronous request handling — would start to struggle around that level. Here's what I'd change.

**Database.** Add read replicas for balance and transaction history queries. Partition the `ledger_entries` table by month so queries over recent data don't scan the full history. Put PgBouncer in front for connection pooling. Add composite indexes on `(wallet_id, created_at)` for the transaction history endpoint.

**Write throughput.** Put a message queue (SQS or RabbitMQ) between the API and the transaction processing logic. The API accepts the request, validates it, publishes to the queue, and returns a pending status. Worker processes consume messages and execute the transactional SQL. This decouples request acceptance from processing and lets the system handle backpressure when the database is under load.

**Caching.** Redis for wallet balances. Invalidated inside the same database transaction that updates the cached balance in Postgres (write-through pattern). Most balance reads come from the dashboard, and this takes that load off the database.

**Horizontal scaling.** The API servers are stateless — JWT auth means no server-side session state. Put them behind a load balancer and scale horizontally based on CPU/request volume. Workers scale independently based on queue depth.

**Monitoring.** Structured logging with correlation IDs so you can trace a request through the system. Distributed tracing with OpenTelemetry across API -> queue -> worker. Alerts on transaction failure rate, queue depth, and p99 latency. A reconciliation job that periodically sums ledger entries per wallet and compares against the cached balance, alerting if they diverge.

## API reference

### Auth (no token required)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | /auth/register | `{ name, email, password }` | Register + create wallet |
| POST | /auth/login | `{ email, password }` | Login, returns JWT |

### Wallet (Bearer token required)

| Method | Path | Body/Headers | Description |
|--------|------|-------------|-------------|
| POST | /wallet/deposit | `{ amount }` + optional `Idempotency-Key` header | Deposit funds |
| POST | /wallet/transfer | `{ to_user_id, amount }` + optional `Idempotency-Key` header | Transfer to another user |
| GET | /wallet/:userId/balance | — | Get current balance |
| GET | /wallet/:userId/transactions | — | Get transaction history |

### Users (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | /users | List all users |

## Tech stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + TypeScript, Express |
| Database | PostgreSQL |
| DB client | pg (node-postgres) — raw SQL |
| Auth | JWT (jsonwebtoken + bcrypt) |
| Validation | zod |
| Frontend | Next.js (React, App Router) |
| Styling | Tailwind CSS |
| Infrastructure | Docker Compose |
