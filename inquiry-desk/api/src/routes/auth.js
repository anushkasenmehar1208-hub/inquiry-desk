import { Router } from "express";
import { pool } from "../db.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { COOKIE_NAME, SESSION_MS, cookieOptions, hashToken, makeToken, readCookie } from "../lib/session.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

const unknownUserPasswordHash = await hashPassword("");

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" ||
        !email.trim() || !password || email.length > 254 || password.length > 1024) {
      return res.status(400).json({ error: "Enter your email and password." });
    }

    const result = await pool.query(
      "SELECT id, full_name, email, password_hash FROM staff_users WHERE email = $1",
      [email.trim().toLowerCase()],
    );
    const staff = result.rows[0];
    // Run scrypt for unknown addresses too.
    const passwordMatches = await verifyPassword(password, staff?.password_hash ?? unknownUserPasswordHash);
    if (!staff || !passwordMatches) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const token = makeToken();
    await pool.query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
      [hashToken(token), staff.id, new Date(Date.now() + SESSION_MS)],
    );
    res.cookie(COOKIE_NAME, token, cookieOptions());
    return res.json({ user: { id: staff.id, name: staff.full_name, email: staff.email } });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: {
    id: req.staff.id,
    name: req.staff.full_name,
    email: req.staff.email,
  } });
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = readCookie(req.headers.cookie);
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
    }
    res.clearCookie(COOKIE_NAME, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
