# Wallet Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack wallet service with double-entry ledger, JWT auth, and concurrency-safe transfers.

**Architecture:** Express backend with raw SQL (`pg`) against PostgreSQL, double-entry ledger as source of truth, `SELECT FOR UPDATE` for concurrency. Next.js frontend with App Router.

**Tech Stack:** Node.js, TypeScript, Express, PostgreSQL, pg, jsonwebtoken, bcrypt, zod, Next.js, Docker Compose

**Spec:** `docs/superpowers/specs/2026-04-10-wallet-service-design.md`

---

## File structure

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `src/server.ts` | Express app setup, middleware registration, route mounting, server start |
| `src/config/database.ts` | pg Pool creation, connection config from env |
| `src/config/env.ts` | Environment variable loading and validation |
| `src/db/migrations/001_initial.sql` | Full schema: users, wallets, ledger_entries, transactions tables, enums, indexes |
| `src/db/migrate.ts` | Migration runner script |
| `src/db/queries/users.ts` | SQL queries for user CRUD |
| `src/db/queries/wallets.ts` | SQL queries for wallet operations (balance, lock) |
| `src/db/queries/ledger.ts` | SQL queries for ledger entry inserts and reads |
| `src/db/queries/transactions.ts` | SQL queries for transaction inserts, history, idempotency checks |
| `src/middleware/auth.ts` | JWT verification middleware, extracts userId/walletId |
| `src/middleware/validate.ts` | Generic zod validation middleware factory |
| `src/routes/auth.ts` | POST /auth/register, POST /auth/login |
| `src/routes/wallet.ts` | POST /wallet/deposit, POST /wallet/transfer, GET /wallet/:userId/balance, GET /wallet/:userId/transactions |
| `src/routes/users.ts` | GET /users |
| `src/services/auth.service.ts` | Register logic (create user+wallet in tx), login logic (verify password, sign JWT) |
| `src/services/wallet.service.ts` | Deposit logic, transfer logic (with locking, double-entry, idempotency) |
| `src/utils/decimal.ts` | String-based decimal arithmetic for NUMERIC(18,2) values, avoids floating point |
| `src/types/index.ts` | Shared TypeScript interfaces (User, Wallet, Transaction, LedgerEntry, API request/response types) |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `.env.example` | Example environment variables |

### Frontend (`frontend/`)

| File | Responsibility |
|------|---------------|
| `src/app/layout.tsx` | Root layout with AuthProvider wrapper |
| `src/app/page.tsx` | Redirect to /dashboard or /auth/login |
| `src/app/auth/login/page.tsx` | Login form |
| `src/app/auth/register/page.tsx` | Registration form |
| `src/app/dashboard/page.tsx` | Balance display, recent transactions, quick action links |
| `src/app/deposit/page.tsx` | Deposit form |
| `src/app/transfer/page.tsx` | Transfer form with user selector |
| `src/app/transactions/page.tsx` | Full transaction history |
| `src/components/TransactionList.tsx` | Reusable transaction list (used by dashboard and transactions page) |
| `src/components/Navbar.tsx` | Navigation bar with logout |
| `src/lib/api.ts` | Typed fetch wrapper, JWT attachment, idempotency key generation |
| `src/lib/auth-context.tsx` | React context for auth state (token, user info, login/logout/register) |
| `src/types/index.ts` | Frontend type definitions mirroring backend |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `next.config.js` | Next.js config with API proxy rewrite |

### Root

| File | Responsibility |
|------|---------------|
| `docker-compose.yml` | PostgreSQL container |
| `README.md` | Architecture, decisions, setup instructions, scaling answer |
| `.gitignore` | node_modules, .env, dist, .next |

---

## Task 1: Project scaffolding and Docker

**Files:**
- Create: `docker-compose.yml`
- Create: `.gitignore`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `frontend/package.json`

- [ ] **Step 1: Create root `.gitignore`**

```gitignore
node_modules/
dist/
.next/
.env
*.log
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: wallet_user
      POSTGRES_PASSWORD: wallet_pass
      POSTGRES_DB: wallet_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 3: Initialize backend project**

Run:
```bash
cd backend
npm init -y
npm install express pg dotenv jsonwebtoken bcrypt zod uuid cors
npm install -D typescript @types/express @types/node @types/pg @types/jsonwebtoken @types/bcrypt @types/uuid @types/cors ts-node nodemon
npx tsc --init
```

- [ ] **Step 4: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Create `backend/.env.example`**

```env
DATABASE_URL=postgresql://wallet_user:wallet_pass@localhost:5432/wallet_db
JWT_SECRET=your-secret-key-change-in-production
PORT=3001
```

- [ ] **Step 6: Add scripts to `backend/package.json`**

Add to the `"scripts"` section:
```json
{
  "dev": "nodemon --exec ts-node src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "migrate": "ts-node src/db/migrate.ts"
}
```

- [ ] **Step 7: Initialize frontend project**

Run:
```bash
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
```

- [ ] **Step 8: Add API proxy to Next.js config**

Check which config file `create-next-app` generated (`next.config.ts` or `next.config.js`). Replace its contents with the appropriate version:

If `next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
};

