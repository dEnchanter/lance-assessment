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

  if (loading || !user) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;

  return (
    <>
      <Navbar />
      <div className="max-w-sm mx-auto p-6 mt-8">
        <h1 className="text-2xl font-bold mb-6">Deposit Funds</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
            {submitting ? "Processing..." : "Deposit"}
          </button>
        </form>
      </div>
    </>
  );
}
