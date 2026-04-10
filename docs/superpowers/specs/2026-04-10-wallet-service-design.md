# Wallet service design spec

## What we're building

A wallet service for a fintech platform. Users can register, deposit money, transfer funds to each other, and view their balance and transaction history. The system needs to guarantee financial correctness: balances must stay consistent even when requests fail halfway through or multiple transfers hit the same wallet simultaneously.

This is a take-home assessment, not a production system. The goal is to demonstrate good engineering judgment, not to ship something polished.

## Architecture decisions and trade-offs

I thought through five key decisions before writing any code. Each one had multiple reasonable options, and I want to explain why I picked what I did.

### 1. Authentication: JWT vs API keys vs session cookies

**Options considered:**

- **JWT-based auth** (register + login endpoints, token in Authorization header). Stateless, well-understood, maps directly to how real fintech APIs work.
- **API key per user** (auto-generated on user creation, passed as a header). Simpler to implement but doesn't demonstrate understanding of auth flows.
- **Session cookies** (server-side sessions with a session store). Adds server-side state and a dependency on something like Redis.

**Decision: JWT.**

The role is at a fintech company. Auth is one of the things they'll look at closely, and JWT shows I understand stateless authentication, token expiry, and how to protect routes. An API key approach would work, but it skips the login/registration flow entirely, which feels like a missed opportunity to show security awareness. Session cookies would work too, but they introduce server-side state that doesn't add anything here.

### 2. Database access: Prisma vs Drizzle vs raw SQL

**Options considered:**

- **Prisma** — auto-generated, type-safe client. Great DX, but abstracts away the SQL. Hard to express `SELECT FOR UPDATE` or fine-grained transaction control without dropping down to raw queries anyway.
- **Drizzle** — lighter ORM with SQL-like syntax. Better control than Prisma but still an abstraction layer.
- **Raw SQL with `pg`** — full control, no magic. More boilerplate, but every query is visible and auditable.

**Decision: Raw SQL with `pg`.**

The core of this assessment is financial correctness and concurrency handling. Row-level locking, transaction isolation, and double-entry ledger inserts are all things I want explicit control over. With an ORM, I'd end up fighting the abstraction to express these patterns, and the evaluators wouldn't be able to see what's actually happening at the database level. Raw SQL makes the transactional guarantees visible in the code itself.

### 3. Ledger model: single-entry vs double-entry

**Options considered:**

- **Single-entry** — one record per operation with a type field (credit/debit). Balance is derived by summing credits minus debits. Simpler to implement, fewer rows.
- **Double-entry** — every operation creates two entries. A transfer produces a debit from the sender and a credit to the receiver, linked by a shared transaction ID. Balance is derived per-wallet. More rows, but structurally prevents inconsistency.

**Decision: Double-entry.**

This is how real accounting systems work. The structural constraint that every debit has a matching credit means the system can't silently lose or create money. If I sum all ledger entries across all wallets, the total should always be zero (ignoring deposits, which are credits from an implicit "system" account). Single-entry would work for this scope, but double-entry demonstrates domain knowledge and is a stronger answer to the "financial correctness" requirement.

### 4. Concurrency: pessimistic locking vs optimistic locking vs serializable isolation

**Options considered:**

- **`SELECT FOR UPDATE` (pessimistic locking)** — lock the wallet rows at the start of the transaction. Other transactions on the same wallet wait until the lock is released. Simple, deterministic.
- **Optimistic locking with a version column** — read a version number, do the work, check the version hasn't changed at write time. If it has, retry. Better throughput when contention is low, but requires retry logic and can still fail after doing work.
- **Serializable transaction isolation** — let Postgres detect conflicts automatically. Clean application code, but Postgres can abort transactions with serialization errors, which also need retry logic.

**Decision: `SELECT FOR UPDATE` (pessimistic).**

For a wallet service where the same account can receive multiple concurrent transfers, contention on hot wallets is expected, not exceptional. Pessimistic locking handles this directly: the second transaction waits instead of failing and retrying. There's a throughput trade-off under extreme contention, but for this scope it's the right call. Optimistic locking and serializable isolation both push complexity into retry logic that would need to be tested and reasoned about, and neither adds much for a system that expects contention.

One additional detail: when a transfer involves two wallets, I always lock them in ascending ID order. This prevents deadlocks. If user A transfers to user B while user B transfers to user A, both transactions lock the lower-ID wallet first.

### 5. Project structure: monorepo vs separate repos vs Next.js monolith

**Options considered:**

- **Monorepo with `backend/` and `frontend/` directories** — single repo, shared TypeScript types, easy for a reviewer to clone and run.
- **Separate repos** — more realistic microservice separation, but overkill for a take-home and harder to review.
- **Next.js monolith using API routes** — single project, fast to build, but hides backend architecture inside a frontend framework.

