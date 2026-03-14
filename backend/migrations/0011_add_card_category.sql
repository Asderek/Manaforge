-- Migration number: 0011   2026-03-14T03:00:00.000Z
-- Add category column to deck_cards
ALTER TABLE deck_cards ADD COLUMN category TEXT NOT NULL DEFAULT 'Uncategorized';
