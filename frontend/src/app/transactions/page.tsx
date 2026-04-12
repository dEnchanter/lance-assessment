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

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.wallet.getTransactions(user.id).then((res) => setTransactions(res.transactions));
    }
  }, [user]);

  if (loading || !user) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Transaction History</h1>
        <div className="bg-white rounded-lg shadow p-4">
          <TransactionList transactions={transactions} currentUserId={user.id} />
        </div>
      </div>
    </>
  );
}
