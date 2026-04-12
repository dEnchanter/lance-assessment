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
