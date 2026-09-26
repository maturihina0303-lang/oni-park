import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import worker,{digest,validateReferences} from '../src/worker.js';
const img={data:'data:image/png;base64,AAAA',view:'正面',note:'形の参考',source:'https://example.com/source'};
const refs=()=>Object.fromEntries(['stage','monster','runner','mission'].map(k=>[k,{brief:'未確定の寸法あり',images:[{...img}]}]));
test('制作資料の枚数・説明・画像・URLを検証',()=>{assert.equal(validateReferences(refs()).monster.images[0].view,'正面');for(const change of [s=>s.images=Array(7).fill(img),s=>s.images[0].data='data:image/svg+xml;base64,AAAA',s=>s.images[0].source='javascript:alert(1)',s=>s.brief='a'.repeat(3001)]){const value=refs();change(value.stage);assert.throws(()=>validateReferences(value));}});
test('制作資料を本文と一緒に保存し、旧形式の編集でも保持し、削除時に資料も消す',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const token='b'.repeat(64);db.prepare('INSERT INTO settings VALUES(1,?,?,?)').run('h','s','v');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(await digest(token),'member','v',Date.now()+60000);
 const DB={prepare(sql){const s=db.prepare(sql);return {args:[],bind(...a){this.args=a;return this;},async first(){return s.get(...this.args)||null;},async all(){return {results:s.all(...this.args)};},async run(){return {meta:s.run(...this.args)};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,ALLOWED_ORIGIN:'https://example.com'};const call=(path,method='GET',body,auth=true)=>worker.fetch(new Request('https://api.example/api'+path,{method,headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}),env);
 const note={title:'テスト',author:'テスト',theme:'その他',stage:'城',monster:'鬼',runner:'ノーマル',mission:'6つ',victory:'脱出',highlight:'メモ',status:'アイデア'};
 assert.equal((await call('/ideas','POST',{...note,references:refs()})).status,201);const id=(await (await call('/ideas')).json()).items[0].id,path='/ideas/'+id;
 assert.equal((await call(path+'/images','GET',undefined,false)).status,401);assert.deepEqual((await (await call(path+'/images')).json()).references,refs());
 assert.equal((await call(path,'PUT',note)).status,200);assert.deepEqual((await (await call(path+'/images')).json()).references,refs());
 const value=refs();value.monster.images=[];assert.equal((await call(path,'PUT',{...note,references:value})).status,200);assert.equal((await (await call(path+'/images')).json()).references.monster.images.length,0);
 assert.equal((await call('/ideas/00000000-0000-0000-0000-000000000000','PUT',{...note,references:refs()})).status,404);
 assert.equal((await call(path,'DELETE')).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM idea_references').get().n,0);db.close();
});
