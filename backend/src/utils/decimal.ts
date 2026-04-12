/**
 * Simple decimal arithmetic for NUMERIC(18,2) values.
 * Avoids floating point issues by working in cents (integers).
 */

function toCents(value: string): bigint {
  const negative = value.startsWith("-");
  const abs = negative ? value.slice(1) : value;
  const [whole, frac = "0"] = abs.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const cents = BigInt(whole) * 100n + BigInt(fracPadded);
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const sign = negative ? "-" : "";
  return `${sign}${whole}.${frac.toString().padStart(2, "0")}`;
}

export default {
  add(a: string, b: string): string {
    return fromCents(toCents(a) + toCents(b));
  },

  subtract(a: string, b: string): string {
    return fromCents(toCents(a) - toCents(b));
  },

  lessThan(a: string, b: string): boolean {
    return toCents(a) < toCents(b);
  },
};
