export const groupClaimMigration={version:7,sql:`
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM ankabot_licenses l JOIN ankabot_sessions s ON s.ankabot_license_id=l.id
   JOIN character_groups g ON g.session_id=s.id AND g.status='active' GROUP BY l.id,l.max_characters
   HAVING count(*)*3>l.max_characters) THEN
  RAISE EXCEPTION 'Existing groups exceed license capacity; reconcile allocations before migration 7' USING ERRCODE='23514';
 END IF;
END $$;
ALTER TABLE character_groups ADD COLUMN assignment_id UUID;
UPDATE character_groups SET assignment_id=gen_random_uuid() WHERE status='active';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
ALTER TABLE character_groups ADD CONSTRAINT group_assignment_identity CHECK((status='active')=(assignment_id IS NOT NULL));
CREATE TABLE group_claims (
 id UUID PRIMARY KEY,
 session_id UUID NOT NULL REFERENCES ankabot_sessions(id) ON DELETE RESTRICT,
 idempotency_key UUID NOT NULL,
 server_id INTEGER NOT NULL CHECK(server_id>0),
 response JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(session_id,idempotency_key)
);
CREATE INDEX claim_available_characters ON characters(server_id,created_at,id) WHERE status='C' AND completed_at IS NULL;
CREATE INDEX claim_abandoned_groups ON character_groups(created_at,id) WHERE status='abandoned';
CREATE FUNCTION validate_license_group_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE license UUID; capacity INTEGER; allocated BIGINT;
BEGIN
 IF NEW.status='active' THEN
  SELECT ankabot_license_id INTO license FROM ankabot_sessions WHERE id=NEW.session_id;
  SELECT max_characters INTO capacity FROM ankabot_licenses WHERE id=license FOR UPDATE;
  SELECT count(*)*3 INTO allocated FROM character_groups g JOIN ankabot_sessions s ON s.id=g.session_id
   WHERE s.ankabot_license_id=license AND g.status='active';
  IF allocated>capacity THEN RAISE EXCEPTION 'License group capacity exceeded' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER group_license_capacity AFTER INSERT OR UPDATE ON character_groups
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_license_group_capacity();
CREATE FUNCTION guard_license_capacity_reduction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allocated BIGINT;
BEGIN
 IF NEW.max_characters<OLD.max_characters THEN
  SELECT count(*)*3 INTO allocated FROM character_groups g JOIN ankabot_sessions s ON s.id=g.session_id
   WHERE s.ankabot_license_id=NEW.id AND g.status='active';
  IF NEW.max_characters<allocated THEN RAISE EXCEPTION 'License capacity below allocated groups' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER license_capacity_reduction BEFORE UPDATE ON ankabot_licenses
 FOR EACH ROW EXECUTE FUNCTION guard_license_capacity_reduction();
`};
