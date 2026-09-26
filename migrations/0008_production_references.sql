CREATE TABLE idea_references (
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('stage','monster','runner','mission')),
 content TEXT NOT NULL,
 PRIMARY KEY(idea_id,kind)
);
