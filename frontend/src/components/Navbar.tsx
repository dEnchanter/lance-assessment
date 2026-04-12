"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="flex items-center gap-6 px-6 py-3 border-b border-gray-200 bg-white">
      <Link href="/dashboard" className="text-sm font-medium hover:text-blue-600">Dashboard</Link>
      <Link href="/deposit" className="text-sm font-medium hover:text-blue-600">Deposit</Link>
      <Link href="/transfer" className="text-sm font-medium hover:text-blue-600">Transfer</Link>
      <Link href="/transactions" className="text-sm font-medium hover:text-blue-600">Transactions</Link>
      <span className="ml-auto text-sm text-gray-600">{user.name}</span>
      <button onClick={logout} className="text-sm text-red-600 hover:text-red-800">Logout</button>
    </nav>
  );
}