export default nextConfig;
```

If `next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
```

- [ ] **Step 9: Start Docker and verify Postgres connects**

Run:
```bash
docker-compose up -d
docker-compose logs postgres
```
Expected: Postgres logs showing "database system is ready to accept connections"

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: scaffold backend and frontend projects with Docker Compose"
```

---

## Task 2: Database schema and migrations

**Files:**
- Create: `backend/src/config/env.ts`
- Create: `backend/src/config/database.ts`
- Create: `backend/src/db/migrations/001_initial.sql`
- Create: `backend/src/db/migrate.ts`

- [ ] **Step 1: Create `backend/src/config/env.ts`**

```typescript
import dotenv from "dotenv";
dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://wallet_user:wallet_pass@localhost:5432/wallet_db",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me",
  PORT: parseInt(process.env.PORT || "3001", 10),
};
```

- [ ] **Step 2: Create `backend/src/config/database.ts`**

```typescript
import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Create `backend/src/db/migrations/001_initial.sql`**

```sql
-- Enums
CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'TRANSFER');
CREATE TYPE transaction_status AS ENUM ('COMPLETED', 'FAILED');
CREATE TYPE entry_type AS ENUM ('CREDIT', 'DEBIT');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallets (one per user)
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID NOT NULL REFERENCES wallets(id),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  idempotency_key VARCHAR(255) UNIQUE,
  status transaction_status NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ledger entries (double-entry bookkeeping)
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  entry_type entry_type NOT NULL,
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(18, 2) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for transaction history queries
CREATE INDEX idx_ledger_wallet_created ON ledger_entries(wallet_id, created_at DESC);
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet_id, created_at DESC);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet_id, created_at DESC);
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

- [ ] **Step 4: Create `backend/src/db/migrate.ts`**

```typescript
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../config/database";

async function migrate() {
  const sql = readFileSync(
    join(__dirname, "migrations", "001_initial.sql"),
    "utf-8"
  );

  try {
    await pool.query(sql);
    console.log("Migration completed successfully");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
```

- [ ] **Step 5: Run the migration**

Run:
```bash
cd backend
cp .env.example .env
npm run migrate
```
Expected: "Migration completed successfully"

- [ ] **Step 6: Verify tables exist**

Run:
```bash
docker exec -it $(docker ps -qf "name=postgres") psql -U wallet_user -d wallet_db -c "\dt"
```
Expected: Lists `users`, `wallets`, `transactions`, `ledger_entries` tables.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add database schema with double-entry ledger tables and migration runner"
```

---

## Task 3: Shared types

**Files:**
- Create: `backend/src/types/index.ts`

- [ ] **Step 1: Create `backend/src/types/index.ts`**

```typescript
// Database row types
export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: string; // NUMERIC comes back as string from pg
  created_at: Date;
}

export interface Transaction {
  id: string;
  type: "DEPOSIT" | "TRANSFER";
  from_wallet_id: string | null;
  to_wallet_id: string;
  amount: string;
  idempotency_key: string | null;
  status: "COMPLETED" | "FAILED";
  created_at: Date;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  wallet_id: string;
  entry_type: "CREDIT" | "DEBIT";
  amount: string;
  balance_after: string;
  description: string | null;
  created_at: Date;
}

// API request types
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface DepositRequest {
  amount: number;
}

export interface TransferRequest {
  to_user_id: string;
  amount: number;
}

// API response types
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    wallet_id: string;
  };
}

export interface BalanceResponse {
  user_id: string;
  balance: string;
}

