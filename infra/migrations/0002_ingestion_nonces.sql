-- Phase 2: ingestion replay / nonce tracking

CREATE TABLE ingestion_nonces (
  nonce TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_ingestion_nonces_created_at ON ingestion_nonces (created_at);