**Decision: Monorepo.**

The assessment is primarily evaluating backend architecture. A standalone Express API with clear routing, service layers, and raw SQL queries demonstrates that better than API routes buried in a Next.js app directory. But keeping everything in one repo means one `git clone`, one README, and shared types between front and back. The reviewer's experience matters.

---

## Project structure

```
lance-assessment/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Express app entry
│   │   ├── config/                # DB connection, env config
│   │   ├── middleware/            # Auth, validation, idempotency
│   │   ├── routes/                # users, auth, wallet
│   │   ├── services/              # Business logic layer
│   │   ├── db/
│   │   │   ├── migrations/        # SQL migration files
│   │   │   └── queries/           # Raw SQL query functions
│   │   └── types/                 # Shared TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js app router
│   │   ├── components/            # UI components
│   │   ├── lib/                   # API client, helpers
│   │   └── types/                 # Shared types
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml             # Postgres
└── README.md
```

## Database schema

### users

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, `gen_random_uuid()` |
| name | VARCHAR(255) | Not null |
| email | VARCHAR(255) | Unique, not null |
| password_hash | VARCHAR(255) | bcrypt |
| created_at | TIMESTAMPTZ | Default `now()` |

### wallets

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to users, unique (one wallet per user) |
| balance | NUMERIC(18,2) | Cached balance, updated atomically with ledger writes |
| created_at | TIMESTAMPTZ | Default `now()` |

### ledger_entries

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| transaction_id | UUID | Groups double-entry pairs |
| wallet_id | UUID | FK to wallets |
| entry_type | ENUM('CREDIT','DEBIT') | |
| amount | NUMERIC(18,2) | Always positive |
| balance_after | NUMERIC(18,2) | Snapshot of wallet balance after this entry |
| description | VARCHAR(255) | Human-readable context |
| created_at | TIMESTAMPTZ | Default `now()` |

### transactions

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| type | ENUM('DEPOSIT','TRANSFER') | |
| from_wallet_id | UUID | Null for deposits |
| to_wallet_id | UUID | FK to wallets |
| amount | NUMERIC(18,2) | |
| idempotency_key | VARCHAR(255) | Unique constraint, prevents duplicate submissions |
| status | ENUM('COMPLETED','FAILED') | |
| created_at | TIMESTAMPTZ | Default `now()` |

### Why the schema looks this way

- **`balance` on wallets is a cache.** The ledger is the source of truth. The cached balance exists for fast reads (no need to sum the entire ledger on every balance check) and gets updated inside the same transaction that writes ledger entries. If they ever drift, the ledger wins.
- **`balance_after` on ledger_entries** creates an audit trail. You can trace the exact balance at any point in history without replaying the entire ledger.
- **`NUMERIC(18,2)` everywhere.** Floating point arithmetic and money don't mix. `NUMERIC` gives exact decimal precision.
- **`idempotency_key` with a unique constraint** is the database-level backstop against duplicate submissions. Even if application-level checks fail, the constraint catches it.

## API design

### Auth endpoints (no token required)

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register user + create wallet, returns JWT |
| POST | /auth/login | Authenticate, returns JWT |

JWT payload: `{ userId, walletId, iat, exp }`. 24-hour expiry.

### Protected endpoints (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| POST | /wallet/deposit | Deposit into the authenticated user's wallet |
| POST | /wallet/transfer | Transfer from authenticated user to another |
| GET | /wallet/:userId/transactions | Transaction history |
| GET | /wallet/:userId/balance | Current balance |
| GET | /users | List all users (for the transfer UI) |

### Important: user identity comes from the token

For deposit and transfer, the `user_id` / `from_user_id` is extracted from the JWT, not from the request body. This prevents a user from depositing into or transferring from someone else's wallet. The deposit body only needs `amount`. The transfer body only needs `to_user_id` and `amount`.

### Idempotency

Deposit and transfer endpoints accept an `Idempotency-Key` header (UUID v4, generated client-side). If the same key is submitted twice, the server returns the original result without re-executing. The unique constraint on `idempotency_key` in the transactions table is the final safety net.

### Input validation

- `amount`: positive number, max 2 decimal places
- `email`: valid format
- `password`: minimum 8 characters
- Path param UUIDs: validated format

Using `zod` for schema validation.

### Error format

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Cannot transfer more than available balance"
  }
}
```

Error codes: `INSUFFICIENT_BALANCE`, `USER_NOT_FOUND`, `DUPLICATE_REQUEST`, `INVALID_INPUT`, `UNAUTHORIZED`.

## Transaction flows

### Deposit

```sql
BEGIN;
  SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE;
  INSERT INTO transactions (type, to_wallet_id, amount, idempotency_key, status)
    VALUES ('DEPOSIT', $wallet_id, $amount, $key, 'COMPLETED');
  INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_after)
    VALUES ($tx_id, $wallet_id, 'CREDIT', $amount, $new_balance);
  UPDATE wallets SET balance = balance + $amount WHERE id = $wallet_id;
