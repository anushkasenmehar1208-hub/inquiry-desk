import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: webOrigin, credentials: true }));
app.use("/api/auth", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const origin = req.get("Origin");
  if (req.method === "POST" && origin !== undefined && origin !== webOrigin) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }
  return next();
});
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint not found." }));

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON." });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
