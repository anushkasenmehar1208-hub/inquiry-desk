import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const fields = [
  { name: "customerName", label: "Customer name", maxLength: 120 },
  { name: "customerContact", label: "Customer contact", maxLength: 200 },
  { name: "subject", label: "Subject", maxLength: 200 },
  { name: "description", label: "Description", maxLength: 4000 },
];
const statuses = ["New", "In Progress", "Resolved"];
const inquiryColumns = `id, customer_name AS "customerName", customer_contact AS "customerContact",
  subject, description, status, created_at AS "createdAt", updated_at AS "updatedAt"`;

export const inquiriesRouter = Router();

inquiriesRouter.post("/", requireAuth, async (req, res) => {
  const values = [];
  for (const { name, label, maxLength } of fields) {
    const raw = req.body?.[name];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value || value.length > maxLength || value.includes("\0")) {
      return res.status(400).json({ error: `${label} must be between 1 and ${maxLength} characters.` });
    }
    values.push(value);
  }

  const { rows: [inquiry] } = await pool.query(
    `INSERT INTO inquiries (id, owner_id, customer_name, customer_contact, subject, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${inquiryColumns}`,
    [randomUUID(), req.staff.id, ...values],
  );
  return res.status(201).json({ inquiry });
});

inquiriesRouter.get("/", requireAuth, async (req, res) => {
  const { q, status } = req.query;
  if (Object.keys(req.query).some((key) => key !== "q" && key !== "status")) {
    return res.status(400).json({ error: "Use only the q and status query parameters." });
  }
  if (q !== undefined && (typeof q !== "string" || q.trim().length > 120 || q.includes("\0"))) {
    return res.status(400).json({ error: "Search must be a single text value of up to 120 characters." });
  }
  if (status !== undefined && (typeof status !== "string" || !statuses.includes(status.trim()))) {
    return res.status(400).json({ error: "Status must be New, In Progress, or Resolved." });
  }

  const { rows: inquiries } = await pool.query(
    `SELECT ${inquiryColumns}
     FROM inquiries
     WHERE owner_id = $1
       AND ($2::text IS NULL OR status = $2)
       AND ($3::text IS NULL
         OR strpos(lower(customer_name), lower($3)) > 0
         OR strpos(lower(customer_contact), lower($3)) > 0
         OR strpos(lower(subject), lower($3)) > 0
         OR strpos(lower(description), lower($3)) > 0)
     ORDER BY created_at DESC, id DESC`,
    [req.staff.id, status?.trim() ?? null, q?.trim() || null],
  );
  return res.json({ inquiries });
});
