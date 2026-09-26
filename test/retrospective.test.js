import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import worker,{digest} from '../src/worker.js';
test('振り返りの認証・競合・確認後の変更・共有・履歴',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const token='b'.repeat(64);db.prepare('INSERT INTO settings VALUES(1,?,?,?)').run('h','s','v');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(await digest(token),'member','v',Date.now()+60000);
 const DB={prepare(sql){const s=db.prepare(sql);return {args:[],bind(...a){this.args=a;return this},async first(){return s.get(...this.args)||null},async all(){return {results:s.all(...this.args)}},async run(){return {meta:s.run(...this.args)}}}},async batch(ss){db.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 const env={DB,ALLOWED_ORIGIN:'https://example.com'},call=(p,method='GET',body,auth=true)=>worker.fetch(new Request('https://api.example/api'+p,{method,headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}),env);

 const note={title:'振り返り対象',author:'ひなこ',theme:'その他',stage:'村',monster:'クモ',mission:'繭6個',victory:'救出',highlight:'',status:'確認待ち'};
 await call('/ideas','POST',note);const id=(await(await call('/ideas')).json()).items[0].id,p='/ideas/'+id+'/retrospective';
 const b={version:0,action:'draft',problem:'情報不足',resolution:'寸法を追記',oneoff:'',planning:'',script:'',map:'通行は通常プレーヤー基準',model:'',sharing:''};
 assert.equal((await call(p,'GET',undefined,false)).status,401);
 assert.equal((await call(p,'PUT',b)).status,200);
 assert.equal((await call(p,'PUT',b)).status,409);
 assert.equal((await call(p,'PUT',{...b,version:1,action:'share',sharing:'共有済み'})).status,409);
 assert.equal((await call(p,'PUT',{...b,version:1,action:'confirm'})).status,400);
 assert.equal((await call(p,'PUT',{...b,version:1,action:'confirm',approved:true})).status,200);
 assert.equal((await call(p,'PUT',{...b,version:2,action:'share',map:'確認後の変更',sharing:'受領済み'})).status,409);
 assert.equal((await call(p,'PUT',{...b,version:2,action:'share',sharing:'マップちゃん受領。制作ルール.mdへ保存確認'})).status,200);
 let d=await(await call(p)).json();assert.equal(d.current.state,'共有済み');assert.equal(d.history.length,3);
 assert.equal((await call(p,'PUT',{...b,version:3,action:'draft',map:'追加修正'})).status,200);
 d=await(await call(p)).json();assert.equal(d.current.state,'下書き');assert.equal(d.history.length,4);
 assert.equal((await(await call('/ideas')).json()).items[0].status,'確認待ち');db.close();
});