export interface TransactionResponse {
  id: string;
  type: "DEPOSIT" | "TRANSFER";
  amount: string;
  from_user?: { id: string; name: string } | null;
  to_user: { id: string; name: string };
  status: string;
  created_at: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// JWT payload
export interface JwtPayload {
  userId: string;
  walletId: string;
  iat?: number;
  exp?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add shared TypeScript type definitions"
```

---

## Task 4: Auth middleware and validation

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/middleware/validate.ts`

- [ ] **Step 1: Create `backend/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "../types";

// Extend Express Request to include auth info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" },
    });
    return;
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
  }
}
```

- [ ] **Step 2: Create `backend/src/middleware/validate.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: {
            code: "INVALID_INPUT",
            message: err.errors.map((e) => e.message).join(", "),
          },
        });
        return;
      }
      next(err);
    }
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add JWT auth middleware and zod validation middleware"
```

---

## Task 5: User and wallet database queries

**Files:**
- Create: `backend/src/db/queries/users.ts`
- Create: `backend/src/db/queries/wallets.ts`

- [ ] **Step 1: Create `backend/src/db/queries/users.ts`**

```typescript
import { Pool, PoolClient } from "pg";
import { User } from "../../types";

export function createUserQueries(pool: Pool) {
  return {
    async createUser(
      client: PoolClient,
      name: string,
      email: string,
      passwordHash: string
    ): Promise<User> {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, email, passwordHash]
      );
      return result.rows[0];
    },

    async findByEmail(email: string): Promise<User | null> {
      const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      return result.rows[0] || null;
    },

    async findById(id: string): Promise<User | null> {
      const result = await pool.query(
        "SELECT * FROM users WHERE id = $1",
        [id]
      );
      return result.rows[0] || null;
    },

    async listAll(): Promise<Pick<User, "id" | "name" | "email">[]> {
      const result = await pool.query(
        "SELECT id, name, email FROM users ORDER BY name"
      );
      return result.rows;
    },
  };
}
```

- [ ] **Step 2: Create `backend/src/db/queries/wallets.ts`**

```typescript
import { Pool, PoolClient } from "pg";
import { Wallet } from "../../types";

export function createWalletQueries(pool: Pool) {
  return {
    async createWallet(client: PoolClient, userId: string): Promise<Wallet> {
      const result = await client.query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, 0.00)
         RETURNING *`,
        [userId]
      );
      return result.rows[0];
    },

    async findById(walletId: string): Promise<Wallet | null> {
      const result = await pool.query(
        "SELECT * FROM wallets WHERE id = $1",
        [walletId]
      );
      return result.rows[0] || null;
    },

    async findByUserId(userId: string): Promise<Wallet | null> {
      const result = await pool.query(
        "SELECT * FROM wallets WHERE user_id = $1",
        [userId]
      );
      return result.rows[0] || null;
    },

    async lockWalletForUpdate(
      client: PoolClient,
      walletId: string
    ): Promise<Wallet> {
      const result = await client.query(
        "SELECT * FROM wallets WHERE id = $1 FOR UPDATE",
        [walletId]
      );
      return result.rows[0];
    },

    async lockWalletsForUpdate(
      client: PoolClient,
      walletIds: string[]
    ): Promise<Wallet[]> {
      // Sort by ID to prevent deadlocks
      const sorted = [...walletIds].sort();
      const result = await client.query(
        "SELECT * FROM wallets WHERE id = ANY($1) ORDER BY id FOR UPDATE",
        [sorted]
      );
      return result.rows;
    },

    async updateBalance(
      client: PoolClient,
      walletId: string,
      newBalance: string
    ): Promise<void> {
      await client.query(
        "UPDATE wallets SET balance = $1 WHERE id = $2",
        [newBalance, walletId]
      );
    },

    async getBalance(userId: string): Promise<string | null> {
      const result = await pool.query(
        "SELECT balance FROM wallets WHERE user_id = $1",
        [userId]
      );
      return result.rows[0]?.balance || null;
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add user and wallet SQL query modules"
```

---

## Task 6: Ledger and transaction database queries

**Files:**
- Create: `backend/src/db/queries/ledger.ts`
- Create: `backend/src/db/queries/transactions.ts`

- [ ] **Step 1: Create `backend/src/db/queries/ledger.ts`**

```typescript
import { PoolClient } from "pg";
import { LedgerEntry } from "../../types";

export function createLedgerQueries() {
  return {
    async createEntry(
      client: PoolClient,
      transactionId: string,
      walletId: string,
      entryType: "CREDIT" | "DEBIT",
      amount: string,
      balanceAfter: string,
      description: string
    ): Promise<LedgerEntry> {
      const result = await client.query(
        `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [transactionId, walletId, entryType, amount, balanceAfter, description]
      );
      return result.rows[0];
    },
  };
}
```

- [ ] **Step 2: Create `backend/src/db/queries/transactions.ts`**

```typescript
import { Pool, PoolClient } from "pg";
import { Transaction } from "../../types";

export function createTransactionQueries(pool: Pool) {
  return {
    async create(
      client: PoolClient,
      type: "DEPOSIT" | "TRANSFER",
      fromWalletId: string | null,
      toWalletId: string,
      amount: string,
      idempotencyKey: string | null,
      status: "COMPLETED" | "FAILED" = "COMPLETED"
    ): Promise<Transaction> {
      const result = await client.query(
        `INSERT INTO transactions (type, from_wallet_id, to_wallet_id, amount, idempotency_key, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [type, fromWalletId, toWalletId, amount, idempotencyKey, status]
      );
      return result.rows[0];
    },

    async findByIdempotencyKey(key: string): Promise<Transaction | null> {
      const result = await pool.query(
        "SELECT * FROM transactions WHERE idempotency_key = $1",
        [key]
      );
      return result.rows[0] || null;
    },

    async getHistoryForUser(userId: string): Promise<any[]> {
      const result = await pool.query(
        `SELECT
           t.id,
           t.type,
           t.amount,
           t.status,
           t.created_at,
           fw.user_id as from_user_id,
           fu.name as from_user_name,
           tw.user_id as to_user_id,
           tu.name as to_user_name
         FROM transactions t
         JOIN wallets tw ON t.to_wallet_id = tw.id
         JOIN users tu ON tw.user_id = tu.id
         LEFT JOIN wallets fw ON t.from_wallet_id = fw.id
         LEFT JOIN users fu ON fw.user_id = fu.id
         WHERE tw.user_id = $1 OR fw.user_id = $1
         ORDER BY t.created_at DESC`,
        [userId]
      );
      return result.rows;
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add ledger entry and transaction SQL query modules"
```

---

## Task 7: Auth service and routes

**Files:**
- Create: `backend/src/services/auth.service.ts`
- Create: `backend/src/routes/auth.ts`

- [ ] **Step 1: Create `backend/src/services/auth.service.ts`**

```typescript
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";
import { createUserQueries } from "../db/queries/users";
import { createWalletQueries } from "../db/queries/wallets";
import { env } from "../config/env";
import { AuthResponse } from "../types";

const userQueries = createUserQueries(pool);
const walletQueries = createWalletQueries(pool);

const SALT_ROUNDS = 10;

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const existing = await userQueries.findByEmail(email);
  if (existing) {
    throw { status: 400, code: "INVALID_INPUT", message: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user and wallet in a single transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await userQueries.createUser(client, name, email, passwordHash);
    const wallet = await walletQueries.createWallet(client, user.id);
    await client.query("COMMIT");

    const token = jwt.sign(
      { userId: user.id, walletId: wallet.id },
      env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, wallet_id: wallet.id },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const user = await userQueries.findByEmail(email);
  if (!user) {
    throw { status: 401, code: "UNAUTHORIZED", message: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw { status: 401, code: "UNAUTHORIZED", message: "Invalid email or password" };
  }

  const wallet = await walletQueries.findByUserId(user.id);
  if (!wallet) {
    throw { status: 500, code: "INTERNAL_ERROR", message: "Wallet not found for user" };
  }

  const token = jwt.sign(
    { userId: user.id, walletId: wallet.id },
    env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, wallet_id: wallet.id },
  };
}
```

- [ ] **Step 2: Create `backend/src/routes/auth.ts`**

```typescript
import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import * as authService from "../services/auth.service";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

router.post("/register", validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register(name, email, password);
    res.status(201).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

router.post("/login", validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

export default router;
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add auth service (register + login) with JWT token generation"
```

---

## Task 8: Wallet service (deposit + transfer with double-entry ledger)

**Files:**
- Create: `backend/src/services/wallet.service.ts`

- [ ] **Step 1: Create `backend/src/services/wallet.service.ts`**

```typescript
import { pool } from "../config/database";
import { createWalletQueries } from "../db/queries/wallets";
import { createTransactionQueries } from "../db/queries/transactions";
import { createLedgerQueries } from "../db/queries/ledger";
import Decimal from "../utils/decimal";

const walletQueries = createWalletQueries(pool);
const transactionQueries = createTransactionQueries(pool);
const ledgerQueries = createLedgerQueries();

export async function deposit(
  walletId: string,
  amount: number,
  idempotencyKey: string | null
): Promise<{ transaction_id: string; balance: string }> {
  // Check idempotency — if this key was already processed, return the original result
  if (idempotencyKey) {
    const existing = await transactionQueries.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      const wallet = await walletQueries.findById(existing.to_wallet_id);
      return { transaction_id: existing.id, balance: wallet?.balance || "0.00" };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock wallet
    const wallet = await walletQueries.lockWalletForUpdate(client, walletId);
    if (!wallet) {
      throw { status: 404, code: "USER_NOT_FOUND", message: "Wallet not found" };
    }

    const amountStr = amount.toFixed(2);
    const newBalance = Decimal.add(wallet.balance, amountStr);

    // Create transaction record
    const tx = await transactionQueries.create(
      client, "DEPOSIT", null, walletId, amountStr, idempotencyKey
    );

    // Create ledger entry (credit)
    await ledgerQueries.createEntry(
      client, tx.id, walletId, "CREDIT", amountStr, newBalance, "Deposit"
    );

    // Update cached balance
    await walletQueries.updateBalance(client, walletId, newBalance);

    await client.query("COMMIT");
    return { transaction_id: tx.id, balance: newBalance };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function transfer(
  fromWalletId: string,
  toUserId: string,
  amount: number,
  idempotencyKey: string | null
): Promise<{ transaction_id: string; balance: string }> {
  // Check idempotency
  if (idempotencyKey) {
    const existing = await transactionQueries.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      const wallet = await walletQueries.findById(fromWalletId);
      return { transaction_id: existing.id, balance: wallet?.balance || "0.00" };
    }
  }

  const toWallet = await walletQueries.findByUserId(toUserId);
  if (!toWallet) {
    throw { status: 404, code: "USER_NOT_FOUND", message: "Recipient not found" };
  }

  if (fromWalletId === toWallet.id) {
    throw { status: 400, code: "INVALID_INPUT", message: "Cannot transfer to yourself" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock both wallets in ID order to prevent deadlocks
    const wallets = await walletQueries.lockWalletsForUpdate(
      client, [fromWalletId, toWallet.id]
    );

    const sender = wallets.find((w) => w.id === fromWalletId);
    const receiver = wallets.find((w) => w.id === toWallet.id);

    if (!sender || !receiver) {
      throw { status: 404, code: "USER_NOT_FOUND", message: "Wallet not found" };
    }

    const amountStr = amount.toFixed(2);

    // Check sufficient balance
    if (Decimal.lessThan(sender.balance, amountStr)) {
      throw {
        status: 400,
        code: "INSUFFICIENT_BALANCE",
        message: "Cannot transfer more than available balance",
      };
    }

    const senderNewBalance = Decimal.subtract(sender.balance, amountStr);
    const receiverNewBalance = Decimal.add(receiver.balance, amountStr);

    // Create transaction
    const tx = await transactionQueries.create(
      client, "TRANSFER", fromWalletId, toWallet.id, amountStr, idempotencyKey
    );

    // Double-entry: debit sender
    await ledgerQueries.createEntry(
      client, tx.id, fromWalletId, "DEBIT", amountStr, senderNewBalance,
      "Transfer sent"
    );

    // Double-entry: credit receiver
    await ledgerQueries.createEntry(
      client, tx.id, toWallet.id, "CREDIT", amountStr, receiverNewBalance,
      "Transfer received"
    );

    // Update cached balances
    await walletQueries.updateBalance(client, fromWalletId, senderNewBalance);
    await walletQueries.updateBalance(client, toWallet.id, receiverNewBalance);

    await client.query("COMMIT");
    return { transaction_id: tx.id, balance: senderNewBalance };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: Create `backend/src/utils/decimal.ts`** (simple string-based decimal arithmetic)

```typescript
/**
 * Simple decimal arithmetic for NUMERIC(18,2) values.
 * Avoids floating point issues by working in cents (integers).
 */

function toCents(value: string): bigint {
  const negative = value.startsWith("-");
  const abs = negative ? value.slice(1) : value;
  const [whole, frac = "0"] = abs.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const cents = BigInt(whole) * 100n + BigInt(fracPadded);
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const sign = negative ? "-" : "";
  return `${sign}${whole}.${frac.toString().padStart(2, "0")}`;
}

export default {
  add(a: string, b: string): string {
    return fromCents(toCents(a) + toCents(b));
  },

  subtract(a: string, b: string): string {
    return fromCents(toCents(a) - toCents(b));
  },

  lessThan(a: string, b: string): boolean {
    return toCents(a) < toCents(b);
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add wallet service with atomic deposit and transfer using double-entry ledger"
```

---

## Task 9: Wallet and user routes

**Files:**
- Create: `backend/src/routes/wallet.ts`
- Create: `backend/src/routes/users.ts`

- [ ] **Step 1: Create `backend/src/routes/wallet.ts`**

```typescript
import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import * as walletService from "../services/wallet.service";
import { pool } from "../config/database";
import { createTransactionQueries } from "../db/queries/transactions";
import { createWalletQueries } from "../db/queries/wallets";

const router = Router();
const transactionQueries = createTransactionQueries(pool);
const walletQueries = createWalletQueries(pool);

const depositSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
});

const transferSchema = z.object({
  to_user_id: z.string().uuid("Invalid user ID"),
  amount: z
    .number()
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
});

// Deposit
router.post("/deposit", authenticate, validate(depositSchema), async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const result = await walletService.deposit(
      req.user!.walletId,
      req.body.amount,
      idempotencyKey || null
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

// Transfer
router.post("/transfer", authenticate, validate(transferSchema), async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const result = await walletService.transfer(
      req.user!.walletId,
      req.body.to_user_id,
      req.body.amount,
      idempotencyKey || null
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

// UUID format check
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Balance
router.get("/:userId/balance", authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!UUID_REGEX.test(userId)) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Invalid user ID format" },
      });
      return;
    }

    // Users can only check their own balance
    if (userId !== req.user!.userId) {
      res.status(403).json({
        error: { code: "UNAUTHORIZED", message: "Cannot view another user's balance" },
      });
      return;
    }

    const balance = await walletQueries.getBalance(userId);
    if (balance === null) {
      res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "Wallet not found" },
      });
      return;
    }

    res.json({ user_id: userId, balance });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

// Transaction history
router.get("/:userId/transactions", authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!UUID_REGEX.test(userId)) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Invalid user ID format" },
      });
      return;
    }

    if (userId !== req.user!.userId) {
      res.status(403).json({
        error: { code: "UNAUTHORIZED", message: "Cannot view another user's transactions" },
      });
      return;
    }

    const transactions = await transactionQueries.getHistoryForUser(userId);

    const formatted = transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      from_user: t.from_user_id ? { id: t.from_user_id, name: t.from_user_name } : null,
      to_user: { id: t.to_user_id, name: t.to_user_name },
      status: t.status,
      created_at: t.created_at,
    }));

    res.json({ transactions: formatted });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

export default router;
```

- [ ] **Step 2: Create `backend/src/routes/users.ts`**

```typescript
import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { pool } from "../config/database";
import { createUserQueries } from "../db/queries/users";

const router = Router();
const userQueries = createUserQueries(pool);

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const users = await userQueries.listAll();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

export default router;
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add wallet routes (deposit, transfer, balance, history) and users route"
```

---

## Task 10: Express server entry point

**Files:**
- Create: `backend/src/server.ts`

- [ ] **Step 1: Create `backend/src/server.ts`**

```typescript
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import userRoutes from "./routes/users";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/wallet", walletRoutes);
app.use("/users", userRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

export default app;
```

- [ ] **Step 2: Start the server and test health check**

Run:
```bash
cd backend
npm run dev
```
Then in another terminal:
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 3: Smoke test registration**

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```
Expected: 201 response with `token` and `user` object containing `wallet_id`.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add Express server entry point with route mounting"
```

---

## Task 11: Frontend - API client and auth context

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/auth-context.tsx`
- Create: `frontend/src/types/index.ts`

- [ ] **Step 1: Create `frontend/src/types/index.ts`**

```typescript
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  wallet_id: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface TransactionItem {
  id: string;
  type: "DEPOSIT" | "TRANSFER";
  amount: string;
  from_user: { id: string; name: string } | null;
  to_user: { id: string; name: string };
  status: string;
  created_at: string;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
}
```

- [ ] **Step 2: Create `frontend/src/lib/api.ts`**

```typescript
import { v4 as uuidv4 } from "uuid";

const BASE_URL = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  idempotencyKey?: string
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw data.error || { code: "UNKNOWN", message: "Something went wrong" };
  }

  return data as T;
}

// Generate a stable idempotency key — call once per form mount, pass to API calls
export function generateIdempotencyKey(): string {
  return uuidv4();
}

export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      request<any>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }),

    login: (email: string, password: string) =>
      request<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  },

  wallet: {
    deposit: (amount: number, idempotencyKey: string) =>
      request<any>("/wallet/deposit", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }, idempotencyKey),

    transfer: (toUserId: string, amount: number, idempotencyKey: string) =>
      request<any>("/wallet/transfer", {
        method: "POST",
        body: JSON.stringify({ to_user_id: toUserId, amount }),
      }, idempotencyKey),

    getBalance: (userId: string) =>
      request<any>(`/wallet/${userId}/balance`),

    getTransactions: (userId: string) =>
      request<any>(`/wallet/${userId}/transactions`),
  },

  users: {
    list: () => request<any>("/users"),
  },
};
```

- [ ] **Step 3: Install uuid in frontend**

Run:
```bash
cd frontend
npm install uuid
npm install -D @types/uuid
```

- [ ] **Step 4: Create `frontend/src/lib/auth-context.tsx`**

```tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { AuthUser } from "../types";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing token/user on mount
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const result = await api.auth.login(email, password);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    setUser(result.user);
    router.push("/dashboard");
  }

  async function register(name: string, email: string, password: string) {
    const result = await api.auth.register(name, email, password);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    setUser(result.user);
    router.push("/dashboard");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/auth/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add frontend API client, auth context, and shared types"
```

---

## Task 12: Frontend - Layout and auth pages

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/Navbar.tsx`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/auth/login/page.tsx`
- Create: `frontend/src/app/auth/register/page.tsx`

- [ ] **Step 1: Update `frontend/src/app/layout.tsx`** to wrap with AuthProvider

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Wallet Service",
  description: "Fintech wallet application",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/Navbar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav style={{ display: "flex", gap: "1rem", padding: "1rem", borderBottom: "1px solid #ddd", alignItems: "center" }}>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/deposit">Deposit</Link>
      <Link href="/transfer">Transfer</Link>
      <Link href="/transactions">Transactions</Link>
      <span style={{ marginLeft: "auto" }}>{user.name}</span>
      <button onClick={logout}>Logout</button>
    </nav>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/page.tsx`** (redirect)

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.push(user ? "/dashboard" : "/auth/login");
    }
  }, [user, loading, router]);

  return <div>Loading...</div>;
}
```

- [ ] **Step 4: Create `frontend/src/app/auth/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "0.5rem 1rem" }}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
      <p style={{ marginTop: "1rem" }}>
        No account? <Link href="/auth/register">Register</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/app/auth/register/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(name, email, password);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem" }}>
      <h1>Create Account</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label>Name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            required style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "0.5rem 1rem" }}>
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>
      <p style={{ marginTop: "1rem" }}>
        Have an account? <Link href="/auth/login">Login</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add frontend layout, navbar, and auth pages (login + register)"
