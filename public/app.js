const $=s=>document.querySelector(s);
let token=sessionStorage.getItem("oni-park-session")||"";
let role="",ownerMode=false,items=[],selected=null,editing=null;
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
 const previous=$("#theme").value;
 $("#theme").innerHTML='<option value="">すべての題材</option>'+[...new Set(items.map(x=>x.theme).filter(Boolean))].sort().map(t=>'<option>'+esc(t)+'</option>').join("");
 $("#theme").value=previous;render();
}
function render(){
 const q=$("#search").value.toLocaleLowerCase(),status=$("#status").value,theme=$("#theme").value;
 const filtered=items.filter(x=>(!status||x.status===status)&&(!theme||x.theme===theme)&&[x.title,x.author,x.theme,x.stage,x.monster,x.mission,x.highlight].join(" ").toLocaleLowerCase().includes(q));
 $("#count").textContent=filtered.length+" 件";
 $("#empty").hidden=filtered.length!==0;
 $("#empty h2").textContent=items.length?"条件に合う企画がありません":"ここから、企画を育てよう。";
 $("#empty p").textContent=items.length?"キーワードや絞り込みを変えてみてください。":"「企画を投稿」から自分の案や、提案してもらった案を残せます。";
 $("#cards").innerHTML=filtered.map(x=>'<button class="card" data-id="'+x.id+'"><div class="card-art"><span class="card-symbol" aria-hidden="true">✳</span><span class="tag">'+esc(x.status)+'</span></div><div class="card-body"><span class="eyebrow">'+esc(x.theme||"オリジナル")+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.mission)+'</p></div><div class="card-meta"><span>'+esc(x.author)+'</span><span>'+new Date(x.updated).toLocaleDateString("ja-JP")+'</span></div></button>').join("");
}
function showDetail(id){
 selected=items.find(x=>x.id===id);if(!selected)return;
 $("#detail-content").innerHTML='<h2>'+esc(selected.title)+'</h2><span class="pill">'+esc(selected.status)+'</span><p class="muted">'+esc(selected.author)+' ・ '+esc(selected.theme||"オリジナル")+'</p>'+[["stage","舞台・マップ"],["monster","鬼の特徴"],["mission","ミッション"],["victory","勝利・終了条件"],["highlight","見どころ・制作メモ"]].map(([k,t])=>'<h3>'+t+'</h3><p>'+esc(selected[k]||"未記入")+'</p>').join("");
 $("#detail-actions").hidden=role!=="owner";$("#detail").showModal();
}
function openEditor(item=null){
 editing=item?.id||null;$("#idea-form").reset();$("#editor-error").textContent="";
 $("#editor-title").textContent=item?"企画を編集":"新しい企画";
 $("#edit-status").hidden=role!=="owner";
 if(item)for(const el of $("#idea-form").elements)if(el.name&&item[el.name]!==undefined)el.value=item[el.name];
 $("#editor").showModal();
}
$("#owner-toggle").onclick=()=>{
 ownerMode=!ownerMode;
 $("#owner-toggle").textContent=ownerMode?"合言葉で入園に戻る":"オーナーとしてログイン";
 $("#password-label").textContent=ownerMode?"オーナーパスワード":"合言葉";
 $("#password").type=ownerMode?"password":"text";$("#password").value="";
 $("#password").placeholder=ownerMode?"オーナー専用パスワード":"合言葉（かな入力OK）";
 $("#login-help").textContent=ownerMode?"初期設定で登録したオーナーパスワードを入力してください。":"オーナーから教わった合言葉で入園できます。";
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
 await api(editing?"/ideas/"+editing:"/ideas",editing?"PUT":"POST",Object.fromEntries(data));
 $("#editor").close();await refresh();notice("企画を保存しました。");
});
handleForm("#pass-form","#owner-error",async data=>{
 if(data.get("password").normalize("NFC")!==data.get("confirm").normalize("NFC"))throw new Error("確認用の合言葉が一致しません。");
 await api("/passphrase","POST",{password:data.get("password")});$("#pass-form").reset();$("#owner").close();notice("合言葉を変更しました。参加者に新しい合言葉を伝えてください。");
});
$("#new").onclick=()=>openEditor();
$("#settings").onclick=()=>{$("#owner-error").textContent="";$("#owner").showModal();};
$("#logout").onclick=async()=>{try{await api("/logout","POST",{});locked();}catch(e){notice(e.message);}};
$("#cards").onclick=e=>{const card=e.target.closest("[data-id]");if(card)showDetail(card.dataset.id);};
$("#edit").onclick=()=>{$("#detail").close();openEditor(selected);};
$("#delete").onclick=async()=>{
 if(!confirm("「"+selected.title+"」を削除しますか？ この操作は取り消せません。"))return;
 try{await api("/ideas/"+selected.id,"DELETE");$("#detail").close();await refresh();notice("企画を削除しました。");}catch(e){notice(e.message);}
};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
for(const id of ["search","status","theme"])$("#"+id).addEventListener(id==="search"?"input":"change",render);
enter().catch(e=>{locked();if(!e.message.includes("合言葉を入力"))$("#login-error").textContent=e.message;});
