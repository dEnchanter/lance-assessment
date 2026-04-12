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

  if (loading || !user) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;

  return (
    <>
      <Navbar />
      <div className="max-w-sm mx-auto p-6 mt-8">
        <h1 className="text-2xl font-bold mb-6">Transfer Funds</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Recipient</label>
            <select
              value={toUserId} onChange={(e) => setToUserId(e.target.value)}
              required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount ($)</label>
            <input
              type="number" step="0.01" min="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "Processing..." : "Transfer"}
          </button>
        </form>
      </div>
    </>
  );
}
