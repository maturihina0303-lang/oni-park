const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function validateRetrospective(b){
 if(!Number.isSafeInteger(b.version)||b.version<0)fail('記録番号を確認してください。');
 if(!['draft','confirm','share'].includes(b.action))fail('操作を確認してください。');
 const content={};
 for(const key of ['problem','resolution','oneoff','planning','script','map','model','sharing']){
  if(typeof b[key]!=='string'||b[key].length>6000)fail('各欄は6000文字以内で入力してください。');
  content[key]=b[key].trim();
 }
 if(!content.problem&&!content.resolution)fail('問題点または最終的な修正を記入してください。');
 if(b.action==='confirm'&&b.approved!==true)fail('制作・修正の完了と、ひなこの内容確認が必要です。');
 if(b.action==='share'&&!content.sharing)fail('共有先・確認結果・ルール保存先を記録してください。');
 return content;
}
export async function retrospectiveRoute(request,env,path,bodyOf){
 const id=path.match(/^\/api\/ideas\/([a-f0-9-]{36})\/retrospective$/)?.[1];
 if(!id||!['GET','PUT'].includes(request.method))return null;
 if(!await env.DB.prepare('SELECT id FROM ideas WHERE id=?').bind(id).first())fail('企画が見つかりません。',404);
 const current=await env.DB.prepare('SELECT * FROM retrospective WHERE idea_id=?').bind(id).first();
 if(request.method==='PUT'){
  const b=await bodyOf(request),content=validateRetrospective(b);
  if(b.version!==(current?.version||0))fail('振り返りが更新されています。読み直してください。',409);
  if(b.action==='share'){
   if(current?.state!=='確認済み')fail('内容を確認済みにしてから共有してください。',409);
   const old=JSON.parse(current.content);
   if(Object.keys(content).some(k=>k!=='sharing'&&content[k]!==old[k]))fail('内容が変わったため、下書き保存して再確認してください。',409);
  }
  const state={draft:'下書き',confirm:'確認済み',share:'共有済み'}[b.action],now=new Date().toISOString();
  const r=current?await env.DB.prepare('UPDATE retrospective SET version=version+1,state=?,content=?,updated=? WHERE idea_id=? AND version=?').bind(state,JSON.stringify(content),now,id,b.version).run():await env.DB.prepare('INSERT OR IGNORE INTO retrospective VALUES(?,1,?,?,?)').bind(id,state,JSON.stringify(content),now).run();
  if(!r.meta.changes)fail('振り返りが更新されています。読み直してください。',409);
 }
 return {current:await env.DB.prepare('SELECT * FROM retrospective WHERE idea_id=?').bind(id).first(),history:(await env.DB.prepare('SELECT * FROM retrospective_history WHERE idea_id=? ORDER BY version DESC LIMIT 30').bind(id).all()).results};
}
