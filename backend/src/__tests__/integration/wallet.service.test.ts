import { Pool } from "pg";
import { getTestPool, setupTestDb, teardownTestDb, createTestUser } from "../helpers/db";

// We need to mock the pool used by the wallet service to use our test pool.
// The simplest way: override the config/database module before importing the service.
let pool: Pool;

// Override the database module to use our test pool
jest.mock("../../config/database", () => ({
  get pool() {
    return getTestPool();
  },
}));

// Now import the service (it will use our mocked pool)
import * as walletService from "../../services/wallet.service";

describe("Wallet service", () => {
  beforeAll(async () => {
    pool = getTestPool();
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  // Clean data between tests
  beforeEach(async () => {
    await pool.query("DELETE FROM ledger_entries");
    await pool.query("DELETE FROM transactions");
    await pool.query("DELETE FROM wallets");
    await pool.query("DELETE FROM users");
  });

  describe("deposit", () => {
    it("deposits funds and updates balance", async () => {
      const { walletId } = await createTestUser(pool, "Alice", "alice@test.com");

      const result = await walletService.deposit(walletId, 500, null);

      expect(result.balance).toBe("500.00");
      expect(result.transaction_id).toBeDefined();

      // Verify balance in DB
      const walletRow = await pool.query("SELECT balance FROM wallets WHERE id = $1", [walletId]);
      expect(walletRow.rows[0].balance).toBe("500.00");
    });

    it("creates a CREDIT ledger entry on deposit", async () => {
      const { walletId } = await createTestUser(pool, "Alice", "alice@test.com");

      await walletService.deposit(walletId, 200, null);

      const entries = await pool.query(
        "SELECT * FROM ledger_entries WHERE wallet_id = $1",
        [walletId]
      );
      expect(entries.rows).toHaveLength(1);
      expect(entries.rows[0].entry_type).toBe("CREDIT");
      expect(entries.rows[0].amount).toBe("200.00");
      expect(entries.rows[0].balance_after).toBe("200.00");
    });

    it("accumulates multiple deposits correctly", async () => {
      const { walletId } = await createTestUser(pool, "Alice", "alice@test.com");

      await walletService.deposit(walletId, 100, null);
      await walletService.deposit(walletId, 250.50, null);
      const result = await walletService.deposit(walletId, 49.50, null);

      expect(result.balance).toBe("400.00");
    });

    it("handles idempotent deposit — same key returns same result without double-depositing", async () => {
      const { walletId } = await createTestUser(pool, "Alice", "alice@test.com");
      const key = "idem-deposit-001";

      const first = await walletService.deposit(walletId, 500, key);
      const second = await walletService.deposit(walletId, 500, key);

      // Same transaction ID returned
      expect(second.transaction_id).toBe(first.transaction_id);

      // Balance should be 500, not 1000
      const walletRow = await pool.query("SELECT balance FROM wallets WHERE id = $1", [walletId]);
      expect(walletRow.rows[0].balance).toBe("500.00");
    });
  });

  describe("transfer", () => {
    it("transfers funds between two users", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      // Deposit into Alice's wallet first
      await walletService.deposit(alice.walletId, 1000, null);

      // Transfer from Alice to Bob
      const result = await walletService.transfer(alice.walletId, bob.userId, 250, null);

      expect(result.balance).toBe("750.00");

      // Verify Bob's balance
      const bobWallet = await pool.query("SELECT balance FROM wallets WHERE id = $1", [bob.walletId]);
      expect(bobWallet.rows[0].balance).toBe("250.00");
    });

    it("creates double-entry ledger records — debit sender, credit receiver", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      await walletService.deposit(alice.walletId, 1000, null);
      const result = await walletService.transfer(alice.walletId, bob.userId, 300, null);

      // Get ledger entries for this transfer transaction
      const entries = await pool.query(
        "SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY entry_type",
        [result.transaction_id]
      );

      expect(entries.rows).toHaveLength(2);

      // CREDIT entry for receiver
      const credit = entries.rows.find((e: any) => e.entry_type === "CREDIT");
      expect(credit.wallet_id).toBe(bob.walletId);
      expect(credit.amount).toBe("300.00");

      // DEBIT entry for sender
      const debit = entries.rows.find((e: any) => e.entry_type === "DEBIT");
      expect(debit.wallet_id).toBe(alice.walletId);
      expect(debit.amount).toBe("300.00");
    });

    it("rejects transfer when balance is insufficient", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      await walletService.deposit(alice.walletId, 100, null);

      await expect(
        walletService.transfer(alice.walletId, bob.userId, 200, null)
      ).rejects.toMatchObject({
        code: "INSUFFICIENT_BALANCE",
      });

      // Verify no money was moved
      const aliceWallet = await pool.query("SELECT balance FROM wallets WHERE id = $1", [alice.walletId]);
      expect(aliceWallet.rows[0].balance).toBe("100.00");

      const bobWallet = await pool.query("SELECT balance FROM wallets WHERE id = $1", [bob.walletId]);
      expect(bobWallet.rows[0].balance).toBe("0.00");
    });

    it("rejects transfer to self", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      await walletService.deposit(alice.walletId, 1000, null);

      await expect(
        walletService.transfer(alice.walletId, alice.userId, 100, null)
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
        message: "Cannot transfer to yourself",
      });
    });

    it("rejects transfer to non-existent user", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      await walletService.deposit(alice.walletId, 1000, null);

      await expect(
        walletService.transfer(alice.walletId, "00000000-0000-0000-0000-000000000000", 100, null)
      ).rejects.toMatchObject({
        code: "USER_NOT_FOUND",
      });
    });

    it("handles idempotent transfer — same key does not double-transfer", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      await walletService.deposit(alice.walletId, 1000, null);

      const key = "idem-transfer-001";
      const first = await walletService.transfer(alice.walletId, bob.userId, 300, key);
      const second = await walletService.transfer(alice.walletId, bob.userId, 300, key);

      expect(second.transaction_id).toBe(first.transaction_id);

      // Alice should have 700, not 400
      const aliceWallet = await pool.query("SELECT balance FROM wallets WHERE id = $1", [alice.walletId]);
      expect(aliceWallet.rows[0].balance).toBe("700.00");
    });
  });

  describe("ledger integrity", () => {
    it("ledger entries sum to the cached balance for each wallet", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      await walletService.deposit(alice.walletId, 1000, null);
      await walletService.transfer(alice.walletId, bob.userId, 250, null);
      await walletService.transfer(alice.walletId, bob.userId, 100, null);
      await walletService.deposit(bob.walletId, 500, null);

      // For each wallet, sum credits - debits should equal the cached balance
      for (const walletId of [alice.walletId, bob.walletId]) {
        const ledgerSum = await pool.query(
          `SELECT
             COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS derived_balance
           FROM ledger_entries WHERE wallet_id = $1`,
          [walletId]
        );

        const cachedBalance = await pool.query(
          "SELECT balance FROM wallets WHERE id = $1",
          [walletId]
        );

        expect(ledgerSum.rows[0].derived_balance).toBe(cachedBalance.rows[0].balance);
      }
    });

    it("every transfer has exactly two ledger entries that balance to zero", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      await walletService.deposit(alice.walletId, 1000, null);
      await walletService.transfer(alice.walletId, bob.userId, 400, null);

      // Get transfer transactions (not deposits)
      const transfers = await pool.query(
        "SELECT id FROM transactions WHERE type = 'TRANSFER'"
      );

      for (const tx of transfers.rows) {
        const entries = await pool.query(
          `SELECT entry_type, amount FROM ledger_entries WHERE transaction_id = $1`,
          [tx.id]
        );

        expect(entries.rows).toHaveLength(2);

        const credit = entries.rows.find((e: any) => e.entry_type === "CREDIT");
        const debit = entries.rows.find((e: any) => e.entry_type === "DEBIT");

        expect(credit).toBeDefined();
        expect(debit).toBeDefined();
        expect(credit.amount).toBe(debit.amount); // Credits and debits balance
      }
    });

    it("balance_after on each ledger entry matches the running total", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      await walletService.deposit(alice.walletId, 1000, null);
      await walletService.transfer(alice.walletId, bob.userId, 200, null);
      await walletService.deposit(alice.walletId, 50, null);

      // Alice's ledger entries in order should have correct balance_after values
      const entries = await pool.query(
        `SELECT entry_type, amount, balance_after FROM ledger_entries
         WHERE wallet_id = $1 ORDER BY created_at ASC`,
        [alice.walletId]
      );

      // Deposit +1000 -> 1000, Transfer -200 -> 800, Deposit +50 -> 850
      expect(entries.rows[0].balance_after).toBe("1000.00");
      expect(entries.rows[1].balance_after).toBe("800.00");
      expect(entries.rows[2].balance_after).toBe("850.00");
    });
  });

  describe("concurrency", () => {
    it("prevents double-spending under concurrent transfers from the same wallet", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");
      const charlie = await createTestUser(pool, "Charlie", "charlie@test.com");

      await walletService.deposit(alice.walletId, 100, null);

      // Fire two transfers concurrently, each for 80. Only one should succeed.
      const results = await Promise.allSettled([
        walletService.transfer(alice.walletId, bob.userId, 80, null),
        walletService.transfer(alice.walletId, charlie.userId, 80, null),
      ]);

      const successes = results.filter((r) => r.status === "fulfilled");
      const failures = results.filter((r) => r.status === "rejected");

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      // Alice should have 20, not -60
      const aliceWallet = await pool.query("SELECT balance FROM wallets WHERE id = $1", [alice.walletId]);
      expect(aliceWallet.rows[0].balance).toBe("20.00");

      // Total money in system should be 100 (the original deposit)
      const totalBalance = await pool.query("SELECT SUM(balance) as total FROM wallets");
      expect(totalBalance.rows[0].total).toBe("100.00");
    });

    it("handles concurrent deposits to the same wallet correctly", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");

      // Fire 5 concurrent deposits of 100 each
      const promises = Array.from({ length: 5 }, (_, i) =>
        walletService.deposit(alice.walletId, 100, null)
      );

      await Promise.all(promises);

      // Balance should be exactly 500
      const walletRow = await pool.query("SELECT balance FROM wallets WHERE id = $1", [alice.walletId]);
      expect(walletRow.rows[0].balance).toBe("500.00");
    });

    it("concurrent cross-transfers between two users don't deadlock or lose money", async () => {
      const alice = await createTestUser(pool, "Alice", "alice@test.com");
      const bob = await createTestUser(pool, "Bob", "bob@test.com");

      await walletService.deposit(alice.walletId, 500, null);
      await walletService.deposit(bob.walletId, 500, null);

      // Alice -> Bob and Bob -> Alice concurrently
      const results = await Promise.allSettled([
        walletService.transfer(alice.walletId, bob.userId, 100, null),
        walletService.transfer(bob.walletId, alice.userId, 100, null),
      ]);

      // Both should succeed (no deadlock because we lock in ID order)
      const successes = results.filter((r) => r.status === "fulfilled");
      expect(successes).toHaveLength(2);

      // Total money should still be 1000
      const totalBalance = await pool.query("SELECT SUM(balance) as total FROM wallets");
      expect(totalBalance.rows[0].total).toBe("1000.00");
    });
  });
});
