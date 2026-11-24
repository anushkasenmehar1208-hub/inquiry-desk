import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { inquiriesRouter } from "./routes/inquiries.js";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: webOrigin, credentials: true }));
app.use(["/api/auth", "/api/inquiries"], (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const origin = req.get("Origin");
  if (["POST", "PATCH"].includes(req.method) && origin !== undefined && origin !== webOrigin) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }
  return next();
});
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/inquiries", inquiriesRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint not found." }));

app.use((error, _req, res, _next) => {
  if (error instanceof URIError && error.status === 400) {
    return res.status(400).json({ error: "Invalid request path." });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON." });
  }
  if (error?.type === "entity.too.large") {
    return res.status(400).json({ error: "Request body is too large." });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
