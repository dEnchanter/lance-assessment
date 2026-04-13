"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import TransactionList from "@/components/TransactionList";
import { TransactionItem } from "@/types";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-lg font-medium" style={{ color: "var(--text)", fontFamily: "var(--font-jetbrains)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.wallet.getBalance(user.id).then((res) => setBalance(res.balance));
      api.wallet.getTransactions(user.id).then((res) => setTransactions(res.transactions.slice(0, 5)));
    }
  }, [user]);

  if (loading || !user)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
      </div>
    );

  const depositCount = transactions.filter((t) => t.type === "DEPOSIT").length;
  const transferCount = transactions.filter((t) => t.type === "TRANSFER").length;

  const formattedBalance =
    balance !== null
      ? parseFloat(balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null;

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Greeting */}
        <div className="animate-fade-up mb-8">
          <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}>
            Hey, {user.name?.split(" ")[0] ?? user.email} 👋
          </h1>
        </div>

        {/* Balance hero card */}
        <div
          className="animate-fade-up d1 rounded-2xl p-8 mb-6 relative overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top left, rgba(0,212,170,0.07) 0%, transparent 55%)" }}
          />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>
              Available balance
            </p>
            {formattedBalance !== null ? (
              <div
                className="text-5xl font-medium mb-1 tracking-tight"
                style={{ fontFamily: "var(--font-jetbrains)", color: "var(--text)" }}
              >
                <span style={{ color: "var(--subtle)", fontSize: "0.6em", marginRight: "4px" }}>$</span>
                {formattedBalance}
              </div>
            ) : (
              <div className="skeleton h-12 w-48 mb-1" />
            )}
            <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
              {user.name}&apos;s wallet
            </p>
          </div>
        </div>

        {/* Stat row */}
        <div className="animate-fade-up d2 grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Deposits" value={String(depositCount)} sub="this view" />
          <StatCard label="Transfers" value={String(transferCount)} sub="this view" />
          <StatCard label="Total txns" value={String(transactions.length)} sub="recent" />
        </div>

        {/* Action cards */}
        <div className="animate-fade-up d3 grid grid-cols-2 gap-4 mb-8">
          <button onClick={() => router.push("/deposit")} className="action-card">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg"
              style={{ background: "rgba(0,212,170,0.1)", color: "var(--accent)" }}
            >
              ↓
            </div>
            <div className="font-semibold text-sm mb-1" style={{ color: "var(--text)" }}>Deposit</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>Add funds to your wallet</div>
          </button>

          <button onClick={() => router.push("/transfer")} className="action-card">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg"
              style={{ background: "rgba(100,150,255,0.1)", color: "#7c9dff" }}
            >
              →
            </div>
            <div className="font-semibold text-sm mb-1" style={{ color: "var(--text)" }}>Transfer</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>Send to another user</div>
          </button>
        </div>

        {/* Recent transactions */}
        <div className="animate-fade-up d4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--subtle)" }}>
              Recent transactions
            </h2>
            <button
              onClick={() => router.push("/transactions")}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              View all →
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="px-2 py-2">
              <TransactionList transactions={transactions} currentUserId={user.id} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
