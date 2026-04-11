import { Pool, PoolClient } from "pg";
import { Wallet } from "../../types";

export function createWalletQueries(pool: Pool) {
  return {
    async createWallet(client: PoolClient, userId: string): Promise<Wallet> {
      const result = await client.query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, 0.00)
         RETURNING *`,
        [userId]
      );
      return result.rows[0];
    },

    async findById(walletId: string): Promise<Wallet | null> {
      const result = await pool.query(
        "SELECT * FROM wallets WHERE id = $1",
        [walletId]
      );
      return result.rows[0] || null;
    },

    async findByUserId(userId: string): Promise<Wallet | null> {
      const result = await pool.query(
        "SELECT * FROM wallets WHERE user_id = $1",
        [userId]
      );
      return result.rows[0] || null;
    },

    async lockWalletForUpdate(
      client: PoolClient,
      walletId: string
    ): Promise<Wallet> {
      const result = await client.query(
        "SELECT * FROM wallets WHERE id = $1 FOR UPDATE",
        [walletId]
      );
      return result.rows[0];
    },

    async lockWalletsForUpdate(
      client: PoolClient,
      walletIds: string[]
    ): Promise<Wallet[]> {
      // Sort by ID to prevent deadlocks
      const sorted = [...walletIds].sort();
      const result = await client.query(
        "SELECT * FROM wallets WHERE id = ANY($1) ORDER BY id FOR UPDATE",
        [sorted]
      );
      return result.rows;
    },

    async updateBalance(
      client: PoolClient,
      walletId: string,
      newBalance: string
    ): Promise<void> {
      await client.query(
        "UPDATE wallets SET balance = $1 WHERE id = $2",
        [newBalance, walletId]
      );
    },

    async getBalance(userId: string): Promise<string | null> {
      const result = await pool.query(
        "SELECT balance FROM wallets WHERE user_id = $1",
        [userId]
      );
      return result.rows[0]?.balance || null;
    },
  };
}
