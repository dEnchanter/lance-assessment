import { PoolClient } from "pg";
import { LedgerEntry } from "../../types";

export function createLedgerQueries() {
  return {
    async createEntry(
      client: PoolClient,
      transactionId: string,
      walletId: string,
      entryType: "CREDIT" | "DEBIT",
      amount: string,
      balanceAfter: string,
      description: string
    ): Promise<LedgerEntry> {
      const result = await client.query(
        `INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [transactionId, walletId, entryType, amount, balanceAfter, description]
      );
      return result.rows[0];
    },
  };
}
