export const banEventMigration={version:9,sql:`
ALTER TABLE characters ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active'
 CHECK(lifecycle_status IN ('active','quarantined','archived'));
ALTER TABLE characters ADD COLUMN quarantined_at TIMESTAMPTZ;
ALTER TABLE characters ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE characters ADD CONSTRAINT character_archive_date CHECK((lifecycle_status='archived')=(archived_at IS NOT NULL));
ALTER TABLE characters ADD CONSTRAINT character_quarantine_date CHECK(lifecycle_status<>'quarantined' OR quarantined_at IS NOT NULL);
UPDATE characters SET lifecycle_status='quarantined',quarantined_at=updated_at WHERE status='B';
CREATE TABLE ban_events (
 id UUID PRIMARY KEY,schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version=1),
 target_type TEXT NOT NULL CHECK(target_type IN ('character','ankama_account')),
 character_id UUID REFERENCES characters(id) ON DELETE RESTRICT,
 ankama_id UUID REFERENCES ankama_accounts(id) ON DELETE RESTRICT,
 reason_code TEXT NOT NULL,description TEXT,
 actor_type TEXT NOT NULL CHECK(actor_type IN ('operator','session','legacy_status')),
 actor_session_id UUID REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 sender_assignment_id UUID,payload_fingerprint TEXT NOT NULL,response JSONB NOT NULL DEFAULT '{}',
 received_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
 CHECK((target_type='character' AND character_id IS NOT NULL AND ankama_id IS NULL) OR
       (target_type='ankama_account' AND ankama_id IS NOT NULL AND character_id IS NULL)),
 CHECK((actor_type='session')=(actor_session_id IS NOT NULL))
);
CREATE INDEX ban_events_character_idx ON ban_events(character_id,received_at DESC);
CREATE INDEX ban_events_account_idx ON ban_events(ankama_id,received_at DESC);
CREATE TABLE group_restart_preparations (
 id UUID PRIMARY KEY,group_id UUID NOT NULL UNIQUE REFERENCES character_groups(id) ON DELETE RESTRICT,
 first_event_id UUID NOT NULL REFERENCES ban_events(id) ON DELETE RESTRICT,
 origin_session_id UUID REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 current_step TEXT NOT NULL DEFAULT 'pending_external_preparation' CHECK(current_step='pending_external_preparation'),
 original_snapshot JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX group_restart_origin ON group_restart_preparations(origin_session_id,created_at);
CREATE TABLE ban_event_characters (
 event_id UUID NOT NULL REFERENCES ban_events(id) ON DELETE RESTRICT,
 character_id UUID NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
 previous_status TEXT NOT NULL,previous_lifecycle TEXT NOT NULL,result_status TEXT NOT NULL,direct_target BOOLEAN NOT NULL,
 PRIMARY KEY(event_id,character_id)
);
CREATE TABLE ban_event_groups (
 event_id UUID NOT NULL REFERENCES ban_events(id) ON DELETE RESTRICT,
 group_id UUID NOT NULL REFERENCES character_groups(id) ON DELETE RESTRICT,
 previous_status TEXT NOT NULL,previous_session_id UUID REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 previous_assignment_id UUID,invalidated BOOLEAN NOT NULL,
 preparation_id UUID REFERENCES group_restart_preparations(id) ON DELETE RESTRICT,
 PRIMARY KEY(event_id,group_id)
);
ALTER TABLE group_events ADD COLUMN ban_event_id UUID REFERENCES ban_events(id) ON DELETE RESTRICT;
DROP INDEX claim_available_characters;
CREATE INDEX claim_available_characters ON characters(server_id,created_at,id)
 WHERE status='C' AND completed_at IS NULL AND lifecycle_status='active';

CREATE OR REPLACE FUNCTION validate_character_group(target UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g character_groups%ROWTYPE; n INTEGER; breeds INTEGER; accounts INTEGER; servers INTEGER;
BEGIN
 SELECT * INTO g FROM character_groups WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT count(*),count(DISTINCT c.breed_id),count(DISTINCT c.ankama_id),count(DISTINCT c.server_id)
 INTO n,breeds,accounts,servers FROM group_members m JOIN characters c ON c.id=m.character_id
 WHERE m.group_id=target AND m.removed_at IS NULL;
 IF n>3 OR breeds<>n OR accounts<>n OR (n>0 AND servers<>1) THEN
  RAISE EXCEPTION 'Invalid group composition' USING ERRCODE='23514';
 END IF;
 IF g.status IN ('active','completed') AND n<>3 THEN
  RAISE EXCEPTION 'Operational group requires three members' USING ERRCODE='23514';
 END IF;
 IF g.status IN ('forming','active') AND EXISTS(SELECT 1 FROM group_members m JOIN characters c ON c.id=m.character_id
  WHERE m.group_id=target AND m.removed_at IS NULL AND c.lifecycle_status<>'active') THEN
  RAISE EXCEPTION 'Quarantined members cannot operate' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM group_members WHERE group_id=target AND removed_at IS NULL
   AND ((g.status='completed' AND released_at IS NULL) OR (g.status<>'completed' AND released_at IS NOT NULL))) THEN
  RAISE EXCEPTION 'Invalid group reservation' USING ERRCODE='23514';
 END IF;
 IF g.status='completed' AND EXISTS(SELECT 1 FROM group_members m JOIN characters c ON c.id=m.character_id
  WHERE m.group_id=target AND m.removed_at IS NULL AND c.completed_at IS NULL) THEN
  RAISE EXCEPTION 'Completed group requires completed members' USING ERRCODE='23514';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION guard_group_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status=OLD.status THEN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.session_slot IS DISTINCT FROM OLD.session_slot
   OR NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id THEN
   RAISE EXCEPTION 'Cannot replace group assignment or completion' USING ERRCODE='23514';
  END IF;
 ELSIF NOT ((OLD.status='forming' AND NEW.status IN ('active','abandoned','awaiting_restart')) OR
  (OLD.status='active' AND NEW.status IN ('abandoned','awaiting_restart','completed')) OR
  (OLD.status='abandoned' AND NEW.status IN ('active','awaiting_restart'))) THEN
  RAISE EXCEPTION 'Invalid group transition' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
`};
