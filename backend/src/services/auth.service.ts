import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";
import { createUserQueries } from "../db/queries/users";
import { createWalletQueries } from "../db/queries/wallets";
import { env } from "../config/env";
import { AuthResponse } from "../types";

const userQueries = createUserQueries(pool);
const walletQueries = createWalletQueries(pool);

const SALT_ROUNDS = 10;

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const existing = await userQueries.findByEmail(email);
  if (existing) {
    throw { status: 400, code: "INVALID_INPUT", message: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user and wallet in a single transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await userQueries.createUser(client, name, email, passwordHash);
    const wallet = await walletQueries.createWallet(client, user.id);
    await client.query("COMMIT");

    const token = jwt.sign(
      { userId: user.id, walletId: wallet.id },
      env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, wallet_id: wallet.id },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const user = await userQueries.findByEmail(email);
  if (!user) {
    throw { status: 401, code: "UNAUTHORIZED", message: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw { status: 401, code: "UNAUTHORIZED", message: "Invalid email or password" };
  }

  const wallet = await walletQueries.findByUserId(user.id);
  if (!wallet) {
    throw { status: 500, code: "INTERNAL_ERROR", message: "Wallet not found for user" };
  }

  const token = jwt.sign(
    { userId: user.id, walletId: wallet.id },
    env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, wallet_id: wallet.id },
  };
}
