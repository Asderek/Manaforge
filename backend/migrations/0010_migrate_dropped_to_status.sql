-- Migration: Add status column to tournament_registrations and migrate dropped data
ALTER TABLE tournament_registrations ADD COLUMN status TEXT DEFAULT 'active';
UPDATE tournament_registrations SET status = CASE WHEN dropped = 1 THEN 'dropped' ELSE 'active' END;
ALTER TABLE tournament_registrations DROP COLUMN dropped;
