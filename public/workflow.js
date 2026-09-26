// Shared passphrase members record handoffs; this does not launch agents.
function workflowMatches(item){
 const a=$('#assignee-filter').value,r=$('#reviewer-filter').value,w=workflows[item.id];
 if(!workflowReady)return !a&&!r;
 return (!a||(a==='unassigned'?!w?.assignee:w?.assignee===a))&&(!r||(w?.state==='確認待ち'&&w.reviewer===r));
}
function workflowSummary(item){
 if(!workflowReady)return '<p class="workflow-summary">担当情報を読み込めませんでした</p>';
 const w=workflows[item.id];
 return '<div class="workflow-summary"><strong>'+esc(w?.state||'未着手')+'</strong> · 担当：'+esc(w?.assignee||'未割当')+(w?.state==='確認待ち'?'<br>確認待ち：'+esc(w.reviewer):'')+(w?.idea_updated&&w.idea_updated!==item.updated?'<br><span class="error">受け渡し後に企画が更新されています</span>':'')+'</div>';
}
async function openWorkflow(id){
 workflowId=id;workflowVersion=0;$('#workflow-title').textContent=items.find(x=>x.id===id)?.title||'';
 $('#workflow-form').reset();$('#workflow-error').textContent='';$('#workflow-history').replaceChildren();
 $('#workflow-dialog').showModal();await loadWorkflow();
}
async function loadWorkflow(){
 const id=workflowId;workflowLoading=true;$('#workflow-form [type=submit]').disabled=true;$('#workflow-reload').disabled=true;
 $('#workflow-error').textContent='';$('#workflow-stale').textContent='読み込み中…';
 try{
  const result=await api('/ideas/'+id+'/workflow');if(workflowId!==id)return;
  const w=result.current;workflowVersion=w.version;
  for(const key of ['assignee','reviewer','state'])$('#workflow-form').elements.namedItem(key).value=w[key];
  $('#workflow-form').elements.namedItem('memo').value='';
  $('#workflow-stale').textContent=w.idea_updated&&w.idea_updated!==result.idea_updated?'前回の受け渡し後に企画が更新されています。最新の本文・資料を確認してください。':'';
  $('#workflow-history').innerHTML=result.history.length?result.history.map(h=>'<li><strong>'+esc(h.state)+' · '+esc(h.assignee||'未割当')+'</strong>'+(h.reviewer?' ／ 確認先：'+esc(h.reviewer):'')+'<p>'+esc(h.memo)+'</p><small>'+esc(new Date(h.updated).toLocaleString('ja-JP'))+' · 記録 '+h.version+' · '+(h.actor_role==='owner'?'オーナー':'メンバー')+'</small></li>').join(''):'<li>まだ受け渡しの記録はありません。</li>';
  $('#workflow-form [type=submit]').disabled=false;
 }catch(e){$('#workflow-error').textContent=e.message;$('#workflow-stale').textContent='読み込みに失敗しました。最新情報を読み直してください。';}
 finally{workflowLoading=false;$('#workflow-reload').disabled=false;}
}
$('#workflow-detail').onclick=()=>{const id=selected?.id;if(id){$('#detail').close();openWorkflow(id);}};
$('#workflow-reload').onclick=()=>{if(!workflowLoading)loadWorkflow();};
for(const id of ['assignee-filter','reviewer-filter'])$('#'+id).onchange=render;
$('#workflow-form').onsubmit=async e=>{
 e.preventDefault();if(workflowLoading)return;
 const id=workflowId,form=$('#workflow-form'),button=form.querySelector('[type=submit]');
 button.disabled=true;$('#workflow-reload').disabled=true;$('#workflow-error').textContent='';workflowLoading=true;
 try{
  await api('/ideas/'+id+'/workflow','PUT',{...Object.fromEntries(new FormData(form)),version:workflowVersion});
  $('#workflow-dialog').close();await refresh();notice('担当・確認と受け渡し履歴を保存しました。');
 }catch(err){$('#workflow-error').textContent=err.message;}
 finally{workflowLoading=false;button.disabled=false;$('#workflow-reload').disabled=false;}
};

enter().catch(e=>{locked();if(!e.message.includes("合言葉を入力"))$("#login-error").textContent=e.message;});
