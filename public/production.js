let productionData=null;
async function loadProduction(id){
 const host=$('#production-panel');host.innerHTML='<p>制作情報を読み込み中…</p>';
 try{const data=await api('/ideas/'+id+'/production');if(workflowId!==id)return;productionData=data;renderProduction(id);}
 catch(e){host.innerHTML='<p class="error">'+esc(e.message)+'</p>';}
}
function renderProduction(id){
 const d=productionData,p=d.current,host=$('#production-panel');
 const outputs=p?JSON.parse(p.outputs):{};
 host.innerHTML='<h3>AI制作の受け渡し</h3><p>台本 → マップ → モデル → ひなこの確認、の順で進めます。実行担当が受け取るまでは待機です。</p>'+
 (p?'<p><strong>'+esc(p.stage)+' · '+esc(p.state)+'</strong>／記録 '+p.version+'</p><p>'+esc(p.note)+'</p>'+(p.input_updated!==d.idea_updated?'<p class="error">企画が変更されています。古い制作結果は登録できません。</p>':''):'<p>企画を「検討中」にしてから制作を予約してください。</p>')+
 (!p?'<button type="button" data-production="start">この企画の制作を予約</button>':'')+
 (p&&!['停止','確認待ち'].includes(p.state)?'<button type="button" data-production="cancel">制作の受け渡しを停止</button><p class="muted">停止後は次工程へ進めません。実行中のAIへの停止連絡は別途必要です。</p>':'')+
 '<p id="production-error" class="error" role="alert"></p>'+
 Object.entries(outputs).map(([role,o])=>'<details><summary>'+esc(role)+'の成果物</summary><p class="production-text">'+esc(o.text)+'</p><p>保存先：'+esc(o.location||'この画面の台本')+'</p><p>ファイル検証済み／ゲーム内は未確認</p></details>').join('')+
 (p&&['待機','実行中'].includes(p.state)?'<details><summary>実行担当用：受領・結果登録</summary><form id="production-result"><label>受け渡し識別名<input name="dispatch_ref" maxlength="200" placeholder="チャット名と企画ID・記録番号"></label><label>台本本文／制作結果<textarea name="text" maxlength="20000"></textarea></label><label>成果物の保存先<input name="location" maxlength="2000"></label><label>報告・停止理由<textarea name="note" maxlength="2000"></textarea></label><label><input type="checkbox" name="verified">内容・完成ファイルを検証した（ゲーム内確認とは別）</label><div class="workflow-actions">'+(p.state==='待機'?'<button type="submit" value="claim">受け渡しを開始</button>':'<button type="submit" value="complete">成果物を保存して次へ</button><button type="submit" value="fail">失敗を記録して停止</button>')+'</div></form></details>':'')+
 (p?'<details><summary>制作履歴</summary><ol>'+d.history.map(h=>'<li>'+esc(h.stage)+' · '+esc(h.state)+' ／ '+esc(h.updated)+'<p>'+esc(h.note)+'</p></li>').join('')+'</ol></details>':'');
 host.querySelectorAll('[data-production]').forEach(b=>b.onclick=()=>saveProduction(id,b.dataset.production,{note:b.dataset.production==='cancel'?'メンバーが受け渡しを停止':''}));
 const form=$('#production-result');if(form)form.onsubmit=e=>{e.preventDefault();const b=Object.fromEntries(new FormData(form));saveProduction(id,e.submitter.value,{dispatch_ref:b.dispatch_ref,note:b.note,output:{text:b.text,location:b.location,verified:b.verified==='on'}});};
}
async function saveProduction(id,action,fields){
 $('#production-panel').querySelectorAll('button').forEach(b=>b.disabled=true);
 try{productionData=await api('/ideas/'+id+'/production','PUT',{version:productionData.current?.version||0,action,...fields});renderProduction(id);await refresh();await loadWorkflow();notice('制作の受け渡し情報を保存しました。');}
 catch(e){$('#production-error').textContent=e.message;$('#production-panel').querySelectorAll('button').forEach(b=>b.disabled=false);}
}

enter().catch(e=>{locked();if(!e.message.includes("合言葉を入力"))$("#login-error").textContent=e.message;});
