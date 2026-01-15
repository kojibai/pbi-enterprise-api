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

-- Customers (portal identities)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',
  quota_per_month BIGINT NOT NULL DEFAULT 100000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link api_keys -> customer
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_api_keys_customer_id ON api_keys(customer_id);

-- Magic link tokens (store hashed token only)
CREATE TABLE IF NOT EXISTS portal_magic_links (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_customer ON portal_magic_links(customer_id);

-- Portal sessions (cookie -> session id)
CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_customer ON portal_sessions(customer_id);

-- Stripe mapping (optional but clean)
CREATE TABLE IF NOT EXISTS stripe_customers (
  customer_id UUID PRIMARY KEY REFERENCES customers(id),
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);