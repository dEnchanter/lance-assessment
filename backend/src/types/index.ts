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
