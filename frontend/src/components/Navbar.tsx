"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/deposit",      label: "Deposit" },
  { href: "/transfer",     label: "Transfer" },
  { href: "/transactions", label: "Transactions" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: "rgba(7, 9, 15, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-5xl mx-auto flex items-center h-14 px-6 gap-2">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 mr-6 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-black"
            style={{ background: "var(--accent)", fontFamily: "var(--font-syne)" }}
          >
            L
          </div>
          <span
            className="font-bold text-sm tracking-wide hidden sm:block"
            style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}
          >
            Lance
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  color: active ? "var(--text)" : "var(--subtle)",
                  background: active ? "var(--panel)" : "transparent",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right: user + logout */}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
              style={{ background: "var(--accent)" }}
            >
              {initials}
            </div>
            <span className="text-sm hidden md:block truncate max-w-[120px]" style={{ color: "var(--subtle)" }}>
              {user.name ?? user.email}
            </span>
          </div>

          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ color: "var(--danger)", background: "var(--danger-dim)" }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
