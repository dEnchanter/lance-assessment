import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import userRoutes from "./routes/users";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/wallet", walletRoutes);
app.use("/users", userRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

export default app;
