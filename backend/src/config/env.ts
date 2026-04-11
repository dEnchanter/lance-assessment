import dotenv from "dotenv";
dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://wallet_user:wallet_pass@localhost:5432/wallet_db",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me",
  PORT: parseInt(process.env.PORT || "3001", 10),
};
