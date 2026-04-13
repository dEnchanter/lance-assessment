import request from "supertest";
import express from "express";
import { getTestPool, setupTestDb, teardownTestDb } from "../helpers/db";

// Mock the database module before importing routes
jest.mock("../../config/database", () => ({
  get pool() {
    return getTestPool();
  },
}));

import authRoutes from "../../routes/auth";
import walletRoutes from "../../routes/wallet";
import userRoutes from "../../routes/users";

// Build a test Express app
function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/wallet", walletRoutes);
  app.use("/users", userRoutes);
  return app;
}

describe("API routes", () => {
  const app = createApp();
  const pool = getTestPool();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM ledger_entries");
    await pool.query("DELETE FROM transactions");
    await pool.query("DELETE FROM wallets");
    await pool.query("DELETE FROM users");
  });

  describe("POST /auth/register", () => {
    it("creates a user and returns a JWT", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ name: "Alice", email: "alice@test.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.name).toBe("Alice");
      expect(res.body.user.email).toBe("alice@test.com");
      expect(res.body.user.wallet_id).toBeDefined();
    });

    it("rejects duplicate email", async () => {
      await request(app)
        .post("/auth/register")
        .send({ name: "Alice", email: "alice@test.com", password: "password123" });

      const res = await request(app)
        .post("/auth/register")
        .send({ name: "Alice2", email: "alice@test.com", password: "password456" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    it("validates input — rejects short password", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ name: "Alice", email: "alice@test.com", password: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    it("validates input — rejects invalid email", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ name: "Alice", email: "not-an-email", password: "password123" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });
  });

  describe("POST /auth/login", () => {
    it("logs in with correct credentials", async () => {
      await request(app)
        .post("/auth/register")
        .send({ name: "Alice", email: "alice@test.com", password: "password123" });

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "alice@test.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it("rejects wrong password", async () => {
      await request(app)
        .post("/auth/register")
        .send({ name: "Alice", email: "alice@test.com", password: "password123" });

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "alice@test.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects non-existent email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@test.com", password: "password123" });

      expect(res.status).toBe(401);
    });
  });

  describe("Protected routes", () => {
    let aliceToken: string;
    let aliceUserId: string;
    let bobToken: string;
    let bobUserId: string;

    beforeEach(async () => {
      const aliceRes = await request(app)
        .post("/auth/register")
        .send({ name: "Alice", email: "alice@test.com", password: "password123" });
      aliceToken = aliceRes.body.token;
      aliceUserId = aliceRes.body.user.id;

      const bobRes = await request(app)
        .post("/auth/register")
        .send({ name: "Bob", email: "bob@test.com", password: "password123" });
      bobToken = bobRes.body.token;
      bobUserId = bobRes.body.user.id;
    });

    it("rejects requests without auth token", async () => {
      const res = await request(app).get(`/wallet/${aliceUserId}/balance`);
      expect(res.status).toBe(401);
    });

    describe("POST /wallet/deposit", () => {
      it("deposits funds", async () => {
        const res = await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: 500 });

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe("500.00");
      });

      it("rejects negative amount", async () => {
        const res = await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: -100 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_INPUT");
      });

      it("rejects zero amount", async () => {
        const res = await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: 0 });

        expect(res.status).toBe(400);
      });

      it("rejects amount with too many decimals", async () => {
        const res = await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: 10.123 });

        expect(res.status).toBe(400);
      });
    });

    describe("POST /wallet/transfer", () => {
      it("transfers funds", async () => {
        // Deposit first
        await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: 1000 });

        const res = await request(app)
          .post("/wallet/transfer")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ to_user_id: bobUserId, amount: 250 });

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe("750.00");
      });

      it("rejects transfer exceeding balance", async () => {
        await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: 100 });

        const res = await request(app)
          .post("/wallet/transfer")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ to_user_id: bobUserId, amount: 200 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INSUFFICIENT_BALANCE");
      });

      it("rejects transfer with invalid user ID format", async () => {
        const res = await request(app)
          .post("/wallet/transfer")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ to_user_id: "not-a-uuid", amount: 50 });

        expect(res.status).toBe(400);
      });
    });

    describe("GET /wallet/:userId/balance", () => {
      it("returns the balance", async () => {
        await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: 750 });

        const res = await request(app)
          .get(`/wallet/${aliceUserId}/balance`)
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe("750.00");
      });

      it("prevents viewing another user's balance", async () => {
        const res = await request(app)
          .get(`/wallet/${bobUserId}/balance`)
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(403);
      });

      it("rejects invalid UUID in path", async () => {
        const res = await request(app)
          .get("/wallet/not-a-uuid/balance")
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_INPUT");
      });
    });

    describe("GET /wallet/:userId/transactions", () => {
      it("returns transaction history", async () => {
        await request(app)
          .post("/wallet/deposit")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ amount: 1000 });

        await request(app)
          .post("/wallet/transfer")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({ to_user_id: bobUserId, amount: 200 });

        const res = await request(app)
          .get(`/wallet/${aliceUserId}/transactions`)
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(200);
        expect(res.body.transactions).toHaveLength(2);
        expect(res.body.transactions[0].type).toBe("TRANSFER"); // Most recent first
        expect(res.body.transactions[1].type).toBe("DEPOSIT");
      });

      it("prevents viewing another user's transactions", async () => {
        const res = await request(app)
          .get(`/wallet/${bobUserId}/transactions`)
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe("GET /users", () => {
      it("lists all users", async () => {
        const res = await request(app)
          .get("/users")
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(2);
        expect(res.body.users.map((u: any) => u.name).sort()).toEqual(["Alice", "Bob"]);
      });
    });
  });
});
