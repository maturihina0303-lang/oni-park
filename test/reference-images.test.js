import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {validateIdea,validateImages} from '../src/worker.js';
test('参考画像の一括追加は既存画像・本文を保持し、再実行でも重複しない',()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')&&!x.startsWith('0007')).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const titles=['深海水族館','巨大クモの巣','おもちゃ工場','夢を食べるバク','ハロウィンお菓子工場','呪われたホテル','恐竜研究所','呪われた映画館','巨人の料理教室','動き出す影'].map(x=>x+'鬼ごっこ');
 for(const [i,title]of titles.entries())db.prepare('INSERT INTO ideas (id,title,author,theme,stage,monster,mission,victory,highlight,status,created,updated,runner) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(String(i),title,'ひなこ','その他','村','鬼','6つ','脱出','元の制作メモ','アイデア','before','before',i===8?'小人':'ノーマル');
 const existing='data:image/jpeg;base64,AAAA';db.prepare('UPDATE ideas SET stage_image=? WHERE id=?').run(existing,'0');
 const sql=readFileSync(new URL('../migrations/0007_reference_images.sql',import.meta.url),'utf8');db.exec(sql);
 const rows=db.prepare('SELECT * FROM ideas ORDER BY id').all();let count=0;
 for(const row of rows){assert.equal(row.stage,'村');assert.equal(row.updated,'before');assert.ok(row.highlight.startsWith('元の制作メモ'));validateIdea(row);validateImages(row);for(const key of ['stage_image','monster_image','runner_image'])if(row[key])count++;if(row.runner==='ノーマル')assert.equal(row.runner_image,'');}
 assert.equal(count,21);assert.equal(rows[0].stage_image,existing);
 db.exec(sql);assert.deepEqual(db.prepare('SELECT * FROM ideas ORDER BY id').all(),rows);db.close();
});
