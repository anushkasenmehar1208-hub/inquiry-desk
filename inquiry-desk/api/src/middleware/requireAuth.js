import { pool } from "../db.js";
import { COOKIE_NAME, hashToken, readCookie } from "../lib/session.js";

export async function requireAuth(req, res, next) {
  try {
    const token = readCookie(req.headers.cookie, COOKIE_NAME);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email
       FROM sessions s
       JOIN staff_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)],
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }

    req.staff = result.rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}
