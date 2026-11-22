CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

-- Prepared now; inquiry endpoints and UI arrive in Stage 2.
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES staff_users(id),
  customer_name TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New'
    CHECK (status IN ('New', 'In Progress', 'Resolved')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_owner_created_idx
  ON inquiries (owner_id, created_at DESC);
