import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import worker,{digest,validateWorkflow} from '../src/worker.js';
test('担当・確認先・メモの必須条件を検証',()=>{
 const b={assignee:'マップAI',reviewer:'モデルAI',state:'確認待ち',memo:'幅を確認',version:0};assert.equal(validateWorkflow(b).reviewer,'モデルAI');
 for(const patch of [{assignee:'不明'},{reviewer:''},{memo:''},{memo:'x'.repeat(2001)},{version:-1},{version:1.5},{state:'不明'}])assert.throws(()=>validateWorkflow({...b,...patch}));
});
test('受け渡し・履歴・競合・削除・認証を検証し、企画の進捗は保持',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const token='b'.repeat(64);db.prepare('INSERT INTO settings VALUES(1,?,?,?)').run('h','s','v');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(await digest(token),'member','v',Date.now()+60000);
 const DB={prepare(sql){const s=db.prepare(sql);return {args:[],bind(...a){this.args=a;return this;},async first(){return s.get(...this.args)||null;},async all(){return {results:s.all(...this.args)};},async run(){return {meta:s.run(...this.args)};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,ALLOWED_ORIGIN:'https://example.com'};const call=(p,method='GET',body,auth=true,origin=env.ALLOWED_ORIGIN)=>worker.fetch(new Request('https://api.example/api'+p,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}),env);
 const note={title:'テスト',author:'ひなこ',theme:'その他',stage:'城',monster:'鬼',runner:'ノーマル',mission:'6つ',victory:'脱出',highlight:'メモ',status:'検討中'};
 await call('/ideas','POST',note);const original=(await(await call('/ideas')).json()).items[0],p='/ideas/'+original.id+'/workflow';
 assert.equal((await call(p,'GET',undefined,false)).status,401);
 assert.equal((await call('/workflows','GET',undefined,false)).status,401);
 assert.equal((await(await call(p)).json()).current.version,0);
 let b={assignee:'台本AI',reviewer:'',state:'作業中',memo:'台本を作る',version:0};
 assert.equal((await call(p,'PUT',b,true,'https://evil.example')).status,403);
 assert.equal((await call(p,'PUT',b)).status,200);
 assert.equal((await call(p,'PUT',b)).status,409);
 b={assignee:'台本AI',reviewer:'マップAI',state:'確認待ち',memo:'建築できるか確認',version:1};
 assert.equal((await call(p,'PUT',b)).status,200);
 let result=await(await call(p)).json();assert.equal(result.history.length,2);assert.equal(result.current.version,2);assert.equal(result.history[1].memo,'台本を作る');assert.equal(result.current.idea_updated,original.updated);
 assert.deepEqual((await(await call('/ideas')).json()).items[0],original);
 assert.equal((await(await call('/workflows')).json()).items.length,1);
 assert.equal((await call('/ideas/00000000-0000-0000-0000-000000000000/workflow')).status,404);
 await call('/ideas/'+original.id,'DELETE');assert.equal(db.prepare('SELECT COUNT(*) n FROM workflow_history').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM idea_workflow').get().n,0);db.close();
});
