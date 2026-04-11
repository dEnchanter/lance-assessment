import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../config/database";

async function migrate() {
  const sql = readFileSync(
    join(__dirname, "migrations", "001_initial.sql"),
    "utf-8"
  );

  try {
    await pool.query(sql);
    console.log("Migration completed successfully");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
