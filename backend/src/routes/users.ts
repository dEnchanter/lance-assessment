import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { pool } from "../config/database";
import { createUserQueries } from "../db/queries/users";

const router = Router();
const userQueries = createUserQueries(pool);

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const users = await userQueries.listAll();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

export default router;
