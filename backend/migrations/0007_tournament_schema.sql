-- Tournament Area Schema

-- 1. Players Table
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dob DATE,
    country TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    location TEXT,
    num_tables INTEGER DEFAULT 0,
    format TEXT, -- e.g. Standard, Modern, Commander
    status TEXT DEFAULT 'draft', -- draft, active, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tournament Registrations (Standings)
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    deck_id TEXT, -- FK to decks(id), optional
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    dropped BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL
);

-- 4. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    p1_id TEXT NOT NULL,
    p2_id TEXT NOT NULL,
    p1_score INTEGER DEFAULT 0,
    p2_score INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, ongoing, completed
    table_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (p1_id) REFERENCES players(id),
    FOREIGN KEY (p2_id) REFERENCES players(id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_round ON matches(tournament_id, round_number);

-- Triggers for 'updated_at'
CREATE TRIGGER IF NOT EXISTS trigger_players_updated_at 
AFTER UPDATE ON players 
BEGIN
    UPDATE players SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_tournaments_updated_at 
AFTER UPDATE ON tournaments 
BEGIN
    UPDATE tournaments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_tournament_registrations_updated_at 
AFTER UPDATE ON tournament_registrations 
BEGIN
    UPDATE tournament_registrations SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_matches_updated_at 
AFTER UPDATE ON matches 
BEGIN
    UPDATE matches SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
