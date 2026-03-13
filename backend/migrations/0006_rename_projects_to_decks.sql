-- Rename projects to decks
ALTER TABLE projects RENAME TO decks;

-- Rename project_cards to deck_cards
ALTER TABLE project_cards RENAME TO deck_cards;

-- Rename project_id column in deck_cards
ALTER TABLE deck_cards RENAME COLUMN project_id TO deck_id;
