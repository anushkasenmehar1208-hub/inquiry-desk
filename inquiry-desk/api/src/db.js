import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Copy api/.env.example to api/.env.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
