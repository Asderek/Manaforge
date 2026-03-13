-- Add scheduling support for matches
ALTER TABLE matches ADD COLUMN scheduled_at DATETIME;
