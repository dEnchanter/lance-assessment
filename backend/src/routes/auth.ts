import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import * as authService from "../services/auth.service";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

router.post("/register", validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register(name, email, password);
    res.status(201).json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

router.post("/login", validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: { code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong" },
    });
  }
});

export default router;
