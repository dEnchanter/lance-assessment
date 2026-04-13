"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

function EyeOpen() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const stats = [
  { label: "Avg. transfer time", value: "<1s" },
  { label: "Uptime SLA", value: "99.9%" },
  { label: "Ledger accuracy", value: "100%" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #07090f 0%, #0b1525 60%, #0d1e38 100%)" }}
      >
        <div className="absolute inset-0 dot-grid" />
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,212,170,0.07) 0%, transparent 65%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,212,170,0.04) 0%, transparent 65%)" }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-black"
            style={{ background: "var(--accent)", fontFamily: "var(--font-syne)" }}
          >
            L
          </div>
          <span className="font-bold text-base tracking-wide" style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}>
            Lance
          </span>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h2
            className="text-[52px] font-bold leading-[1.1] mb-5"
            style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}
          >
            Move money<br />
            <span style={{ color: "var(--accent)" }}>without friction.</span>
          </h2>
          <p className="text-base leading-relaxed max-w-xs" style={{ color: "var(--subtle)" }}>
            Instant deposits, atomic transfers, and a double-entry ledger built for correctness at any scale.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{ fontFamily: "var(--font-syne)", color: "var(--accent)" }}
              >
                {s.value}
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: "var(--ink)" }}
      >
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-black"
              style={{ background: "var(--accent)", fontFamily: "var(--font-syne)" }}
            >
              L
            </div>
            <span className="font-bold text-base tracking-wide" style={{ fontFamily: "var(--font-syne)" }}>
              Lance
            </span>
          </div>

          <div className="animate-fade-up">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}
            >
              Welcome back
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--subtle)" }}>
              Sign in to your wallet
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="animate-fade-up d1">
                <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="field-input"
                />
              </div>

              {/* Password */}
              <div className="animate-fade-up d2">
                <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="field-input pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--muted)" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOpen /> : <EyeClosed />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="animate-fade-in rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                  style={{ background: "var(--danger-dim)", border: "1px solid rgba(255,94,125,0.25)", color: "var(--danger)" }}
                >
                  <span>⚠</span> {error}
                </div>
              )}

              {/* Submit */}
              <div className="animate-fade-up d3">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Signing in…" : "Sign in →"}
                </button>
              </div>
            </form>

            <p className="mt-7 text-sm text-center" style={{ color: "var(--subtle)" }}>
              No account?{" "}
              <Link href="/auth/register" className="font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
