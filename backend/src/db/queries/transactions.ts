import { Pool, PoolClient } from "pg";
import { Transaction } from "../../types";

export function createTransactionQueries(pool: Pool) {
  return {
    async create(
      client: PoolClient,
      type: "DEPOSIT" | "TRANSFER",
      fromWalletId: string | null,
      toWalletId: string,
      amount: string,
      idempotencyKey: string | null,
      status: "COMPLETED" | "FAILED" = "COMPLETED"
    ): Promise<Transaction> {
      const result = await client.query(
        `INSERT INTO transactions (type, from_wallet_id, to_wallet_id, amount, idempotency_key, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [type, fromWalletId, toWalletId, amount, idempotencyKey, status]
      );
      return result.rows[0];
    },

    async findByIdempotencyKey(key: string): Promise<Transaction | null> {
      const result = await pool.query(
        "SELECT * FROM transactions WHERE idempotency_key = $1",
        [key]
      );
      return result.rows[0] || null;
    },

    async getHistoryForUser(userId: string): Promise<any[]> {
      const result = await pool.query(
        `SELECT
           t.id,
           t.type,
           t.amount,
           t.status,
           t.created_at,
           fw.user_id as from_user_id,
           fu.name as from_user_name,
           tw.user_id as to_user_id,
           tu.name as to_user_name
         FROM transactions t
         JOIN wallets tw ON t.to_wallet_id = tw.id
         JOIN users tu ON tw.user_id = tu.id
         LEFT JOIN wallets fw ON t.from_wallet_id = fw.id
         LEFT JOIN users fu ON fw.user_id = fu.id
         WHERE tw.user_id = $1 OR fw.user_id = $1
         ORDER BY t.created_at DESC`,
        [userId]
      );
      return result.rows;
    },
  };
}
