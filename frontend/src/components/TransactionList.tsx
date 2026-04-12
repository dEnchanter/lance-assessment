import { TransactionItem } from "@/types";

interface Props {
  transactions: TransactionItem[];
  currentUserId: string;
}

export default function TransactionList({ transactions, currentUserId }: Props) {
  if (transactions.length === 0) {
    return <p className="text-gray-500 py-4">No transactions yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left py-2 px-3 font-medium">Type</th>
          <th className="text-left py-2 px-3 font-medium">Amount</th>
          <th className="text-left py-2 px-3 font-medium">Counterparty</th>
          <th className="text-left py-2 px-3 font-medium">Date</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => {
          const isCredit =
            tx.type === "DEPOSIT" || tx.to_user.id === currentUserId;
          const counterparty =
            tx.type === "DEPOSIT"
              ? "Deposit"
              : isCredit
              ? `From ${tx.from_user?.name || "Unknown"}`
              : `To ${tx.to_user.name}`;

          return (
            <tr key={tx.id} className="border-b last:border-0">
              <td className="py-2 px-3">{tx.type}</td>
              <td className={`py-2 px-3 font-mono ${isCredit ? "text-green-600" : "text-red-600"}`}>
                {isCredit ? "+" : "-"}${tx.amount}
              </td>
              <td className="py-2 px-3">{counterparty}</td>
              <td className="py-2 px-3 text-gray-500">
                {new Date(tx.created_at).toLocaleString()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
