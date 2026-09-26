// Authenticated, versioned production queue. A coordinator performs the actual AI dispatch.
const stages=['台本AI','マップAI','モデルAI'];
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function productionRoute(request,env,path,bodyOf){
 if(path==='/api/production'&&request.method==='GET')return {items:(await env.DB.prepare('SELECT p.*,i.title FROM production p JOIN ideas i ON i.id=p.idea_id ORDER BY p.updated').all()).results};
 const id=path.match(/^\/api\/ideas\/([a-f0-9-]{36})\/production$/)?.[1];
 if(!id||!['GET','PUT'].includes(request.method))return null;
 const idea=await env.DB.prepare('SELECT id,status,updated FROM ideas WHERE id=?').bind(id).first();
 if(!idea)fail('企画が見つかりません。',404);
 const current=await env.DB.prepare('SELECT * FROM production WHERE idea_id=?').bind(id).first();
 if(request.method==='PUT'){
  const b=await bodyOf(request);
  if(!Number.isSafeInteger(b.version)||b.version!==(current?.version||0))fail('制作情報が更新されています。読み直してください。',409);
  if(!['start','restart','claim','complete','fail','cancel'].includes(b.action))fail('操作を確認してください。');
  let stage=current?.stage||stages[0],state=current?.state,outputs=current?.outputs||'{}',ref=current?.dispatch_ref||'',note=b.note||'';
  if(typeof note!=='string'||note.length>2000)fail('メモは2000文字以内にしてください。');
  if(b.action==='start'){
   if(current)fail('この企画には制作記録があります。停止した制作の再開は担当者へ相談してください。',409);
   if(idea.status!=='検討中')fail('制作する企画を「検討中」にしてから開始してください。');
   state='待機';note='制作開始を受付。台本AIへの受け渡し待ち。';
  }else if(b.action==='restart'){
   if(!current||current.state!=='停止')fail('停止済みの制作だけを再開できます。',409);
   if(!note.trim())fail('再開理由を記入してください。');
   stage=stages[0];state='待機';outputs='{}';ref='';
  }else{
   if(!current)fail('制作を開始してください。',409);
   if(['確認待ち','停止'].includes(current.state))fail('この制作は終了または停止しています。',409);
   if(b.action!=='cancel'&&current.input_updated!==idea.updated)fail('制作開始後に企画が変更されました。制作を停止し、内容を確認してください。',409);
   if(b.action==='claim'){
    if(current.state!=='待機')fail('すでに受け渡し済みです。再送しないでください。',409);
    if(typeof b.dispatch_ref!=='string'||!b.dispatch_ref.trim()||b.dispatch_ref.length>200)fail('受け渡しの識別名を記入してください。');
    if(await env.DB.prepare("SELECT idea_id FROM production WHERE state='実行中'").first())fail('別の制作が実行中です。完了を待ってください。',409);
    state='実行中';ref=b.dispatch_ref.trim();
   }else if(b.action==='complete'){
    if(current.state!=='実行中')fail('実行中の制作だけ完了できます。',409);
    if(!b.output||typeof b.output.text!=='string'||!b.output.text.trim()||b.output.text.length>20000||typeof b.output.location!=='string'||b.output.location.length>2000||b.output.verified!==true)fail('成果物とファイル検証の結果を登録してください。');
    if(stage!=='台本AI'&&!b.output.location.trim())fail('完成ファイルの保存先が必要です。');
    const results=JSON.parse(outputs);results[stage]={text:b.output.text.trim(),location:b.output.location.trim(),verified:true,game_verified:false,updated:new Date().toISOString()};outputs=JSON.stringify(results);
    const next=stages.indexOf(stage)+1;stage=stages[next]||stage;state=next<stages.length?'待機':'確認待ち';ref='';
   }else{state='停止';if(!note.trim())fail('停止理由を記入してください。');}
  }
  const now=new Date().toISOString();
  if(!current){
   const r=await env.DB.prepare("INSERT OR IGNORE INTO production(idea_id,version,stage,state,input_updated,outputs,note,dispatch_ref,updated) SELECT id,1,?,?,?,?,?,?,? FROM ideas WHERE id=? AND updated=? AND status='検討中'").bind(stage,state,idea.updated,outputs,note,ref,now,id,idea.updated).run();
   if(!r.meta.changes)fail('制作開始が競合しました。読み直してください。',409);
  }else{
   // Conditional write prevents stale completions and double dispatch, including concurrent requests.
   try{
    const r=await env.DB.prepare('UPDATE production SET version=version+1,stage=?,state=?,outputs=?,note=?,dispatch_ref=?,updated=?,input_updated=? WHERE idea_id=? AND version=? AND EXISTS(SELECT 1 FROM ideas WHERE id=? AND updated=?)').bind(stage,state,outputs,note,ref,now,b.action==='restart'?idea.updated:current.input_updated,id,b.version,id,idea.updated).run();
    if(!r.meta.changes)fail('制作情報または企画が更新されています。読み直してください。',409);
   }catch(e){if(String(e.message).includes('UNIQUE'))fail('別の制作が実行中です。',409);throw e;}
  }
 }
 const row=await env.DB.prepare('SELECT * FROM production WHERE idea_id=?').bind(id).first();
 return {current:row,history:(await env.DB.prepare('SELECT * FROM production_history WHERE idea_id=? ORDER BY version DESC LIMIT 30').bind(id).all()).results,idea_updated:idea.updated};
}