```

---

## Task 13: Frontend - Dashboard, deposit, transfer, and transactions pages

**Files:**
- Create: `frontend/src/components/TransactionList.tsx`
- Create: `frontend/src/app/dashboard/page.tsx`
- Create: `frontend/src/app/deposit/page.tsx`
- Create: `frontend/src/app/transfer/page.tsx`
- Create: `frontend/src/app/transactions/page.tsx`

- [ ] **Step 1: Create `frontend/src/components/TransactionList.tsx`**

```tsx
import { TransactionItem } from "@/types";

interface Props {
  transactions: TransactionItem[];
  currentUserId: string;
}

export default function TransactionList({ transactions, currentUserId }: Props) {
  if (transactions.length === 0) {
    return <p>No transactions yet.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Type</th>
          <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Amount</th>
          <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Counterparty</th>
          <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Date</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => {
          const isCredit =
            tx.type === "DEPOSIT" || tx.to_user.id === currentUserId;
          const counterparty =
            tx.type === "DEPOSIT"
              ? "Deposit"
              : isCredit
              ? `From ${tx.from_user?.name || "Unknown"}`
              : `To ${tx.to_user.name}`;

          return (
            <tr key={tx.id}>
              <td style={{ padding: "0.5rem" }}>{tx.type}</td>
              <td style={{ padding: "0.5rem", color: isCredit ? "green" : "red" }}>
                {isCredit ? "+" : "-"}{tx.amount}
              </td>
              <td style={{ padding: "0.5rem" }}>{counterparty}</td>
              <td style={{ padding: "0.5rem" }}>
                {new Date(tx.created_at).toLocaleString()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/dashboard/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import TransactionList from "@/components/TransactionList";
import { TransactionItem } from "@/types";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.wallet.getBalance(user.id).then((res) => setBalance(res.balance));
      api.wallet.getTransactions(user.id).then((res) => setTransactions(res.transactions.slice(0, 5)));
    }
  }, [user]);

  if (loading || !user) return <div>Loading...</div>;

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1rem" }}>
        <h1>Dashboard</h1>
        <div style={{ fontSize: "2rem", margin: "1rem 0", padding: "1rem", background: "#f5f5f5", borderRadius: 8 }}>
          Balance: {balance !== null ? `$${balance}` : "Loading..."}
        </div>
        <div style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
          <button onClick={() => router.push("/deposit")} style={{ padding: "0.5rem 1rem" }}>
            Deposit
          </button>
          <button onClick={() => router.push("/transfer")} style={{ padding: "0.5rem 1rem" }}>
            Transfer
          </button>
        </div>
        <h2>Recent Transactions</h2>
        <TransactionList transactions={transactions} currentUserId={user.id} />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/deposit/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, generateIdempotencyKey } from "@/lib/api";
import Navbar from "@/components/Navbar";

export default function DepositPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const result = await api.wallet.deposit(parseFloat(amount), idempotencyKey);
      setSuccess(`Deposited $${parseFloat(amount).toFixed(2)}. New balance: $${result.balance}`);
      setAmount("");
      setIdempotencyKey(generateIdempotencyKey()); // Fresh key for next deposit
    } catch (err: any) {
      setError(err.message || "Deposit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return <div>Loading...</div>;

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 400, margin: "2rem auto", padding: "1rem" }}>
        <h1>Deposit Funds</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label>Amount ($)</label>
            <input
              type="number" step="0.01" min="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
          {success && <p style={{ color: "green" }}>{success}</p>}
          <button type="submit" disabled={submitting} style={{ padding: "0.5rem 1rem" }}>
            {submitting ? "Processing..." : "Deposit"}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create `frontend/src/app/transfer/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, generateIdempotencyKey } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { UserListItem } from "@/types";

export default function TransferPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.users.list().then((res) => {
        const others = res.users.filter((u: UserListItem) => u.id !== user.id);
        setUsers(others);
      });
    }
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const result = await api.wallet.transfer(toUserId, parseFloat(amount), idempotencyKey);
      const recipient = users.find((u) => u.id === toUserId);
      setSuccess(`Transferred $${parseFloat(amount).toFixed(2)} to ${recipient?.name}. Balance: $${result.balance}`);
      setAmount("");
      setIdempotencyKey(generateIdempotencyKey()); // Fresh key for next transfer
    } catch (err: any) {
      setError(err.message || "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return <div>Loading...</div>;

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 400, margin: "2rem auto", padding: "1rem" }}>
        <h1>Transfer Funds</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label>Recipient</label>
            <select
              value={toUserId} onChange={(e) => setToUserId(e.target.value)}
              required style={{ display: "block", width: "100%", padding: "0.5rem" }}
            >
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label>Amount ($)</label>
            <input
              type="number" step="0.01" min="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
          {success && <p style={{ color: "green" }}>{success}</p>}
          <button type="submit" disabled={submitting} style={{ padding: "0.5rem 1rem" }}>
            {submitting ? "Processing..." : "Transfer"}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Create `frontend/src/app/transactions/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import TransactionList from "@/components/TransactionList";
