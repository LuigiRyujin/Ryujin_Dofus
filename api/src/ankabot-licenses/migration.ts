export const ankabotLicenseMigration = {
  version: 4,
  sql: `CREATE TABLE ankabot_licenses (
    id UUID PRIMARY KEY,
    api_key_encrypted TEXT NOT NULL,
    api_key_fingerprint TEXT NOT NULL UNIQUE,
    max_characters INTEGER NOT NULL DEFAULT 40 CHECK (max_characters > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
};
