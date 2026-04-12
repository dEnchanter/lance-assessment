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
