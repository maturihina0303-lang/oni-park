import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {validateReferences} from '../src/worker.js';
test('300×300の資料更新はマップだけを変更し、本文・他の資料と旧マップを保持',()=>{
const db=new DatabaseSync(':memory:');
for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')&&!x.startsWith('0010')).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
const titles=['深海水族館','巨大クモの巣','おもちゃ工場','夢を食べるバク','ハロウィンお菓子工場','呪われたホテル','恐竜研究所','呪われた映画館','巨人の料理教室','動き出す影'].map(x=>x+'鬼ごっこ');
for(const [i,title] of [...titles,'対象外'].entries()){
db.prepare('INSERT INTO ideas (id,title,author,theme,stage,monster,mission,victory,highlight,status,created,updated,runner) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(String(i),title,'ひなこ','その他','現行の本文','鬼1体','6つ','目的','メモ','検討中','before','before','ノーマル');
for(const kind of ['stage','monster','runner','mission'])db.prepare('INSERT INTO idea_references VALUES (?,?,?)').run(String(i),kind,JSON.stringify({brief:'元の'+kind,images:[]}));
}
const before=db.prepare('SELECT * FROM ideas ORDER BY id').all();
const others=db.prepare("SELECT * FROM idea_references WHERE kind!='stage' OR idea_id='10' ORDER BY idea_id,kind").all();
const sql=readFileSync(new URL('../migrations/0010_maps_300.sql',import.meta.url),'utf8');db.exec(sql);
assert.deepEqual(db.prepare('SELECT * FROM ideas ORDER BY id').all(),before);
assert.deepEqual(db.prepare("SELECT * FROM idea_references WHERE kind!='stage' OR idea_id='10' ORDER BY idea_id,kind").all(),others);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM map_reference_backup_300').get().n,11);
for(let i=0;i<10;i++){
const refs=Object.fromEntries(db.prepare('SELECT kind,content FROM idea_references WHERE idea_id=?').all(String(i)).map(r=>[r.kind,JSON.parse(r.content)]));
validateReferences(refs);assert.match(refs.stage.brief,/約300×300ブロック/);assert.equal(refs.stage.images.length,1);assert.equal(refs.stage.images[0].view,'設計図');
}
const after=db.prepare('SELECT * FROM idea_references ORDER BY idea_id,kind').all();db.exec(sql);assert.deepEqual(db.prepare('SELECT * FROM idea_references ORDER BY idea_id,kind').all(),after);db.close();
});