COMMIT;
```

### Transfer

```sql
BEGIN;
  -- Lock both wallets in ID order to prevent deadlocks
  SELECT * FROM wallets WHERE id IN ($sender_id, $receiver_id) ORDER BY id FOR UPDATE;

  -- Check balance (if insufficient, ROLLBACK)

  INSERT INTO transactions (type, from_wallet_id, to_wallet_id, amount, idempotency_key, status)
    VALUES ('TRANSFER', $sender_id, $receiver_id, $amount, $key, 'COMPLETED');

  -- Double-entry: debit sender, credit receiver
  INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_after)
    VALUES ($tx_id, $sender_id, 'DEBIT', $amount, $sender_new_balance);
  INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_after)
    VALUES ($tx_id, $receiver_id, 'CREDIT', $amount, $receiver_new_balance);

  UPDATE wallets SET balance = balance - $amount WHERE id = $sender_id;
  UPDATE wallets SET balance = balance + $amount WHERE id = $receiver_id;
COMMIT;
```

### Concurrency guarantees

| Problem | How it's prevented |
|---------|--------------------|
| Race conditions | `SELECT FOR UPDATE` locks wallet rows. Concurrent transactions on the same wallet queue up. |
| Double spending | Balance check happens inside the lock. A second concurrent transfer sees the post-first-transfer balance. |
| Partial updates | Everything runs in a single Postgres transaction. Any failure rolls back all changes. |
| Deadlocks | Wallets locked in ascending ID order. Two concurrent transfers between the same pair always acquire locks in the same sequence. |
| Duplicate submissions | `idempotency_key` unique constraint. Duplicate inserts fail at the DB level. |

## Frontend

### Pages

| Route | Purpose |
|-------|---------|
| / | Redirect to login |
| /auth/login | Login form |
| /auth/register | Registration (this is "create wallet") |
| /dashboard | Balance, quick actions, recent transactions |
| /deposit | Deposit form |
| /transfer | Transfer form with user dropdown |
| /transactions | Full history |

### How it works

- Centralized API client in `lib/api.ts`. Typed fetch wrapper that attaches the JWT from localStorage on every request.
- Auth state managed via React context. Redirects to login when no token is present.
- Deposit and transfer forms generate a UUID idempotency key on mount. If the request fails and the user resubmits, the key stays the same, so the server catches the duplicate.
- Transaction history shows type, amount, counterparty, and timestamp. Credits in green, debits in red.
- User list for transfers fetched from `/users`, filtered to exclude the logged-in user.
- Minimal styling. The assessment says visual polish isn't evaluated.

## Scaling to 10 million transactions per day

This section will go in the README. Here's the reasoning I'll present:

10 million transactions per day is roughly 115 per second sustained, with likely spikes well above that. The current design (single Postgres instance, synchronous request handling) would start to struggle around this level. Here's what I'd change:

**Database.** Add read replicas for balance and history queries. Partition the `ledger_entries` table by month (or week) so queries over recent data don't scan the full history. Use PgBouncer for connection pooling. Add composite indexes on `(wallet_id, created_at)` for transaction history queries.

**Write throughput.** Put a message queue (SQS, RabbitMQ) between the API and the transaction processing logic. The API accepts the request, validates it, publishes to the queue, and returns a pending status. Worker processes consume messages and execute the transactional SQL. This decouples request acceptance from processing and gives you backpressure when the database is under load.

**Caching.** Redis for wallet balances. Invalidated inside the same transaction that updates the cached balance in Postgres (write-through). Most balance reads come from the dashboard, and this takes that load off the database entirely.

**Horizontal scaling.** The API servers are stateless (JWT auth, no sessions). Put them behind a load balancer and scale horizontally. Workers scale independently based on queue depth.

**Monitoring.** Structured logging with correlation IDs. Distributed tracing (OpenTelemetry) across API -> queue -> worker. Alerts on transaction failure rate, queue depth, p99 latency. A reconciliation job that periodically sums ledger entries per wallet and compares against the cached balance, alerting if they diverge.

## Technology stack

| Component | Choice |
|-----------|--------|
| Backend runtime | Node.js + TypeScript |
| Web framework | Express |
| Database | PostgreSQL |
| DB client | `pg` (node-postgres) |
| Auth | JWT (jsonwebtoken + bcrypt) |
| Validation | zod |
| Frontend | Next.js (React, App Router) |
| Containerization | Docker Compose (Postgres) |
