import test from "node:test";
import assert from "node:assert/strict";
import worker,{normalize,derive,equal,validateIdea} from "../src/worker.js";
const origin="https://owner.github.io";
function req(path,method="GET",body,token){
 return new Request("https://api.example/api"+path,{method,headers:{Origin:origin,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body?JSON.stringify(body):undefined});
}
test("日本語の濁点を正規化して同じ合言葉として照合",async()=>{
 assert.equal(normalize("か\u3099"),"が");
 assert.equal(await derive("か\u3099","salt"),await derive("が","salt"));
 assert.notEqual(await derive("が","salt"),await derive("が","other"));
 assert.equal(equal("abc","abd"),false);
});
test("必須項目と進捗を検証",()=>{
 const body={title:"鬼",author:"私",theme:"妖怪",stage:"村",monster:"天狗",mission:"風車",victory:"脱出",highlight:"",status:"アイデア"};
 assert.equal(validateIdea(body).title,"鬼");
 assert.throws(()=>validateIdea({...body,stage:""}));
 assert.throws(()=>validateIdea({...body,status:"invalid"}));
});
test("未認証の閲覧・投稿はデータベースを読まず拒否",async()=>{
 const env={DB:{prepare(){throw new Error("DB should not be read");}},ALLOWED_ORIGIN:origin};
 for(const method of ["GET","POST"]){
  const r=await worker.fetch(req("/ideas",method,method==="POST"?{}:undefined),env);
  assert.equal(r.status,401);
  assert.equal(r.headers.get("Cache-Control"),"no-store");
 }
});
test("許可していないサイトからの更新を拒否",async()=>{
 const r=await worker.fetch(new Request("https://api.example/api/passphrase",{method:"POST",headers:{Origin:"https://evil.example"}}),{DB:{},ALLOWED_ORIGIN:origin});
 assert.equal(r.status,403);assert.equal(r.headers.get("Access-Control-Allow-Origin"),null);
});
function memberDB(version){
 return {prepare(sql){return {bind(){return this;},async first(){return sql.includes("sessions")?{token:"hash",role:"member",version:"old",expires:Date.now()+10000}:{version};}}}};
}
test("参加者は合言葉変更を行えない",async()=>{
 const env={DB:memberDB("old"),ALLOWED_ORIGIN:origin};
 for(const [path,method] of [["/passphrase","POST"]]){
  const r=await worker.fetch(req(path,method,{}, "a".repeat(64)),env);
  assert.equal(r.status,403);
 }
});
test("合言葉変更前の参加者セッションを拒否",async()=>{
 const r=await worker.fetch(req("/ideas","GET",undefined,"a".repeat(64)),{DB:memberDB("new"),ALLOWED_ORIGIN:origin});
 assert.equal(r.status,401);
});
test("認証の試行回数制限",async()=>{
 const env={ALLOWED_ORIGIN:origin,DB:{prepare(){return {bind(){return this;},async run(){},async first(){return {count:11};}}}}};
 const r=await worker.fetch(req("/login","POST",{password:"wrong"}),env);
 assert.equal(r.status,429);
});

test("参加者が4種類の進捗で投稿・編集・削除でき、未認証では拒否される",async()=>{
 const calls=[];
 const db={prepare(sql){return {values:[],bind(...v){this.values=v;return this;},async first(){return sql.includes("sessions")?{role:"member",version:"v"}:{version:"v"};},async run(){calls.push({sql,values:this.values});return {meta:{changes:1}};}}}};
 const env={DB:db,ALLOWED_ORIGIN:origin};
 const body={title:"試験",author:"試験",theme:"",stage:"街",monster:"鬼",mission:"逃げる",victory:"脱出",highlight:""};
 for(const status of ["アイデア","検討中","制作中","撮影済み"]){
  for(const method of ["POST","PUT"]){
   const path=method==="POST"?"/ideas":"/ideas/00000000-0000-0000-0000-000000000000";
   const r=await worker.fetch(req(path,method,{...body,status},"a".repeat(64)),env);
   assert.equal(r.status,method==="POST"?201:200);
   assert.ok(calls.at(-1).values.includes(status));
  }
 }
 const path="/ideas/00000000-0000-0000-0000-000000000000";
 assert.equal((await worker.fetch(req(path,"DELETE",undefined,"a".repeat(64)),env)).status,200);
 for(const method of ["PUT","DELETE"])assert.equal((await worker.fetch(req(path,method,method==="PUT"?{...body,status:"アイデア"}:undefined),env)).status,401);
});

