CREATE TABLE
    IF NOT EXISTS comments (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
        parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE
    );

CREATE TABLE
    IF NOT EXISTS reactions (
        id BIGSERIAL PRIMARY KEY,
        comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        count INT NOT NULL DEFAULT 0,
        UNIQUE (comment_id, emoji)
    );