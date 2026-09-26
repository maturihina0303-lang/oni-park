import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import worker,{digest} from '../src/worker.js';
test('制作キューの重複防止、順序、成果物、停止、古い企画の完了拒否',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const token='b'.repeat(64);db.prepare('INSERT INTO settings VALUES(1,?,?,?)').run('h','s','v');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(await digest(token),'member','v',Date.now()+60000);
 const DB={prepare(sql){const s=db.prepare(sql);return {args:[],bind(...a){this.args=a;return this},async first(){return s.get(...this.args)||null},async all(){return {results:s.all(...this.args)}},async run(){return {meta:s.run(...this.args)}}}},async batch(ss){db.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 const env={DB,ALLOWED_ORIGIN:'https://example.com'},call=(p,method='GET',body,auth=true)=>worker.fetch(new Request('https://api.example/api'+p,{method,headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}),env);
 const note={title:'城',author:'ひなこ',theme:'その他',stage:'城',monster:'影',runner:'ノーマル',mission:'6枚',victory:'脱出',highlight:'メモ',status:'検討中'};
 await call('/ideas','POST',note);const original=(await(await call('/ideas')).json()).items[0],p='/ideas/'+original.id+'/production';
 assert.equal((await call('/production','GET',undefined,false)).status,401);assert.equal((await call(p,'PUT',{action:'start',version:0})).status,200);
 assert.equal((await call(p,'PUT',{action:'start',version:0})).status,409);
 assert.equal((await call(p,'PUT',{action:'complete',version:1,output:{text:'台本',location:'',verified:true}})).status,409);
 let version=1;
 for(const stage of ['台本AI','マップAI','モデルAI']){
  assert.equal((await call(p,'PUT',{action:'claim',version,dispatch_ref:stage+'-test'})).status,200);version++;
  assert.equal((await call(p,'PUT',{action:'claim',version,dispatch_ref:'再送'})).status,409);
  assert.equal((await call(p,'PUT',{action:'complete',version,output:{text:'完成',location:'',verified:false}})).status,400);
  assert.equal((await call(p,'PUT',{action:'complete',version,output:{text:stage+'の結果',location:'D:/test/result',verified:true}})).status,200);version++;
 }
 let r=await(await call(p)).json();assert.equal(r.current.state,'確認待ち');assert.equal(Object.keys(JSON.parse(r.current.outputs)).length,3);assert.equal(r.history.length,7);
 assert.equal((await(await call('/ideas')).json()).items[0].status,'確認待ち');assert.equal(db.prepare('SELECT reviewer FROM idea_workflow').get().reviewer,'ひなこ');
 await call('/ideas','POST',{...note,title:'別企画'});const second=(await(await call('/ideas')).json()).items.find(x=>x.id!==original.id),q='/ideas/'+second.id+'/production';
 await call(q,'PUT',{action:'start',version:0});await call(q,'PUT',{action:'claim',version:1,dispatch_ref:'test'});
 db.prepare('UPDATE ideas SET updated=? WHERE id=?').run('new-revision',second.id);
 assert.equal((await call(q,'PUT',{action:'complete',version:2,output:{text:'古い成果物',location:'',verified:true}})).status,409);
 assert.equal((await call(q,'PUT',{action:'cancel',version:2,note:'内容変更のため'})).status,200);
 assert.equal((await call(q,'PUT',{action:'complete',version:3,output:{text:'完了',location:'',verified:true}})).status,409);
 assert.equal((await call(q,'PUT',{action:'restart',version:3,note:'正しい担当で再開'})).status,200);
 const resumed=(await(await call(q)).json()).current;assert.equal(resumed.stage,'台本AI');assert.equal(resumed.input_updated,'new-revision');assert.equal(resumed.outputs,'{}');
 assert.equal((await call(q,'PUT',{action:'restart',version:4,note:'二重'})).status,409);
 await call('/ideas/'+second.id,'DELETE');assert.equal(db.prepare('SELECT COUNT(*) n FROM production_history WHERE idea_id=?').get(second.id).n,0);db.close();
});
