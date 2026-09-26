CREATE TABLE idea_workflow (
 idea_id TEXT PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
 assignee TEXT NOT NULL DEFAULT '', reviewer TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT '未着手', memo TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL DEFAULT '',
 idea_updated TEXT NOT NULL DEFAULT '', actor_role TEXT NOT NULL DEFAULT ''
);
CREATE TABLE workflow_history (
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, assignee TEXT NOT NULL, reviewer TEXT NOT NULL,
 state TEXT NOT NULL, memo TEXT NOT NULL, updated TEXT NOT NULL,
 idea_updated TEXT NOT NULL, actor_role TEXT NOT NULL,
 PRIMARY KEY(idea_id,version)
);
CREATE TRIGGER workflow_record AFTER UPDATE ON idea_workflow
WHEN NEW.version > OLD.version BEGIN
 INSERT INTO workflow_history VALUES(NEW.idea_id,NEW.version,NEW.assignee,NEW.reviewer,NEW.state,NEW.memo,NEW.updated,NEW.idea_updated,NEW.actor_role);
END;
