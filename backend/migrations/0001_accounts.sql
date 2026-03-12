DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS registration_requests;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'user' NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE registration_requests (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    note TEXT,
    recaptcha_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    FOREIGN KEY(reviewed_by) REFERENCES users(id)
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Creating the first admin manually as requested in Phase 0
INSERT INTO users (id, email, display_name, password_hash, role, status)
VALUES ('usr_admin123', 'admin@manaforge.example', 'Admin', 'admin', 'admin', 'active');
