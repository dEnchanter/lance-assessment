import { pool } from "../config/database";
import { createWalletQueries } from "../db/queries/wallets";
import { createTransactionQueries } from "../db/queries/transactions";
import { createLedgerQueries } from "../db/queries/ledger";
import Decimal from "../utils/decimal";

const walletQueries = createWalletQueries(pool);
const transactionQueries = createTransactionQueries(pool);
const ledgerQueries = createLedgerQueries();

export async function deposit(
  walletId: string,
  amount: number,
  idempotencyKey: string | null
): Promise<{ transaction_id: string; balance: string }> {
  // Check idempotency — if this key was already processed, return the original result
  if (idempotencyKey) {
    const existing = await transactionQueries.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      const wallet = await walletQueries.findById(existing.to_wallet_id);
      return { transaction_id: existing.id, balance: wallet?.balance || "0.00" };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock wallet
    const wallet = await walletQueries.lockWalletForUpdate(client, walletId);
    if (!wallet) {
      throw { status: 404, code: "USER_NOT_FOUND", message: "Wallet not found" };
    }

    const amountStr = amount.toFixed(2);
    const newBalance = Decimal.add(wallet.balance, amountStr);

    // Create transaction record
    const tx = await transactionQueries.create(
      client, "DEPOSIT", null, walletId, amountStr, idempotencyKey
    );

    // Create ledger entry (credit)
    await ledgerQueries.createEntry(
      client, tx.id, walletId, "CREDIT", amountStr, newBalance, "Deposit"
    );

    // Update cached balance
    await walletQueries.updateBalance(client, walletId, newBalance);

    await client.query("COMMIT");
    return { transaction_id: tx.id, balance: newBalance };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function transfer(
  fromWalletId: string,
  toUserId: string,
  amount: number,
  idempotencyKey: string | null
): Promise<{ transaction_id: string; balance: string }> {
  // Check idempotency
  if (idempotencyKey) {
    const existing = await transactionQueries.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      const wallet = await walletQueries.findById(fromWalletId);
      return { transaction_id: existing.id, balance: wallet?.balance || "0.00" };
    }
  }

  const toWallet = await walletQueries.findByUserId(toUserId);
  if (!toWallet) {
    throw { status: 404, code: "USER_NOT_FOUND", message: "Recipient not found" };
  }

  if (fromWalletId === toWallet.id) {
    throw { status: 400, code: "INVALID_INPUT", message: "Cannot transfer to yourself" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock both wallets in ID order to prevent deadlocks
    const wallets = await walletQueries.lockWalletsForUpdate(
      client, [fromWalletId, toWallet.id]
    );

    const sender = wallets.find((w) => w.id === fromWalletId);
    const receiver = wallets.find((w) => w.id === toWallet.id);

    if (!sender || !receiver) {
      throw { status: 404, code: "USER_NOT_FOUND", message: "Wallet not found" };
    }

    const amountStr = amount.toFixed(2);

    // Check sufficient balance
    if (Decimal.lessThan(sender.balance, amountStr)) {
      throw {
        status: 400,
        code: "INSUFFICIENT_BALANCE",
        message: "Cannot transfer more than available balance",
      };
    }

    const senderNewBalance = Decimal.subtract(sender.balance, amountStr);
    const receiverNewBalance = Decimal.add(receiver.balance, amountStr);

    // Create transaction
    const tx = await transactionQueries.create(
      client, "TRANSFER", fromWalletId, toWallet.id, amountStr, idempotencyKey
    );

    // Double-entry: debit sender
    await ledgerQueries.createEntry(
      client, tx.id, fromWalletId, "DEBIT", amountStr, senderNewBalance,
      "Transfer sent"
    );

    // Double-entry: credit receiver
    await ledgerQueries.createEntry(
      client, tx.id, toWallet.id, "CREDIT", amountStr, receiverNewBalance,
      "Transfer received"
    );

    // Update cached balances
    await walletQueries.updateBalance(client, fromWalletId, senderNewBalance);
    await walletQueries.updateBalance(client, toWallet.id, receiverNewBalance);

    await client.query("COMMIT");
    return { transaction_id: tx.id, balance: senderNewBalance };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
