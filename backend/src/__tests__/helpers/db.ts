import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

// Separate pool for tests — uses the same DB but cleans up between tests
let testPool: Pool;

export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://wallet_user:wallet_pass@localhost:5555/wallet_db",
    });
  }
  return testPool;
}

export async function setupTestDb(): Promise<void> {
  const pool = getTestPool();

  // Drop and recreate all tables for a clean state
  await pool.query(`
    DROP TABLE IF EXISTS ledger_entries CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS wallets CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TYPE IF EXISTS transaction_type CASCADE;
    DROP TYPE IF EXISTS transaction_status CASCADE;
    DROP TYPE IF EXISTS entry_type CASCADE;
  `);

  const sql = readFileSync(
    join(__dirname, "../../db/migrations/001_initial.sql"),
    "utf-8"
  );
  await pool.query(sql);
}

export async function teardownTestDb(): Promise<void> {
  const pool = getTestPool();
  await pool.end();
}

/**
 * Create a test user + wallet in a single transaction.
 * Returns { userId, walletId }
 */
export async function createTestUser(
  pool: Pool,
  name: string,
  email: string
): Promise<{ userId: string; walletId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, 'hashed_test_password')
       RETURNING id`,
      [name, email]
    );
    const userId = userResult.rows[0].id;

    const walletResult = await client.query(
      `INSERT INTO wallets (user_id, balance)
       VALUES ($1, 0.00)
       RETURNING id`,
      [userId]
    );
    const walletId = walletResult.rows[0].id;

    await client.query("COMMIT");
    return { userId, walletId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
