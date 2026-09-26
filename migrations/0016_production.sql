CREATE TABLE production (
 idea_id TEXT PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, stage TEXT NOT NULL, state TEXT NOT NULL,
 input_updated TEXT NOT NULL, outputs TEXT NOT NULL DEFAULT '{}',
 note TEXT NOT NULL DEFAULT '', dispatch_ref TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL
);
CREATE UNIQUE INDEX production_one_running ON production(state) WHERE state='実行中';
CREATE TABLE production_history (
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, stage TEXT NOT NULL, state TEXT NOT NULL,
 input_updated TEXT NOT NULL, outputs TEXT NOT NULL, note TEXT NOT NULL,
 dispatch_ref TEXT NOT NULL, updated TEXT NOT NULL,
 PRIMARY KEY(idea_id,version)
);
CREATE TRIGGER production_created AFTER INSERT ON production BEGIN
 INSERT INTO production_history SELECT * FROM production WHERE idea_id=NEW.idea_id;
END;
CREATE TRIGGER production_changed AFTER UPDATE ON production BEGIN
 INSERT INTO production_history SELECT * FROM production WHERE idea_id=NEW.idea_id;
END;

CREATE TRIGGER production_sync_insert AFTER INSERT ON production BEGIN
 INSERT OR IGNORE INTO idea_workflow(idea_id) VALUES(NEW.idea_id);
 UPDATE idea_workflow SET assignee=NEW.stage,reviewer='',state='未着手',memo=NEW.note,version=version+1,updated=NEW.updated,idea_updated=NEW.input_updated,actor_role='member' WHERE idea_id=NEW.idea_id;
END;
CREATE TRIGGER production_sync_update AFTER UPDATE ON production BEGIN
 UPDATE idea_workflow SET assignee=NEW.stage,reviewer=CASE WHEN NEW.state='確認待ち' THEN 'ひなこ' ELSE '' END,
 state=CASE NEW.state WHEN '待機' THEN '未着手' WHEN '実行中' THEN '作業中' WHEN '停止' THEN '保留' ELSE '確認待ち' END,
 memo=NEW.note,version=version+1,updated=NEW.updated,idea_updated=NEW.input_updated,actor_role='member' WHERE idea_id=NEW.idea_id;
 UPDATE ideas SET status=CASE WHEN NEW.state='確認待ち' THEN '確認待ち' WHEN NEW.stage='マップAI' THEN 'マップ制作中' WHEN NEW.stage='モデルAI' THEN 'モデル制作中' ELSE '検討中' END
 WHERE id=NEW.idea_id AND NEW.state<>'停止';
END;
