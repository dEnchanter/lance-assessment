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
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.wallet
        .getTransactions(user.id)
        .then((res) => setTransactions(res.transactions))
        .finally(() => setFetching(false));
    }
  }, [user]);

  if (loading || !user)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
      </div>
    );

  const deposits = transactions.filter((t) => t.type === "DEPOSIT").length;
  const transfers = transactions.filter((t) => t.type === "TRANSFER").length;
  const credits = transactions.filter((t) => t.type === "DEPOSIT" || t.to_user.id === user.id);
  const totalIn = credits.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="animate-fade-up flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}>
              Transaction history
            </h1>
            <p className="text-sm" style={{ color: "var(--subtle)" }}>
              {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>

        {/* Summary row */}
        {transactions.length > 0 && (
          <div className="animate-fade-up d1 grid grid-cols-3 gap-4 mb-8">
            <div className="card p-4">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Deposits</p>
              <p className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-syne)" }}>
                {deposits}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Transfers</p>
              <p className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-syne)" }}>
                {transfers}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Total in</p>
              <p className="text-xl font-semibold" style={{ color: "var(--accent)", fontFamily: "var(--font-jetbrains)" }}>
                ${totalIn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* List */}
        <div className="animate-fade-up d2">
          <div className="card overflow-hidden">
            {fetching ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="skeleton w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-32" />
                      <div className="skeleton h-2.5 w-20" />
                    </div>
                    <div className="skeleton h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-2 py-2">
                <TransactionList transactions={transactions} currentUserId={user.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
