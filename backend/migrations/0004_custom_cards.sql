-- Migration number: 0004   2026-03-12T16:40:00.000Z

-- Custom cards created by users
CREATE TABLE custom_cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    card_name TEXT NOT NULL,
    card_image TEXT NOT NULL, -- Base64 string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
