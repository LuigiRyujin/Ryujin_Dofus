export const ankabotSessionMigration={version:5,sql:`
  CREATE TABLE ankabot_sessions (
    id UUID PRIMARY KEY,
    ankabot_license_id UUID NOT NULL REFERENCES ankabot_licenses(id) ON DELETE RESTRICT,
    hostname TEXT NOT NULL CHECK(length(hostname) BETWEEN 1 AND 255 AND hostname=lower(trim(hostname))),
    pid BIGINT NOT NULL CHECK(pid BETWEEN 1 AND 4294967295),
    credential_hash TEXT NOT NULL CHECK(length(credential_hash)=64),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','closed')),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
    ended_at TIMESTAMPTZ,
    CHECK ((status='active' AND ended_at IS NULL) OR (status<>'active' AND ended_at IS NOT NULL))
  );
  CREATE UNIQUE INDEX ankabot_session_active_identity ON ankabot_sessions(ankabot_license_id,hostname,pid) WHERE status='active';
  CREATE INDEX ankabot_sessions_license_idx ON ankabot_sessions(ankabot_license_id,created_at DESC,id);
  CREATE INDEX ankabot_sessions_status_idx ON ankabot_sessions(status);
  CREATE INDEX ankabot_sessions_expiration_idx ON ankabot_sessions(last_heartbeat_at) WHERE status='active';
`};
