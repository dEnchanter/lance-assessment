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
