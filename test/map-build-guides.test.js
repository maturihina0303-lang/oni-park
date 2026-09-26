import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {validateReferences} from '../src/worker.js';
test('内装資料の追加は外観図・本文・他の資料を保持し、重複追加しない',()=>{
const db=new DatabaseSync(':memory:');
for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')&&!x.startsWith('0011')).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
const titles=['深海水族館','巨大クモの巣','おもちゃ工場','夢を食べるバク','ハロウィンお菓子工場','呪われたホテル','恐竜研究所','呪われた映画館','巨人の料理教室','動き出す影'].map(x=>x+'鬼ごっこ');
const oldImage={data:'data:image/png;base64,AAAA',view:'設計図',note:'承認済み外観',source:''};
for(const [i,title]of titles.entries()){
db.prepare('INSERT INTO ideas (id,title,author,theme,stage,monster,mission,victory,highlight,status,created,updated,runner) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(String(i),title,'ひなこ','その他','本文','鬼1体','6つ','目的','メモ','アイデア','before','before','ノーマル');
for(const kind of ['stage','monster','runner','mission'])db.prepare('INSERT INTO idea_references VALUES (?,?,?)').run(String(i),kind,JSON.stringify({brief:'以前の条件',images:kind==='stage'?[oldImage]:[]}));
}
const before=db.prepare('SELECT * FROM ideas').all(),others=db.prepare("SELECT * FROM idea_references WHERE kind!='stage'").all();
const sql=readFileSync(new URL('../migrations/0011_map_build_guides.sql',import.meta.url),'utf8');db.exec(sql);
assert.deepEqual(db.prepare('SELECT * FROM ideas').all(),before);assert.deepEqual(db.prepare("SELECT * FROM idea_references WHERE kind!='stage'").all(),others);
for(let i=0;i<10;i++){
const refs=Object.fromEntries(db.prepare('SELECT kind,content FROM idea_references WHERE idea_id=?').all(String(i)).map(r=>[r.kind,JSON.parse(r.content)]));validateReferences(refs);assert.deepEqual(refs.stage.images[0],oldImage);assert.equal(refs.stage.images.length,2);assert.equal(refs.stage.images[1].view,'内装');assert.match(refs.stage.brief,/約300×300/);assert.match(refs.stage.brief,/未確定/);
}
const after=db.prepare('SELECT * FROM idea_references').all();db.exec(sql);assert.deepEqual(db.prepare('SELECT * FROM idea_references').all(),after);db.close();
});
