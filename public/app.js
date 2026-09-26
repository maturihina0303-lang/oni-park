const $=s=>document.querySelector(s);
let token=sessionStorage.getItem("oni-park-session")||"";
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
 items=(await api("/ideas")).items;
 render();
}
const statusClass = s => ({"アイデア":"idea","検討中":"review","確認待ち":"production","マップ制作中":"map","モデル制作中":"model","撮影済み":"done"}[s]||"idea");
function render(){
 const q=$("#search").value.toLocaleLowerCase(),status=activeStatus,theme=$("#theme").value;
 const filtered=items.filter(x=>(!status||x.status===status)&&(!theme||genreOf(x.theme)===theme)&&[x.title,x.author,x.theme,x.stage,x.monster,x.mission,x.victory,x.highlight].join(" ").toLocaleLowerCase().includes(q));
 $("#count").textContent=filtered.length+" 件";
 $("#empty").hidden=filtered.length!==0;
 $("#empty h2").textContent=items.length?"条件に合う企画がありません":"ここから、企画を育てよう。";
 $("#empty p").textContent=items.length?"キーワードや絞り込みを変えてみてください。":"「企画を投稿」から自分の案や、提案してもらった案を残せます。";
 $("#cards").innerHTML=filtered.map(x=>'<article class="note-card status-'+statusClass(x.status)+'"><div class="note-top"><span class="tag">'+esc(x.status)+'</span><span class="note-theme">'+esc(genreOf(x.theme))+'</span></div><button class="note-open" data-id="'+x.id+'"><h3>'+esc(x.title)+'</h3><span class="note-label">【最終目的】</span><p>'+esc(x.victory)+'</p></button><div class="note-meta"><span>'+esc(x.author)+'</span><span>'+new Date(x.updated).toLocaleDateString("ja-JP")+'</span></div><div class="note-actions"><button data-id="'+x.id+'">詳細を見る</button><button data-id="'+x.id+'" data-action="edit">編集</button><button data-id="'+x.id+'" data-action="delete" class="danger">削除</button></div></article>').join("");
}
async function showDetail(id){
 selected=items.find(x=>x.id===id);if(!selected)return;
 $("#detail-content").innerHTML='<h2>'+esc(selected.title)+'</h2><span class="tag status-'+statusClass(selected.status)+'">'+esc(selected.status)+'</span><p class="muted">'+esc(selected.author)+' ・ '+esc(genreOf(selected.theme))+'</p>'+[["stage","【マップ】"],["monster","【鬼】"],["mission","【隠しアイテム】"],["victory","【最終目的】"],["highlight","【制作メモ】"]].map(([k,t])=>'<h3>'+t+'</h3><p>'+esc(selected[k]||"未記入")+'</p>'+(['stage','monster','mission'].includes(k)?'<div data-detail-image="'+k+'_image"></div>':'')).join("");
 $("#detail-actions").hidden=false;$("#detail").showModal();
 try{
  const {images}=await api("/ideas/"+id+"/images");
  if(selected?.id!==id)return;
  for(const [key,value] of Object.entries(images)){
   const slot=document.querySelector('[data-detail-image="'+key+'"]');
   if(slot&&value){const img=document.createElement("img");img.className="reference-image";img.alt=imageLabels[key]+"のイメージ画像";img.src=value;slot.replaceChildren(img);}
  }
 }catch(e){notice("画像を読み込めませんでした。"+e.message);}

}
async function openEditor(item=null){
 let images={};
 try{if(item)images=(await api("/ideas/"+item.id+"/images")).images;}catch(e){notice(e.message);return;}
 resetImages(images);
 editing=item?.id||null;$("#idea-form").reset();$("#editor-error").textContent="";
 $("#editor-title").textContent=item?"企画を編集":"新しい企画";
 $("#edit-status").hidden=false;
 if(item)for(const el of $("#idea-form").elements)if(el.name&&item[el.name]!==undefined)el.value=el.name==="theme"?genreOf(item.theme):item[el.name];
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
 await api(editing?"/ideas/"+editing:"/ideas",editing?"PUT":"POST",{...Object.fromEntries(data),...await collectImages()});
 $("#editor").close();await refresh();notice("企画を保存しました。");
});
handleForm("#pass-form","#owner-error",async data=>{
 if(data.get("password").normalize("NFC")!==data.get("confirm").normalize("NFC"))throw new Error("確認用の合言葉が一致しません。");
 await api("/passphrase","POST",{password:data.get("password")});$("#pass-form").reset();$("#owner").close();notice("合言葉を変更しました。参加者に新しい合言葉を伝えてください。");
});
$("#new").onclick=()=>openEditor();
$("#settings").onclick=()=>{$("#owner-error").textContent="";$("#owner").showModal();};
$("#logout").onclick=async()=>{try{await api("/logout","POST",{});locked();}catch(e){notice(e.message);}};
$("#cards").onclick=e=>{const card=e.target.closest("[data-id]");if(!card)return; const item=items.find(x=>x.id===card.dataset.id); if(card.dataset.action==="edit")openEditor(item);else if(card.dataset.action==="delete"){selected=item;$("#delete").click();}else showDetail(card.dataset.id);};
$("#edit").onclick=()=>{$("#detail").close();openEditor(selected);};
$("#delete").onclick=async()=>{
 if(!confirm("「"+selected.title+"」を削除しますか？ この操作は取り消せません。"))return;
 try{await api("/ideas/"+selected.id,"DELETE");$("#detail").close();await refresh();notice("企画を削除しました。");}catch(e){notice(e.message);}
};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
$("#status-filters").onclick=e=>{const button=e.target.closest("[data-status]");if(!button)return;activeStatus=button.dataset.status;document.querySelectorAll("[data-status]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));render();};
for(const id of ["search","theme"])$("#"+id).addEventListener(id==="search"?"input":"change",render);
enter().catch(e=>{locked();if(!e.message.includes("合言葉を入力"))$("#login-error").textContent=e.message;});

const imageLabels={stage_image:"マップ",monster_image:"鬼",mission_image:"アイテム"};
let imageState={};
function resetImages(images){
 for(const field of document.querySelectorAll('[data-image-field]')){
  const key=field.dataset.imageField;
  if(imageState[key]?.url)URL.revokeObjectURL(imageState[key].url);
  imageState[key]={value:images[key]||""};
  renderImage(field);
 }
}
function renderImage(field){
 const state=imageState[field.dataset.imageField],img=field.querySelector('img');
 const src=state.url||state.value;
 img.hidden=!src;field.querySelector('.image-remove').hidden=!src;
 if(src)img.src=src;else img.removeAttribute('src');
}
for(const field of document.querySelectorAll('[data-image-field]')){
 const key=field.dataset.imageField,input=field.querySelector('input');
 input.onchange=()=>{
  const file=input.files[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024){notice("20MB以下のPNG・JPEG・WebP画像を選んでください。");input.value="";return;}
  if(imageState[key]?.url)URL.revokeObjectURL(imageState[key].url);
  imageState[key]={file,url:URL.createObjectURL(file)};renderImage(field);
 };
 field.querySelector('.image-remove').onclick=()=>{
  if(imageState[key]?.url)URL.revokeObjectURL(imageState[key].url);
  imageState[key]={value:""};input.value="";renderImage(field);
 };
}
async function collectImages(){
 const result={};
 for(const [key,state] of Object.entries(imageState)){
  if(!state.file){result[key]=state.value;continue;}
  const img=new Image();img.src=state.url;
  try{await img.decode();}catch{throw new Error(imageLabels[key]+"の画像を読み取れません。別の画像を選んでください。");}
  const canvas=document.createElement('canvas');
  for(let size=1200;size>=300;size=Math.floor(size*.75)){
   const scale=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   result[key]=canvas.toDataURL('image/jpeg',.8);if(result[key].length<=180000)break;
  }
  if(result[key].length>180000)throw new Error(imageLabels[key]+"の画像を小さくして選び直してください。");
 }
 return result;
}
