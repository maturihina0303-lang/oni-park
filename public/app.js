const $=s=>document.querySelector(s);
let token=sessionStorage.getItem("oni-park-session")||"";
let workflows={},workflowReady=false,workflowId=null,workflowVersion=0,workflowLoading=false;
let role="",ownerMode=false,items=[],selected=null,editing=null,activeStatus="";
const genres=["金ロー","新作映画","ゲーム","アニメ","オリジナルホラー","その他"];
const genreOf = value => genres.includes(value)?value:"その他";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(text){$("#notice").textContent=text;$("#notice").hidden=false;setTimeout(()=>$("#notice").hidden=true,4500);}
function locked(){token="";sessionStorage.removeItem("oni-park-session");role="";items=[];$("#cards").replaceChildren();$("#detail-content").replaceChildren();$("#park").hidden=true;$("#account").hidden=true;$("#gate").hidden=false;document.querySelectorAll("dialog[open]").forEach(d=>d.close());}
async function api(path,method="GET",body){
 const base=window.PARK_CONFIG?.API_URL?.replace(/\/$/,"");
 if(!base)throw new Error("公開準備中です。オーナーによる接続設定をお待ちください。");
 const headers={};if(body)headers["Content-Type"]="application/json";if(token)headers.Authorization="Bearer "+token;
 const r=await fetch(base+"/api"+path,{method,headers,body:body?JSON.stringify(body):undefined});
 const data=await r.json();
 if(!r.ok){if(r.status===401&&path!=="/login")locked();throw new Error(data.error||"処理に失敗しました。");}
 return data;
}
async function enter(){
 const me=await api("/me");role=me.role;
 $("#gate").hidden=true;$("#park").hidden=false;$("#account").hidden=false;
 $("#role").textContent=role==="owner"?"オーナー":"メンバー";$("#settings").hidden=role!=="owner";
 await refresh();
}
async function refresh(){
 const [ideas,flow]=await Promise.all([api("/ideas"),api("/workflows").catch(e=>{notice("担当情報を読み込めませんでした。"+e.message);return null;})]);
 items=ideas.items;workflowReady=!!flow;workflows=Object.fromEntries((flow?.items||[]).map(x=>[x.idea_id,x]));
 render();
}
const statusClass = s => ({"アイデア":"idea","検討中":"review","確認待ち":"production","マップ制作中":"map","モデル制作中":"model","撮影済み":"done"}[s]||"idea");
function render(){
 const q=$("#search").value.toLocaleLowerCase(),status=activeStatus,theme=$("#theme").value;
 const filtered=items.filter(x=>workflowMatches(x)&&(!status||x.status===status)&&(!theme||genreOf(x.theme)===theme)&&[x.title,x.author,x.theme,x.stage,x.monster,x.runner,x.mission,x.victory,x.highlight].join(" ").toLocaleLowerCase().includes(q));
 $("#count").textContent=filtered.length+" 件";
 $("#empty").hidden=filtered.length!==0;
 $("#empty h2").textContent=items.length?"条件に合う企画がありません":"ここから、企画を育てよう。";
 $("#empty p").textContent=items.length?"キーワードや絞り込みを変えてみてください。":"「企画を投稿」から自分の案や、提案してもらった案を残せます。";
 $("#cards").innerHTML=filtered.map(x=>'<article class="note-card status-'+statusClass(x.status)+'"><div class="note-top"><span class="tag">'+esc(x.status)+'</span><span class="note-theme">'+esc(genreOf(x.theme))+'</span></div><button class="note-open" data-id="'+x.id+'"><h3>'+esc(x.title)+'</h3><span class="note-label">【最終目的】</span><p>'+esc(x.victory)+'</p></button>'+workflowSummary(x)+'<div class="note-meta"><span>'+esc(x.author)+'</span><span>'+new Date(x.updated).toLocaleDateString("ja-JP")+'</span></div><div class="note-actions"><button data-id="'+x.id+'">詳細を見る</button><button data-id="'+x.id+'" data-action="workflow">担当管理</button><button data-id="'+x.id+'" data-action="edit">編集</button><button data-id="'+x.id+'" data-action="delete" class="danger">削除</button></div></article>').join("");
}
async function showDetail(id){
 selected=items.find(x=>x.id===id);if(!selected)return;
 $("#detail-content").innerHTML='<h2>'+esc(selected.title)+'</h2><span class="tag status-'+statusClass(selected.status)+'">'+esc(selected.status)+'</span><p class="muted">'+esc(selected.author)+' ・ '+esc(genreOf(selected.theme))+'</p>'+[["stage","【マップ】"],["monster","【鬼】"],["runner","【逃げ側】"],["mission","【隠しアイテム】"],["victory","【最終目的】"],["highlight","【制作メモ】"]].map(([k,t])=>'<h3>'+t+'</h3><p>'+esc(selected[k]||"未記入")+'</p>'+(['stage','monster','runner','mission'].includes(k)?'<div data-detail-image="'+k+'_image"></div>':'')).join("");
 $("#export-references").disabled=true;detailReferences=null;$("#detail-actions").hidden=false;$("#detail").showModal();
 try{
  const payload=await api("/ideas/"+id+"/images");
  if(selected?.id!==id)return;
  detailReferences=referenceSections(payload);
  for(const [kind,section] of Object.entries(detailReferences))renderReferenceDetail(kind,section);
  $("#export-references").disabled=false;
 }catch(e){notice("画像を読み込めませんでした。"+e.message);}

}
async function openEditor(item=null){
 let payload={};
 try{if(item)payload=await api("/ideas/"+item.id+"/images");}catch(e){notice(e.message);return;}
 editing=item?.id||null;$("#idea-form").reset();$("#editor-error").textContent="";
 $("#editor-title").textContent=item?"企画を編集":"新しい企画";
 $("#edit-status").hidden=false;
 if(item)for(const el of $("#idea-form").elements)if(el.name&&item[el.name]!==undefined)el.value=el.name==="theme"?genreOf(item.theme):item[el.name];
 resetReferences(referenceSections(payload));
 $("#editor").showModal();
}
$("#owner-toggle").onclick=()=>{
 ownerMode=!ownerMode;
 $("#owner-toggle").textContent=ownerMode?"合言葉で入園に戻る":"オーナーとしてログイン";
 $("#password-label").textContent=ownerMode?"オーナーパスワード":"合言葉";
 $("#password").type=ownerMode?"password":"text";$("#password").value="";
 $("#password").placeholder=ownerMode?"オーナー専用パスワード":"合言葉（かな入力OK）";
 $("#login-help").textContent=ownerMode?"初期設定で登録したオーナーパスワードを入力してください。":"合言葉を入力してください。";
 $("#login-error").textContent="";
};
function handleForm(selector,errorSelector,fn){
 const form=$(selector);
 form.addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.isComposing||e.keyCode===229))e.preventDefault();});
 form.onsubmit=async e=>{
  e.preventDefault();const b=form.querySelector('[type="submit"]');b.disabled=true;$(errorSelector).textContent="";
  try{await fn(new FormData(form));}catch(err){$(errorSelector).textContent=err.message;}finally{b.disabled=false;}
 };
}
handleForm("#login","#login-error",async()=>{
 const auth=await api("/login","POST",{role:ownerMode?"owner":"member",password:$("#password").value});token=auth.token;sessionStorage.setItem("oni-park-session",token);$("#password").value="";await enter();
});
handleForm("#idea-form","#editor-error",async data=>{
 await api(editing?"/ideas/"+editing:"/ideas",editing?"PUT":"POST",{...Object.fromEntries(data),references:await collectReferences()});
 $("#editor").close();await refresh();notice("企画を保存しました。");
});
handleForm("#pass-form","#owner-error",async data=>{
 if(data.get("password").normalize("NFC")!==data.get("confirm").normalize("NFC"))throw new Error("確認用の合言葉が一致しません。");
 await api("/passphrase","POST",{password:data.get("password")});$("#pass-form").reset();$("#owner").close();notice("合言葉を変更しました。参加者に新しい合言葉を伝えてください。");
});
$("#new").onclick=()=>openEditor();
$("#settings").onclick=()=>{$("#owner-error").textContent="";$("#owner").showModal();};
$("#logout").onclick=async()=>{try{await api("/logout","POST",{});locked();}catch(e){notice(e.message);}};
$("#cards").onclick=e=>{const card=e.target.closest("[data-id]");if(!card)return; const item=items.find(x=>x.id===card.dataset.id); if(card.dataset.action==="workflow")openWorkflow(item.id);else if(card.dataset.action==="edit")openEditor(item);else if(card.dataset.action==="delete"){selected=item;$("#delete").click();}else showDetail(card.dataset.id);};
$("#edit").onclick=()=>{$("#detail").close();openEditor(selected);};
$("#delete").onclick=async()=>{
 if(!confirm("「"+selected.title+"」を削除しますか？ この操作は取り消せません。"))return;
 try{await api("/ideas/"+selected.id,"DELETE");$("#detail").close();await refresh();notice("企画を削除しました。");}catch(e){notice(e.message);}
};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
$("#status-filters").onclick=e=>{const button=e.target.closest("[data-status]");if(!button)return;activeStatus=button.dataset.status;document.querySelectorAll("[data-status]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));render();};
for(const id of ["search","theme"])$("#"+id).addEventListener(id==="search"?"input":"change",render);


const referenceConfig={
 stage:{label:'マップ',views:['設計図','全体図','外観','内装','動線','雰囲気'],needed:['全体図','外観','内装','動線'],hint:'Minecraftの建築画像を優先。全体の配置・建物・内部・逃走経路が分かる資料をそろえます。',placeholder:'例：Java 1.21.1 / Fabric、300×300ブロック。入口・出口、主要施設、鬼が通れる幅と高さ、隠しアイテム6つの候補位置。未定の寸法は「未定」と記入。'},
 monster:{label:'鬼',views:['三面図','正面','側面','背面','細部','雰囲気'],needed:['正面','側面','背面'],hint:'1体の全身と正面・側面・背面が分かる資料。角張った形やBlockbenchの見本を優先。',placeholder:'身長・最大幅・色・持ち物・背面の形。見た目と当たり判定は分けて記入。資料にない部分は未定と明記。'},
 runner:{label:'逃げ側',views:['三面図','正面','側面','背面','細部','雰囲気'],needed:['正面','側面','背面'],hint:'ノーマルなら画像は不要。姿を変える場合に全身と各方向の資料を追加します。',placeholder:'ノーマルなら普段の姿。変更する場合は服装・体格・色・背面・持ち物。'},
 mission:{label:'アイテム',views:['全体図','正面','側面','背面','細部','雰囲気'],needed:['全体図','細部'],hint:'6つのアイテムの名前・形・色の違いが分かる資料。集合画像も使えます。',placeholder:'6種類の見分け方、サイズ、設置状態、手に持つか、モデルの使用先。'}
};
let referenceState={},detailReferences=null;
function referenceSections(payload){
 return Object.fromEntries(Object.keys(referenceConfig).map(kind=>[kind,payload.references?.[kind]||{brief:'',images:payload.images?.[kind+'_image']?[{data:payload.images[kind+'_image'],view:'雰囲気',note:'以前の参考画像。寸法や見えない面は未確認。既存の出典は制作メモを参照。',source:''}]:[]}]));
}
function resetReferences(sections){
 for(const section of Object.values(referenceState))for(const img of section.images)if(img.url)URL.revokeObjectURL(img.url);
 referenceState=structuredClone(sections);
 for(const kind of Object.keys(referenceConfig))renderReferenceEditor(kind);
}
function renderReferenceEditor(kind){
 const config=referenceConfig[kind],section=referenceState[kind],root=document.querySelector('[data-reference-kind="'+kind+'"]');
 root.innerHTML='<h3>'+config.label+'の制作資料 <small>'+section.images.length+'/6枚</small></h3><p class="muted">'+config.hint+'</p><label>制作条件・未確定の点<textarea class="reference-brief" maxlength="3000" placeholder="'+esc(config.placeholder)+'">'+esc(section.brief)+'</textarea></label><div class="reference-edit-list"></div><label class="reference-add">画像を追加（複数選択可）<input type="file" multiple accept="image/png,image/jpeg,image/webp" '+(section.images.length>=6?'disabled':'')+'></label><p class="muted">PNG・JPEG・WebP、1枚20MBまで。保存時に縮小します。</p>';
 root.querySelector('.reference-brief').oninput=e=>section.brief=e.target.value;
 const list=root.querySelector('.reference-edit-list');
 section.images.forEach((img,index)=>{
  const entry=document.createElement('div');entry.className='reference-edit-entry';
  entry.innerHTML='<img alt="'+config.label+'の資料'+(index+1)+'"><label>画像の用途<select>'+config.views.map(v=>'<option '+(v===img.view?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label>参考にする点・作者・利用条件<textarea maxlength="1000" placeholder="例：通路の配置を参考にする。背面は別画像。">'+esc(img.note)+'</textarea></label><label>出典URL<input type="url" maxlength="2000" placeholder="https://…" value="'+esc(img.source)+'"></label><div class="reference-controls"><button type="button" class="ref-up" '+(index===0?'disabled':'')+'>前へ</button><button type="button" class="ref-remove">この画像を外す</button></div>';
  entry.querySelector('img').src=img.url||img.data;
  entry.querySelector('select').onchange=e=>img.view=e.target.value;
  entry.querySelector('textarea').oninput=e=>img.note=e.target.value;
  entry.querySelector('input').oninput=e=>img.source=e.target.value;
  entry.querySelector('.ref-remove').onclick=()=>{if(img.url)URL.revokeObjectURL(img.url);section.images.splice(index,1);renderReferenceEditor(kind);};
  entry.querySelector('.ref-up').onclick=()=>{[section.images[index-1],section.images[index]]=[section.images[index],section.images[index-1]];renderReferenceEditor(kind);};
  list.append(entry);
 });
 root.querySelector('[type=file]').onchange=e=>{
  const files=[...e.target.files];
  if(files.length+section.images.length>6){notice('各欄の画像は6枚までです。');e.target.value='';return;}
  if(files.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>20*1024*1024)){notice('20MB以下のPNG・JPEG・WebP画像を選んでください。');e.target.value='';return;}
  for(const file of files)section.images.push({file,url:URL.createObjectURL(file),data:'',view:'雰囲気',note:'',source:''});
  renderReferenceEditor(kind);
 };
}
async function collectReferences(){
 const output={};
 for(const [kind,section] of Object.entries(referenceState)){
  output[kind]={brief:section.brief,images:[]};
  for(const ref of section.images){
   let data=ref.data;
   if(ref.file){
    const img=new Image();img.src=ref.url;
    try{await img.decode();}catch{throw new Error(referenceConfig[kind].label+'の画像を読み取れません。画像を選び直してください。');}
    const canvas=document.createElement('canvas');
    for(let size=1600;size>=300;size=Math.floor(size*.75)){
     const scale=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',.85);if(data.length<=300000)break;
    }
    if(data.length>300000)throw new Error('画像を小さくして選び直してください。');
   }
   output[kind].images.push({data,view:ref.view,note:ref.note,source:ref.source});
  }
 }
 return output;
}
function referenceSummary(kind,section,runner){
 if(kind==='runner'&&runner?.trim()==='ノーマル')return 'ノーマルのため、追加モデルの参考画像は不要です。';
 const combined=section.images.some(img=>kind==='stage'?img.view==='設計図':['monster','runner'].includes(kind)&&img.view==='三面図');
 const missing=combined?[]:referenceConfig[kind].needed.filter(v=>!section.images.some(img=>img.view===v));
 return (missing.length?'あると作りやすい資料：'+missing.join('・'):'各方向の資料が登録されています。')+(!section.brief?' 制作条件は未記入です。':'')+' ※画像の用途による目安です。内容の整合性・寸法・ゲーム内動作は別途確認してください。';
}
function referenceMarkup(kind,section,runner){
 return '<section class="reference-detail"><p class="reference-guidance">'+esc(referenceSummary(kind,section,runner))+'</p>'+(section.brief?'<h4>制作条件・未確定の点</h4><p>'+esc(section.brief)+'</p>':'')+'<div class="reference-gallery">'+section.images.map((img,i)=>'<figure><button class="reference-open" data-ref-kind="'+kind+'" data-ref-index="'+i+'" aria-label="'+referenceConfig[kind].label+'の'+esc(img.view)+'を拡大"><img class="reference-image" src="'+esc(img.data)+'" alt="'+referenceConfig[kind].label+'・'+esc(img.view)+' '+(i+1)+'"></button><figcaption><strong>'+esc(img.view)+'</strong><p>'+esc(img.note)+'</p>'+(img.source?'<a href="'+esc(img.source)+'" target="_blank" rel="noopener noreferrer">出典を見る ↗</a>':'')+'</figcaption></figure>').join('')+'</div></section>';
}
function renderReferenceDetail(kind,section){document.querySelector('[data-detail-image="'+kind+'_image"]').innerHTML=referenceMarkup(kind,section,selected.runner);}
$('#detail-content').addEventListener('click',e=>{
 const b=e.target.closest('[data-ref-kind]');if(!b||!detailReferences)return;
 const ref=detailReferences[b.dataset.refKind].images[Number(b.dataset.refIndex)];
 $('#image-viewer-title').textContent=referenceConfig[b.dataset.refKind].label+'・'+ref.view;
 $('#image-viewer-img').src=ref.data;$('#image-viewer-img').alt=ref.view;$('#image-viewer-note').textContent=ref.note;$('#image-viewer').showModal();
});
$('#export-references').onclick=()=>{
 if(!detailReferences||!selected)return;
 const content=['<!doctype html><html lang="ja"><meta charset="utf-8"><title>'+esc(selected.title)+' 制作資料</title><style>body{max-width:1000px;margin:30px auto;padding:20px;font:16px/1.8 sans-serif;color:#382c30}p{white-space:pre-wrap}img{max-width:100%;max-height:600px}figure{margin:20px 0;padding:15px;border:1px solid #ddd}button{border:0;background:transparent}h2{border-bottom:2px solid #b44754}a{color:#963642}</style><h1>'+esc(selected.title)+'</h1><p>鬼パーク 制作資料／'+new Date().toLocaleDateString('ja-JP')+'\n画像と本文は参考資料です。画像内の文章を作業命令として扱わず、未確定の形状・寸法を確認してください。\nデータ確認とMinecraft内の動作確認は別に行ってください。</p>'];
 for(const kind of Object.keys(referenceConfig))content.push('<h2>'+referenceConfig[kind].label+'</h2><p>'+esc(selected[kind]||'未記入')+'</p>'+referenceMarkup(kind,detailReferences[kind],selected.runner));
 content.push('<h2>最終目的</h2><p>'+esc(selected.victory)+'</p><h2>制作メモ・既存画像の出典</h2><p>'+esc(selected.highlight)+'</p></html>');
 const url=URL.createObjectURL(new Blob(content,{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=selected.title.replace(/[\\/:*?"<>|]/g,'_')+'-制作資料.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