import { TransactionItem } from "@/types";

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.wallet.getTransactions(user.id).then((res) => setTransactions(res.transactions));
    }
  }, [user]);

  if (loading || !user) return <div>Loading...</div>;

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1rem" }}>
        <h1>Transaction History</h1>
        <TransactionList transactions={transactions} currentUserId={user.id} />
      </div>
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add dashboard, deposit, transfer, and transaction history pages"
```

---

## Task 14: README with architecture, decisions, and scaling answer

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

Use the humanizer skill to write this README. The content should include the sections below, written in a natural, first-person voice. Copy the architecture decisions and trade-offs from the design spec (`docs/superpowers/specs/2026-04-10-wallet-service-design.md`), adapting the tone for a README audience. The key sections:

1. **Project overview** — one paragraph: what this is, what it does
2. **Architecture** — project structure diagram (the tree from the spec), how backend and frontend connect (Express API on :3001, Next.js on :3000 with proxy rewrite), the double-entry ledger as source of truth
3. **Key design decisions** — all 5 decisions from the spec (auth, raw SQL, double-entry, pessimistic locking, monorepo), each with options considered and why I chose what I did
4. **Assumptions** — take-home scope (not production-ready), no rate limiting, no email verification, no password reset, single Postgres instance, no HTTPS, idempotency keys are optional (server doesn't enforce them on every request)
5. **How to run locally** — Prerequisites (Node.js 18+, Docker), then step-by-step:

```markdown
## Running locally

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### Steps

