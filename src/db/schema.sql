CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  label TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  quota_per_month BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pbi_challenges (
  id UUID PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  challenge_b64url TEXT NOT NULL,
  purpose TEXT NOT NULL,
  action_hash_hex TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pbi_receipts (
  id UUID PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  challenge_id UUID NOT NULL REFERENCES pbi_challenges(id),
  receipt_hash_hex TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  month_key TEXT NOT NULL,
  kind TEXT NOT NULL, -- "challenge" | "verify"
  units BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  month_key TEXT NOT NULL,
  status TEXT NOT NULL, -- "open" | "final" | "paid"
  line_items_json TEXT NOT NULL,
  total_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_key_month ON usage_events(api_key_id, month_key);
CREATE INDEX IF NOT EXISTS idx_challenges_key_expires ON pbi_challenges(api_key_id, expires_at);