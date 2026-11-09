export const characterProgressMigration={version:8,sql:`
CREATE TABLE character_progress (
 character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 quest JSONB,
 data JSONB NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(data)='object'),
 last_session_id UUID REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 last_group_id UUID REFERENCES character_groups(id) ON DELETE RESTRICT,
 last_assignment_id UUID,
 updated_at TIMESTAMPTZ
);
CREATE TABLE character_progress_updates (
 session_id UUID NOT NULL REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 update_id UUID NOT NULL,
 character_id UUID NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
 group_id UUID NOT NULL REFERENCES character_groups(id) ON DELETE RESTRICT,
 assignment_id UUID NOT NULL,
 payload_fingerprint TEXT NOT NULL,
 response JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(session_id,update_id)
);
CREATE INDEX character_progress_history ON character_progress_updates(character_id,created_at);
CREATE TABLE session_sync_state (
 session_id UUID PRIMARY KEY REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 sequence INTEGER NOT NULL CHECK(sequence>0),
 loaded_characters JSONB NOT NULL CHECK(jsonb_typeof(loaded_characters)='array'),
 report JSONB NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);
`};
