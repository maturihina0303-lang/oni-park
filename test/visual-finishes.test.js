import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {validateReferences} from '../src/worker.js';

test('完成イメージを10企画に追記し、既存資料・本文を保全する',()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')&&!x.startsWith('0013')).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const titles=['深海水族館','巨大クモの巣','おもちゃ工場','夢を食べるバク','ハロウィンお菓子工場','呪われたホテル','恐竜研究所','呪われた映画館','巨人の料理教室','動き出す影'].map(x=>x+'鬼ごっこ');
 const oldImages=['設計図','内装','細部'].map(view=>({data:'data:image/png;base64,AAAA',view,note:'既存画像',source:''}));
 for(const [i,title]of titles.entries()){
  db.prepare('INSERT INTO ideas (id,title,author,theme,stage,monster,mission,victory,highlight,status,created,updated,runner) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(String(i),title,'ひなこ','その他','本文','鬼1体','6つ','目的','メモ','アイデア','before','before','ノーマル');
  for(const kind of ['stage','monster','runner','mission'])db.prepare('INSERT INTO idea_references VALUES (?,?,?)').run(String(i),kind,JSON.stringify({brief:'現在の制作条件を保持',images:kind==='stage'?oldImages:[]}));
 }
 const before=db.prepare('SELECT * FROM ideas').all();
 const other=db.prepare("SELECT * FROM idea_references WHERE kind!='stage'").all();
 const sql=readFileSync(new URL('../migrations/0013_visual_finishes.sql',import.meta.url),'utf8');db.exec(sql);
 assert.deepEqual(db.prepare('SELECT * FROM ideas').all(),before);
 assert.deepEqual(db.prepare("SELECT * FROM idea_references WHERE kind!='stage'").all(),other);
 for(let i=0;i<10;i++){
  const refs=Object.fromEntries(db.prepare('SELECT kind,content FROM idea_references WHERE idea_id=?').all(String(i)).map(r=>[r.kind,JSON.parse(r.content)]));
  validateReferences(refs);
  assert.deepEqual(refs.stage.images.slice(0,3),oldImages);
  assert.equal(refs.stage.images.length,4);
  assert.equal(refs.stage.images[3].view,'外観');
  assert.match(refs.stage.brief,/^現在の制作条件を保持\n【内外装の完成イメージ v3】/);
  assert.match(refs.stage.brief,/実際のゲーム画面でもなく/);
 }
 assert.equal(db.prepare('SELECT count(*) AS n FROM visual_finish_backup').get().n,10);
 const after=db.prepare('SELECT * FROM idea_references').all();db.exec(sql);
 assert.deepEqual(db.prepare('SELECT * FROM idea_references').all(),after);
 db.close();
});
