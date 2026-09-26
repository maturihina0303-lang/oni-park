import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {validateReferences} from '../src/worker.js';

test('アイテム画像を10企画に追加し、既存本文・他資料・既存画像を保持する',()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')&&!x.startsWith('0014')).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const titles=['深海水族館','巨大クモの巣','おもちゃ工場','夢を食べるバク','ハロウィンお菓子工場','呪われたホテル','恐竜研究所','呪われた映画館','巨人の料理教室','動き出す影'].map(x=>x+'鬼ごっこ');
 const image={data:'data:image/png;base64,AAAA',view:'全体図',note:'既存画像',source:''};
 for(const [i,title]of titles.entries()){
  db.prepare('INSERT INTO ideas (id,title,author,theme,stage,monster,mission,victory,highlight,status,created,updated,runner) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(String(i),title,'ひなこ','その他','本文','鬼1体','隠しアイテム6つ','目的','メモ','アイデア','before','before','ノーマル');
  for(const kind of ['stage','monster','runner','mission']){
   if(kind==='mission'&&i%2)continue;
   db.prepare('INSERT INTO idea_references VALUES (?,?,?)').run(String(i),kind,JSON.stringify({brief:'既存条件',images:[image]}));
  }
 }
 const before=db.prepare('SELECT * FROM ideas').all();
 const other=db.prepare("SELECT * FROM idea_references WHERE kind!='mission'").all();
 const sql=readFileSync(new URL('../migrations/0014_item_model_references.sql',import.meta.url),'utf8');db.exec(sql);
 assert.deepEqual(db.prepare('SELECT * FROM ideas').all(),before);
 assert.deepEqual(db.prepare("SELECT * FROM idea_references WHERE kind!='mission'").all(),other);
 for(let i=0;i<10;i++){
  const refs=Object.fromEntries(db.prepare('SELECT kind,content FROM idea_references WHERE idea_id=?').all(String(i)).map(r=>[r.kind,JSON.parse(r.content)]));
  validateReferences(refs);
  assert.equal(refs.mission.images.length,i%2?1:2);
  if(i%2===0){assert.deepEqual(refs.mission.images[0],image);assert.ok(refs.mission.brief.startsWith('既存条件'));}
  assert.equal(refs.mission.images.at(-1).view,'三面図');
  assert.match(refs.mission.brief,/【Blockbench用アイテム参考 v1】/);
  assert.match(refs.mission.brief,/出力|モデル形式/);
 }
 assert.equal(db.prepare('SELECT count(*) AS n FROM item_model_reference_backup').get().n,5);
 const after=db.prepare('SELECT * FROM idea_references').all();db.exec(sql);
 assert.deepEqual(db.prepare('SELECT * FROM idea_references').all(),after);
 db.close();
});
