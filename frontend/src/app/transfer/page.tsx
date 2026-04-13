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
        setUsers(res.users.filter((u: UserListItem) => u.id !== user.id));
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
      setSuccess(`$${parseFloat(amount).toFixed(2)} sent to ${recipient?.name}. Balance: $${result.balance}`);
      setAmount("");
      setToUserId("");
      setIdempotencyKey(generateIdempotencyKey());
    } catch (err: any) {
      setError(err.message || "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
      </div>
    );

  const selectedUser = users.find((u) => u.id === toUserId);

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-fade-up max-w-[440px]">
          {/* Back */}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 text-sm mb-8 transition-opacity hover:opacity-70"
            style={{ color: "var(--subtle)" }}
          >
            ← Dashboard
          </button>

          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}>
            Transfer funds
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--subtle)" }}>
            Send money to another Lance user
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Recipient */}
            <div className="animate-fade-up d1">
              <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Recipient
              </label>
              <div className="relative">
                <select
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  required
                  className="field-select"
                >
                  <option value="" disabled>Select a user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </option>
                  ))}
                </select>
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  ▾
                </span>
              </div>

              {/* Selected user preview */}
              {selectedUser && (
                <div
                  className="animate-fade-in mt-3 flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: "var(--accent-dim)", border: "1px solid rgba(0,212,170,0.15)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                    style={{ background: "var(--accent)" }}
                  >
                    {selectedUser.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{selectedUser.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{selectedUser.email}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="animate-fade-up d2">
              <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Amount
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium pointer-events-none"
                  style={{ color: "var(--subtle)" }}
                >
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="field-input text-lg"
                  style={{ fontFamily: "var(--font-jetbrains)", paddingLeft: "2rem" }}
                />
              </div>
            </div>

            {/* Feedback */}
            {error && (
              <div
                className="animate-fade-in rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                style={{ background: "var(--danger-dim)", border: "1px solid rgba(255,94,125,0.25)", color: "var(--danger)" }}
              >
                <span>⚠</span> {error}
              </div>
            )}
            {success && (
              <div
                className="animate-fade-in rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                style={{ background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.25)", color: "var(--accent)" }}
              >
                <span>✓</span> {success}
              </div>
            )}

            <div className="animate-fade-up d3">
              <button type="submit" disabled={submitting || !toUserId || !amount} className="btn-primary">
                {submitting ? "Processing…" : "Send funds →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
