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

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-black"
        style={{ background: "var(--accent)" }}
      >
        ✓
      </div>
      <span className="text-sm" style={{ color: "var(--subtle)" }}>{text}</span>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
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
      await register(name, email, password);
    } catch (err: any) {
      setError(err.message || "Registration failed");
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
          className="absolute -bottom-32 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none"
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
            className="text-[48px] font-bold leading-[1.1] mb-6"
            style={{ fontFamily: "var(--font-syne)", color: "var(--text)" }}
          >
            Your wallet,<br />
            <span style={{ color: "var(--accent)" }}>ready in seconds.</span>
          </h2>
          <p className="text-base leading-relaxed max-w-sm mb-10" style={{ color: "var(--subtle)" }}>
            Create a free account and start moving money instantly — no fees, no delays, no paperwork.
          </p>
          <div className="space-y-4">
            <CheckItem text="Wallet created automatically on sign-up" />
            <CheckItem text="Atomic transfers with double-entry ledger" />
            <CheckItem text="Full transaction history, always auditable" />
          </div>
        </div>

        <div
          className="relative z-10 rounded-2xl p-5"
          style={{ background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.15)" }}
        >
          <p className="text-sm italic mb-2" style={{ color: "var(--text-dim)" }}>
            "Built on a ledger that never lies — every cent is accounted for."
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Lance core principle</p>
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
              Create account
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--subtle)" }}>
              Get your wallet up and running
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="animate-fade-up d1">
                <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="field-input"
                />
              </div>

              {/* Email */}
              <div className="animate-fade-up d2">
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
              <div className="animate-fade-up d3">
                <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
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
              <div className="animate-fade-up d4">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Creating account…" : "Create account →"}
                </button>
              </div>
            </form>

            <p className="mt-7 text-sm text-center" style={{ color: "var(--subtle)" }}>
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
