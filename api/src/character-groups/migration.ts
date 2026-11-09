export const characterGroupMigration={version:6,sql:`
ALTER TABLE characters ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE characters DROP CONSTRAINT characters_status_check;
UPDATE characters SET status='E',completed_at=updated_at WHERE status='F';
ALTER TABLE characters ADD CONSTRAINT characters_status_check CHECK(status IN ('C','E','B','P'));

CREATE TABLE character_groups (
 id UUID PRIMARY KEY,
 session_id UUID REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 session_slot SMALLINT CHECK(session_slot BETWEEN 1 AND 3),
 status TEXT NOT NULL DEFAULT 'forming' CHECK(status IN ('forming','active','abandoned','awaiting_restart','completed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
 completed_at TIMESTAMPTZ,
 CHECK((status='active' AND session_id IS NOT NULL AND session_slot IS NOT NULL) OR
       (status<>'active' AND session_id IS NULL AND session_slot IS NULL)),
 CHECK((status='completed')=(completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX character_groups_session_slot ON character_groups(session_id,session_slot) WHERE status='active';
CREATE INDEX character_groups_status_idx ON character_groups(status,created_at,id);
CREATE TABLE group_members (
 group_id UUID NOT NULL REFERENCES character_groups(id) ON DELETE RESTRICT,
 character_id UUID NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
 joined_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
 removed_at TIMESTAMPTZ,
 released_at TIMESTAMPTZ,
 PRIMARY KEY(group_id,character_id),
 CHECK(removed_at IS NULL OR released_at IS NOT NULL)
);
CREATE UNIQUE INDEX group_members_character_reservation ON group_members(character_id) WHERE released_at IS NULL;
CREATE INDEX group_members_character_idx ON group_members(character_id);
CREATE TABLE group_events (
 id UUID PRIMARY KEY,
 group_id UUID NOT NULL REFERENCES character_groups(id) ON DELETE RESTRICT,
 event_type TEXT NOT NULL CHECK(event_type IN ('created','member_added','member_removed','state_changed')),
 character_id UUID REFERENCES characters(id) ON DELETE RESTRICT,
 from_status TEXT,
 to_status TEXT NOT NULL,
 from_session_id UUID REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 to_session_id UUID REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX group_events_group_idx ON group_events(group_id,created_at,id);

CREATE FUNCTION validate_character_group(target UUID) RETURNS void LANGUAGE plpgsql AS $$
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
 IF g.status IN ('active','awaiting_restart','completed') AND n<>3 THEN
  RAISE EXCEPTION 'Operational group requires three members' USING ERRCODE='23514';
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
CREATE FUNCTION check_group_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='character_groups' THEN PERFORM validate_character_group(NEW.id);
 ELSIF TG_TABLE_NAME='group_members' THEN PERFORM validate_character_group(COALESCE(NEW.group_id,OLD.group_id));
 ELSE
  PERFORM validate_character_group(m.group_id) FROM group_members m WHERE m.character_id=NEW.id AND m.removed_at IS NULL ORDER BY m.group_id;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER character_groups_integrity AFTER INSERT OR UPDATE ON character_groups
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_group_integrity();
CREATE CONSTRAINT TRIGGER group_members_integrity AFTER INSERT OR UPDATE OR DELETE ON group_members
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_group_integrity();
CREATE CONSTRAINT TRIGGER character_composition_integrity AFTER UPDATE ON characters
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 WHEN (OLD.breed_id IS DISTINCT FROM NEW.breed_id OR OLD.ankama_id IS DISTINCT FROM NEW.ankama_id OR OLD.server_id IS DISTINCT FROM NEW.server_id)
 EXECUTE FUNCTION check_group_integrity();
CREATE FUNCTION preserve_character_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
  RAISE EXCEPTION 'Character completion cannot be reset' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER character_completion_immutable BEFORE UPDATE ON characters
 FOR EACH ROW EXECUTE FUNCTION preserve_character_completion();

CREATE FUNCTION guard_group_member_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status TEXT;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Group history must be preserved' USING ERRCODE='23514'; END IF;
 SELECT status INTO current_status FROM character_groups WHERE id=NEW.group_id FOR UPDATE;
 IF TG_OP='UPDATE' AND (NEW.group_id<>OLD.group_id OR NEW.character_id<>OLD.character_id) THEN
  RAISE EXCEPTION 'Member identity is immutable' USING ERRCODE='23514';
 END IF;
 IF current_status<>'forming' THEN
  IF TG_OP='UPDATE' AND current_status='completed' AND OLD.released_at IS NULL AND NEW.released_at IS NOT NULL
   AND NEW.removed_at IS NOT DISTINCT FROM OLD.removed_at AND NEW.joined_at=OLD.joined_at THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Group composition is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER group_member_change BEFORE INSERT OR UPDATE OR DELETE ON group_members
 FOR EACH ROW EXECUTE FUNCTION guard_group_member_change();
CREATE FUNCTION guard_group_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status=OLD.status THEN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.session_slot IS DISTINCT FROM OLD.session_slot OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
   RAISE EXCEPTION 'Cannot replace group assignment or completion' USING ERRCODE='23514';
  END IF;
 ELSIF NOT ((OLD.status='forming' AND NEW.status IN ('active','abandoned')) OR
  (OLD.status='active' AND NEW.status IN ('abandoned','awaiting_restart','completed')) OR
  (OLD.status='abandoned' AND NEW.status='active')) THEN
  RAISE EXCEPTION 'Invalid group transition' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER character_group_transition BEFORE UPDATE ON character_groups
 FOR EACH ROW EXECUTE FUNCTION guard_group_transition();
`};
