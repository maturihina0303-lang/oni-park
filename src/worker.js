const encoder = new TextEncoder();
export const normalize = s => s.normalize("NFC");
export async function digest(s) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(s))); }
const hex = buffer => [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,"0")).join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function derive(s,salt) {
  const key=await crypto.subtle.importKey("raw",encoder.encode(normalize(s)),"PBKDF2",false,["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt:encoder.encode(salt),iterations:100000,hash:"SHA-256"},key,256));
}
export function equal(a,b) { if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0; }
function response(data,status=200,headers={}) { return Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}}); }
function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
const statuses=["アイデア","検討中","マップ制作中","モデル制作中","確認待ち","撮影済み"];
export function validateIdea(body) {
 const limits={title:100,author:40,theme:40,stage:1000,monster:2000,mission:3000,victory:1000,highlight:6000};
 const item={};
 for(const [key,max] of Object.entries(limits)) {
  if(typeof body[key]!=="string")fail("入力内容を確認してください。");
  item[key]=body[key].trim();
  if(item[key].length>max)fail("入力が長すぎます。");
 }
 for(const key of ["title","author","stage","monster","victory"])if(!item[key])fail("必須項目を入力してください。");
 if(!statuses.includes(body.status))fail("進捗を選択してください。");
 if(body.runner!==undefined){
  if(typeof body.runner!=="string"||body.runner.length>2000)fail("逃げ側の設定は2000文字以内で入力してください。");
  item.runner=body.runner.trim();
 }
 item.status=body.status; return item;
}
export function validateImages(body,limit=180000) {
 const images={};
 for(const key of ['stage_image','monster_image','runner_image','mission_image']) {
  if(body[key]===undefined)continue;
  const value=body[key];
  if(typeof value!=="string" || value.length>limit || (value && !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)))fail("画像を選び直してください。画像が大きすぎるか、形式が対応していません。");
  images[key]=value;
 }
 return images;
}
export function validateReferences(value) {
 if(value===undefined)return undefined;
 if(!value||typeof value!=="object"||Array.isArray(value))fail("制作資料を確認してください。");
 const output={};
 for(const kind of ['stage','monster','runner','mission']){
  const section=value[kind];
  if(!section||typeof section.brief!=="string"||section.brief.length>3000||!Array.isArray(section.images)||section.images.length>6)fail("各資料は画像6枚・制作条件3000文字以内にしてください。");
  output[kind]={brief:section.brief.trim(),images:section.images.map(img=>{
   if(!img||typeof img!=="object")fail("画像を確認してください。");
   if(!img.data)fail("画像を選択してください。");
   validateImages({stage_image:img.data},300000);
   if(!['設計図','三面図','雰囲気','全体図','外観','内装','動線','正面','側面','背面','細部'].includes(img.view))fail("画像の用途を選んでください。");
   if(typeof img.note!=="string"||img.note.length>1000||typeof img.source!=="string"||img.source.length>2000)fail("画像の説明が長すぎます。");
   const source=img.source.trim();
   if(source&&!/^https?:\/\//i.test(source))fail("出典URLはhttpまたはhttpsで入力してください。");
   if(source){try{new URL(source);}catch{fail("出典URLを確認してください。");}}
   return {data:img.data,view:img.view,note:img.note.trim(),source};
  })};
 }
 return output;
}
async function bodyOf(request) {
 if(!request.headers.get("content-type")?.includes("application/json"))fail("JSON形式で送信してください。",415);
 const text=await request.text();if(text.length>(new URL(request.url).pathname.startsWith("/api/ideas")?7500000:16000))fail("入力が大きすぎます。",413);
 try{return JSON.parse(text)}catch{fail("入力を読み取れませんでした。");}
}
async function setting(env) {return env.DB.prepare("SELECT * FROM settings WHERE id=1").first();}
async function session(request,env) {
 const token=request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token)return null;
 const s=await env.DB.prepare("SELECT * FROM sessions WHERE token=? AND expires>?").bind(await digest(token),Date.now()).first();
 if(!s)return null;
 if(s.role==="owner") {
  if(!env.OWNER_PASSWORD||s.version!==await digest(normalize(env.OWNER_PASSWORD)))return null;
 } else {const cfg=await setting(env);if(!cfg||cfg.version!==s.version)return null;}
 return s;
}
function cookie(token,seconds) {return "oni_session="+token+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+seconds;}
async function api(request,env,path) {
 if(!env.DB)fail("データベースの設定が必要です。",503);
 if(!["GET","HEAD"].includes(request.method)&&request.headers.get("origin")!==env.ALLOWED_ORIGIN)fail("この操作は許可されていません。",403);
 if(path==="/api/login"&&request.method==="POST"){
  const body=await bodyOf(request);
  if(typeof body.password!=="string"||!body.password.length)fail("合言葉を確認してください。");
  const role=body.role==="owner"?"owner":"member",now=Date.now();
  const key=await digest((request.headers.get("CF-Connecting-IP")||"local")+":"+role);
  await env.DB.prepare("DELETE FROM attempts WHERE expires<?").bind(now).run();
  const attempt=await env.DB.prepare("INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key,now+15*60*1000).first();
  if(attempt.count>10)fail("入力回数が多いため、15分後にお試しください。",429);
  let version;
  if(role==="owner"){
   if(!env.OWNER_PASSWORD)fail("オーナーの初期設定が必要です。",503);
   if(!equal(await digest(normalize(body.password)),await digest(normalize(env.OWNER_PASSWORD))))fail("パスワードが違います。",401);
   version=await digest(normalize(env.OWNER_PASSWORD));
  }else{
   const cfg=await setting(env);if(!cfg)fail("オーナーが合言葉を設定するまでお待ちください。",503);
   if(!equal(await derive(body.password,cfg.salt),cfg.hash))fail("合言葉が違います。",401);
   version=cfg.version;
  }
  const token=random(),seconds=role==="owner"?3600:7*86400;
  await env.DB.batch([
   env.DB.prepare("DELETE FROM sessions WHERE expires<?").bind(now),
   env.DB.prepare("DELETE FROM attempts WHERE key=?").bind(key),
   env.DB.prepare("INSERT INTO sessions VALUES(?,?,?,?)").bind(await digest(token),role,version,now+seconds*1000)
  ]);
  return response({role,token});
 }
 const s=await session(request,env);
 if(!s)fail("合言葉を入力して入園してください。",401);
 if(path==="/api/me"&&request.method==="GET")return response({role:s.role});
 if(path==="/api/logout"&&request.method==="POST"){
  await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(s.token).run();
  return response({ok:true});
 }
 if(path==="/api/passphrase"&&request.method==="POST"){
  if(s.role!=="owner")fail("オーナーだけが変更できます。",403);
  const b=await bodyOf(request);
  if(typeof b.password!=="string"||!b.password.length)fail("合言葉を入力してください。");
  if(equal(await digest(normalize(b.password)),await digest(normalize(env.OWNER_PASSWORD))))fail("オーナーパスワードとは別の合言葉を設定してください。");
  const salt=random(),hash=await derive(b.password,salt);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO settings VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,salt=excluded.salt,version=excluded.version").bind(hash,salt,random()),
   env.DB.prepare("DELETE FROM sessions WHERE role='member'")
  ]);
  return response({ok:true});
 }
 if(path==="/api/ideas"&&request.method==="GET"){
  const result=await env.DB.prepare("SELECT id,title,author,theme,stage,monster,mission,victory,highlight,status,runner,created,updated FROM ideas ORDER BY updated DESC").all();
  return response({items:result.results});
 }
 const imageId=path.match(/^\/api\/ideas\/([a-f0-9-]{36})\/images$/)?.[1];
 if(imageId&&request.method==="GET"){
  const images=await env.DB.prepare("SELECT stage_image,monster_image,runner_image,mission_image FROM ideas WHERE id=?").bind(imageId).first();
  if(!images)fail("企画が見つかりません。",404);
  const refs=await env.DB.prepare("SELECT kind,content FROM idea_references WHERE idea_id=?").bind(imageId).all();
  return response({images,references:Object.fromEntries(refs.results.map(r=>[r.kind,JSON.parse(r.content)]))});
 }
 const id=path.match(/^\/api\/ideas\/([a-f0-9-]{36})$/)?.[1];
 if((path==="/api/ideas"&&request.method==="POST")||(id&&request.method==="PUT")){

  const body=await bodyOf(request),item=validateIdea(body),extras={...validateImages(body),...(item.runner!==undefined?{runner:item.runner}:{})},now=new Date().toISOString();
  const references=validateReferences(body.references);
  const extraKeys=Object.keys(extras),extraValues=Object.values(extras);

  const vals=[item.title,item.author,item.theme,item.stage,item.monster,item.mission,item.victory,item.highlight,item.status];
  const ideaId=id||crypto.randomUUID();
  const statement=id?env.DB.prepare(`UPDATE ideas SET title=?,author=?,theme=?,stage=?,monster=?,mission=?,victory=?,highlight=?,status=?,updated=?${extraKeys.map(k=>","+k+"=?").join("")} WHERE id=?`).bind(...vals,now,...extraValues,id):env.DB.prepare(`INSERT INTO ideas (id,title,author,theme,stage,monster,mission,victory,highlight,status,created,updated${extraKeys.map(k=>","+k).join("")}) VALUES (${Array(12+extraKeys.length).fill("?").join(",")})`).bind(ideaId,...vals,now,now,...extraValues);
  if(references){
   if(id&&!await env.DB.prepare("SELECT id FROM ideas WHERE id=?").bind(id).first())fail("企画が見つかりません。",404);
   await env.DB.batch([statement,...Object.entries(references).map(([kind,content])=>env.DB.prepare("INSERT INTO idea_references (idea_id,kind,content) VALUES (?,?,?) ON CONFLICT(idea_id,kind) DO UPDATE SET content=excluded.content").bind(ideaId,kind,JSON.stringify(content)))]);
  }else{
   const result=await statement.run();if(id&&!result.meta.changes)fail("企画が見つかりません。",404);
  }
  return response({ok:true},id?200:201);
 }
 if(id&&request.method==="DELETE"){

  await env.DB.prepare("DELETE FROM ideas WHERE id=?").bind(id).run();return response({ok:true});
 }
 fail("ページが見つかりません。",404);
}
export default {async fetch(request,env){
 let res;
 try {
  const path=new URL(request.url).pathname;
  if(request.method==="OPTIONS"){
    if(request.headers.get("origin")!==env.ALLOWED_ORIGIN)fail("この操作は許可されていません。",403);
    res=new Response(null,{status:204});
   }else res=path.startsWith("/api/")?await api(request,env,path):response({error:"Not found"},404);
 } catch(e){res=response({error:e.status?e.message:"処理に失敗しました。時間をおいてお試しください。"},e.status||500);}
 const out=new Response(res.body,res);
 if(request.headers.get("origin")===env.ALLOWED_ORIGIN){
  out.headers.set("Access-Control-Allow-Origin",env.ALLOWED_ORIGIN);
  out.headers.set("Access-Control-Allow-Headers","Content-Type, Authorization");
  out.headers.set("Access-Control-Allow-Methods","GET, POST, PUT, DELETE, OPTIONS");
  out.headers.set("Vary","Origin");
 }
 out.headers.set("X-Content-Type-Options","nosniff");
 out.headers.set("Referrer-Policy","same-origin");
 out.headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 return out;
}};
