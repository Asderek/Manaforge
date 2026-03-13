-- Add current_round to tournaments
ALTER TABLE tournaments ADD COLUMN current_round INTEGER DEFAULT 0;
