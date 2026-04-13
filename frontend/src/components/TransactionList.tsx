import { TransactionItem } from "@/types";

interface Props {
  transactions: TransactionItem[];
  currentUserId: string;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{
        background: type === "DEPOSIT" ? "rgba(0,212,170,0.1)" : "rgba(255,255,255,0.05)",
        color: type === "DEPOSIT" ? "var(--accent)" : "var(--subtle)",
        border: `1px solid ${type === "DEPOSIT" ? "rgba(0,212,170,0.2)" : "var(--border)"}`,
      }}
    >
      {type}
    </span>
  );
}

export default function TransactionList({ transactions, currentUserId }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl"
          style={{ background: "var(--panel)" }}
        >
          ◎
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>No transactions yet</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Deposit funds or transfer to another user to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transactions.map((tx) => {
        const isCredit = tx.type === "DEPOSIT" || tx.to_user.id === currentUserId;
        const counterparty =
          tx.type === "DEPOSIT"
            ? "External deposit"
            : isCredit
            ? `From ${tx.from_user?.name || "Unknown"}`
            : `To ${tx.to_user.name}`;

        const date = new Date(tx.created_at);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

        return (
          <div
            key={tx.id}
            className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
            style={{ cursor: "default" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--panel)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            {/* Direction indicator */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-base font-medium"
              style={{
                background: isCredit ? "rgba(0,212,170,0.1)" : "rgba(255,94,125,0.1)",
                color: isCredit ? "var(--accent)" : "var(--danger)",
              }}
            >
              {isCredit ? "↓" : "↑"}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                  {counterparty}
                </span>
                <TypeBadge type={tx.type} />
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                {dateStr} · {timeStr}
              </div>
            </div>

            {/* Amount */}
            <div
              className="text-sm font-medium shrink-0"
              style={{
                color: isCredit ? "var(--accent)" : "var(--danger)",
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              {isCredit ? "+" : "-"}${tx.amount}
            </div>
          </div>
        );
      })}
    </div>
  );
}
