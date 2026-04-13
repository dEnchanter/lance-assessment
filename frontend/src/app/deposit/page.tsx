"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, generateIdempotencyKey } from "@/lib/api";
import Navbar from "@/components/Navbar";

const quickAmounts = ["10", "50", "100", "500"];

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
      setSuccess(`$${parseFloat(amount).toFixed(2)} deposited. New balance: $${result.balance}`);
      setAmount("");
      setIdempotencyKey(generateIdempotencyKey());
    } catch (err: any) {
      setError(err.message || "Deposit failed");
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
            Deposit funds
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--subtle)" }}>
            Add money to your Lance wallet
          </p>

          {/* Amount card */}
          <div className="card p-6 mb-6">
            <label className="block text-xs font-medium mb-3 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Amount
            </label>

            {/* Currency input */}
            <div className="relative mb-4">
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

            {/* Quick amounts */}
            <div className="flex gap-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: amount === q ? "var(--accent-dim)" : "var(--panel)",
                    border: `1px solid ${amount === q ? "var(--accent)" : "var(--border)"}`,
                    color: amount === q ? "var(--accent)" : "var(--subtle)",
                  }}
                >
                  ${q}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {error && (
            <div
              className="animate-fade-in rounded-xl px-4 py-3 text-sm flex items-center gap-2 mb-4"
              style={{ background: "var(--danger-dim)", border: "1px solid rgba(255,94,125,0.25)", color: "var(--danger)" }}
            >
              <span>⚠</span> {error}
            </div>
          )}
          {success && (
            <div
              className="animate-fade-in rounded-xl px-4 py-3 text-sm flex items-center gap-2 mb-4"
              style={{ background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.25)", color: "var(--accent)" }}
            >
              <span>✓</span> {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <button type="submit" disabled={submitting || !amount} className="btn-primary">
              {submitting ? "Processing…" : "Deposit funds →"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
