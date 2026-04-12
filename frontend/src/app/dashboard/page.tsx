"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import TransactionList from "@/components/TransactionList";
import { TransactionItem } from "@/types";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.wallet.getBalance(user.id).then((res) => setBalance(res.balance));
      api.wallet.getTransactions(user.id).then((res) => setTransactions(res.transactions.slice(0, 5)));
    }
  }, [user]);

  if (loading || !user) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <div className="text-3xl font-mono p-6 bg-white rounded-lg shadow mb-6">
          Balance: {balance !== null ? `$${balance}` : "Loading..."}
        </div>
        <div className="flex gap-3 mb-6">
          <button onClick={() => router.push("/deposit")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Deposit
          </button>
          <button onClick={() => router.push("/transfer")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Transfer
          </button>
        </div>
        <h2 className="text-lg font-semibold mb-2">Recent transactions</h2>
        <div className="bg-white rounded-lg shadow p-4">
          <TransactionList transactions={transactions} currentUserId={user.id} />
        </div>
      </div>
    </>
  );
}
