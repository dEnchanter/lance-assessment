import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import * as walletService from "../services/wallet.service";
import { pool } from "../config/database";
import { createTransactionQueries } from "../db/queries/transactions";
import { createWalletQueries } from "../db/queries/wallets";

const router = Router();
const transactionQueries = createTransactionQueries(pool);
const walletQueries = createWalletQueries(pool);

const depositSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
});

const transferSchema = z.object({
  to_user_id: z.string().uuid("Invalid user ID"),
  amount: z
    .number()
    .positive("Amount must be positive")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
});

// UUID format check
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Deposit
router.post("/deposit", authenticate, validate(depositSchema), async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const result = await walletService.deposit(
      req.user!.walletId,
      req.body.amount,
      idempotencyKey || null
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

// Transfer
router.post("/transfer", authenticate, validate(transferSchema), async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const result = await walletService.transfer(
      req.user!.walletId,
      req.body.to_user_id,
      req.body.amount,
      idempotencyKey || null
    );
    res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

// Balance
router.get("/:userId/balance", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    if (!UUID_REGEX.test(userId)) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Invalid user ID format" },
      });
      return;
    }

    // Users can only check their own balance
    if (userId !== req.user!.userId) {
      res.status(403).json({
        error: { code: "UNAUTHORIZED", message: "Cannot view another user's balance" },
      });
      return;
    }

    const balance = await walletQueries.getBalance(userId);
    if (balance === null) {
      res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "Wallet not found" },
      });
      return;
    }

    res.json({ user_id: userId, balance });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

// Transaction history
router.get("/:userId/transactions", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    if (!UUID_REGEX.test(userId)) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Invalid user ID format" },
      });
      return;
    }

    if (userId !== req.user!.userId) {
      res.status(403).json({
        error: { code: "UNAUTHORIZED", message: "Cannot view another user's transactions" },
      });
      return;
    }

    const transactions = await transactionQueries.getHistoryForUser(userId);

    const formatted = transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      from_user: t.from_user_id ? { id: t.from_user_id, name: t.from_user_name } : null,
      to_user: { id: t.to_user_id, name: t.to_user_name },
      status: t.status,
      created_at: t.created_at,
    }));

    res.json({ transactions: formatted });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

export default router;
