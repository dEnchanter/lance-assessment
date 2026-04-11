import { Pool, PoolClient } from "pg";
import { User } from "../../types";

export function createUserQueries(pool: Pool) {
  return {
    async createUser(
      client: PoolClient,
      name: string,
      email: string,
      passwordHash: string
    ): Promise<User> {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, email, passwordHash]
      );
      return result.rows[0];
    },

    async findByEmail(email: string): Promise<User | null> {
      const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      return result.rows[0] || null;
    },

    async findById(id: string): Promise<User | null> {
      const result = await pool.query(
        "SELECT * FROM users WHERE id = $1",
        [id]
      );
      return result.rows[0] || null;
    },

    async listAll(): Promise<Pick<User, "id" | "name" | "email">[]> {
      const result = await pool.query(
        "SELECT id, name, email FROM users ORDER BY name"
      );
      return result.rows;
    },
  };
}
