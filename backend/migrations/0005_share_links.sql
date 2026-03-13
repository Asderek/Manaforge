-- Create share_links table for short slugs (updated to Deck terminology)
CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY, -- the unique short slug (e.g., 'xyz123')
    deck_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_links_deck_id ON share_links(deck_id);