1. Clone the repo:
   ```bash
   git clone <repo-url>
   cd lance-assessment
   ```

2. Start Postgres:
   ```bash
   docker-compose up -d
   ```

3. Set up the backend:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run migrate
   npm run dev
   ```

4. Set up the frontend (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open http://localhost:3000 in your browser.
```

6. **Scaling to 10M transactions/day** — copy from the spec's scaling section, covering: database (read replicas, partitioning, PgBouncer, indexes), write throughput (message queue), caching (Redis for balances), horizontal scaling (stateless API behind LB), monitoring (structured logging, tracing, reconciliation jobs)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with architecture, design decisions, and scaling analysis"
```

---

## Task 15: Final integration test and cleanup

- [ ] **Step 1: Start everything and test the full flow**

```bash
# Terminal 1: Postgres
docker-compose up -d

# Terminal 2: Backend
cd backend
cp .env.example .env
npm run migrate
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

- [ ] **Step 2: Test full flow via UI**

1. Open `http://localhost:3000`
2. Register User A (e.g., "Alice", "alice@test.com")
3. Deposit $1000
4. Open incognito, register User B (e.g., "Bob", "bob@test.com")
5. Go back to Alice, transfer $250 to Bob
6. Check Alice's balance ($750) and transaction history
7. Check Bob's balance ($250) and transaction history

- [ ] **Step 3: Test via curl for concurrency**

```bash
# Register two users
TOKEN_A=$(curl -s -X POST http://localhost:3001/auth/register -H "Content-Type: application/json" -d '{"name":"Alice","email":"alice@test.com","password":"password123"}' | jq -r '.token')

TOKEN_B=$(curl -s -X POST http://localhost:3001/auth/register -H "Content-Type: application/json" -d '{"name":"Bob","email":"bob@test.com","password":"password123"}' | jq -r '.token')

# Deposit
curl -X POST http://localhost:3001/wallet/deposit -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d '{"amount": 1000}'

# Check balance
curl http://localhost:3001/wallet/{user_id}/balance -H "Authorization: Bearer $TOKEN_A"
```

- [ ] **Step 4: Clean up any TypeScript errors**

Run:
```bash
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```
Fix any type errors.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add .
git commit -m "fix: resolve TypeScript errors and integration issues"
```
