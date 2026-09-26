import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {validateReferences} from '../src/worker.js';
test('20枚の制作参考図だけを差し替え、本文・進捗・別資料を保持して旧資料を退避',()=>{
const db=new DatabaseSync(':memory:');
for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')&&!x.startsWith('0009')).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
const titles=['深海水族館','巨大クモの巣','おもちゃ工場','夢を食べるバク','ハロウィンお菓子工場','呪われたホテル','恐竜研究所','呪われた映画館','巨人の料理教室','動き出す影'].map(x=>x+'鬼ごっこ');
for(const [i,title]of [...titles,'対象外'].entries())db.prepare('INSERT INTO ideas (id,title,author,theme,stage,monster,mission,victory,highlight,status,created,updated,runner) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(String(i),title,'ひなこ','その他','現在のマップ','現在の鬼','6つ','目的','編集済みメモ','検討中','before','before','ノーマル');
const old=JSON.stringify({brief:'既存資料',images:[]});
for(const kind of ['stage','monster','runner','mission'])db.prepare('INSERT INTO idea_references VALUES (?,?,?)').run('0',kind,old);
const before=db.prepare('SELECT * FROM ideas ORDER BY id').all();
const sql=readFileSync(new URL('../migrations/0009_replace_production_references.sql',import.meta.url),'utf8');db.exec(sql);
assert.deepEqual(db.prepare('SELECT * FROM ideas ORDER BY id').all(),before);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reference_backup_20260926').get().n,2);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM idea_references').get().n,22);
assert.equal(db.prepare("SELECT content FROM idea_references WHERE idea_id='0' AND kind='runner'").get().content,old);
for(let i=0;i<10;i++){
const refs={runner:{brief:'',images:[]},mission:{brief:'',images:[]}};
for(const row of db.prepare('SELECT kind,content FROM idea_references WHERE idea_id=?').all(String(i)))refs[row.kind]=JSON.parse(row.content);
validateReferences(refs);
assert.equal(refs.stage.images[0].view,'設計図');assert.equal(refs.monster.images[0].view,'三面図');
assert.match(refs.stage.brief,/AI生成/);assert.match(refs.monster.brief,/同じ鬼1体/);
for(const kind of ['stage','monster'])assert.ok(refs[kind].images[0].data.length<=300000);
}
const after=db.prepare('SELECT * FROM idea_references ORDER BY idea_id,kind').all();db.exec(sql);assert.deepEqual(db.prepare('SELECT * FROM idea_references ORDER BY idea_id,kind').all(),after);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reference_backup_20260926').get().n,2);
db.close();
});
