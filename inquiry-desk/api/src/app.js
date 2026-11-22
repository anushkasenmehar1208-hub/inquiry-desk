import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";

export const app = express();
app.disable("x-powered-by");
app.use(cors({
  origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  credentials: true,
}));
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
  console.error(error);
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON." });
  }
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
