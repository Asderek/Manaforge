-- Create share_links table for short slugs
CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY, -- the unique short slug (e.g., 'xyz123')
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_links_project_id ON share_links(project_id);
