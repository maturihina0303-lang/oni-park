let retrospectiveData=null;
const retroFields={problem:'困った点・前の担当に欲しかった情報',resolution:'最終的にどう直したか',oneoff:'今回だけの変更',planning:'次回のルール：企画ちゃんへ',script:'次回のルール：台本ちゃんへ',map:'次回のルール：マップちゃんへ',model:'次回のルール：モデルちゃんへ',sharing:'共有記録（宛先・確認結果・ルールファイルの保存先）'};
async function loadRetrospective(id){
 const host=$('#retrospective-panel');host.innerHTML='<p>振り返りを読み込み中…</p>';
 try{const d=await api('/ideas/'+id+'/retrospective');if(workflowId!==id)return;retrospectiveData=d;renderRetrospective(id);}
 catch(e){if(workflowId===id)host.innerHTML='<p class="error">'+esc(e.message)+'</p>';}
}
function renderRetrospective(id){
 const d=retrospectiveData,c=d.current,values=c?JSON.parse(c.content):{},host=$('#retrospective-panel');
 host.innerHTML='<h3>制作後の振り返り</h3><p>制作とひなこからの修正がすべて終わったら、企画ちゃんへ「修正完了。フィードバックをまとめて」と伝えてください。</p><p>下書き → ひなこの内容確認 → 各担当へ共有 → 各担当のルールファイルへ保存、の順で進めます。</p><p><strong>'+esc(c?.state||'未記入')+'</strong> ／ 記録 '+(c?.version||0)+'</p><details><summary>振り返りを記入・確認する</summary><form id="retrospective-form">'+Object.entries(retroFields).map(([key,label])=>'<label>'+label+'<textarea name="'+key+'" maxlength="6000">'+esc(values[key]||'')+'</textarea></label>').join('')+'<label><input type="checkbox" name="approved">制作と修正がすべて完了し、この内容をひなこが確認済み</label><p>保存だけではAIへ送信されません。確認後、企画ちゃんが各担当へ伝え、保存されたルールを確認して共有記録を残します。内容を変更した場合は、再確認してください。</p><div class="workflow-actions"><button type="submit" value="draft">下書きを保存</button><button type="submit" value="confirm">確認済みとして保存</button>'+(c?.state==='確認済み'?'<button type="submit" value="share">共有完了を記録</button>':'')+'</div><p id="retrospective-error" role="alert" class="error"></p></form></details><details><summary>振り返りの履歴</summary>'+d.history.map(h=>'<details><summary>記録 '+h.version+' · '+esc(h.state)+' · '+esc(h.updated)+'</summary>'+Object.entries(JSON.parse(h.content)).map(([k,v])=>'<h4>'+esc(retroFields[k])+'</h4><p style="white-space:pre-wrap">'+esc(v)+'</p>').join('')+'</details>').join('')+'</details>';
 $('#retrospective-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,b=Object.fromEntries(new FormData(form));form.querySelectorAll('button').forEach(x=>x.disabled=true);
  try{const result=await api('/ideas/'+id+'/retrospective','PUT',{...b,approved:b.approved==='on',version:c?.version||0,action:e.submitter.value});if(workflowId!==id)return;retrospectiveData=result;renderRetrospective(id);notice('振り返りを保存しました。');}
  catch(err){if(workflowId===id){$('#retrospective-error').textContent=err.message;form.querySelectorAll('button').forEach(x=>x.disabled=false);}}
 };
}
