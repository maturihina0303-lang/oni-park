CREATE TABLE retrospective (
 idea_id TEXT PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, state TEXT NOT NULL, content TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE TABLE retrospective_history (
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, state TEXT NOT NULL, content TEXT NOT NULL, updated TEXT NOT NULL,
 PRIMARY KEY(idea_id,version)
);
CREATE TRIGGER retrospective_insert AFTER INSERT ON retrospective BEGIN
 INSERT INTO retrospective_history SELECT * FROM retrospective WHERE idea_id=NEW.idea_id;
END;
CREATE TRIGGER retrospective_update AFTER UPDATE ON retrospective BEGIN
 INSERT INTO retrospective_history SELECT * FROM retrospective WHERE idea_id=NEW.idea_id;
END;
