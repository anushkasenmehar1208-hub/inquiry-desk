import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db.js";
import { hashPassword } from "../src/lib/password.js";

if (process.env.NODE_ENV === "production") {
  console.error("Demo accounts cannot be seeded in production.");
  process.exit(1);
}

const demoPassword = "Welcome123!";
const staff = [
  { name: "Alex Morgan", email: "alex@example.test" },
  { name: "Sam Lee", email: "sam@example.test" },
];

try {
  const passwordHash = await hashPassword(demoPassword);
  for (const member of staff) {
    await pool.query(
      `INSERT INTO staff_users (id, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
      [randomUUID(), member.name, member.email, passwordHash],
    );
  }
  console.log("Local demo users are ready:");
  staff.forEach((member) => console.log(`  ${member.email}`));
  console.log(`  Password: ${demoPassword}`);
} finally {
  await pool.end();
}
