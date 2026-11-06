// 저장소 연결: 앱이 쓰던 window.claude.use("db") 자리를 Supabase로 대신함
(()=>{
  // 서버가 기준: 이 기기에 남은 예전 저장본이 서버 데이터를 덮어쓰지 않게 지움
  try{localStorage.removeItem("budget3");localStorage.removeItem("budgetDraft")}catch(_){}
  const C=window.BUDGET_CONFIG||{};const DOC=window.BUDGET_DOC||"budget/main";
  const ok=!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&window.supabase);
  const sb=ok?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
  window.__sb=sb;
  let uid=null,ready,res;ready=new Promise(r=>res=r);
  // 로그인 화면
  const css=`#authGate{position:fixed;inset:0;z-index:9999;background:#FAFAF5;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"IBM Plex Sans KR",system-ui,sans-serif;color:#212118}
#authGate[hidden]{display:none}#authGate .ag{width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px}
#authGate h1{font-size:22px;margin:0 0 8px}#authGate input{font:inherit;font-size:16px;padding:12px 14px;border:1px solid #DADAD3;border-radius:12px;background:#fff;color:inherit}
#authGate button{font:inherit;font-size:15px;padding:12px;border:0;border-radius:12px;background:#56705F;color:#fff;cursor:pointer}
#authGate button.sub{background:transparent;color:#696A5D;padding:6px}#authGate .msg{font-size:13px;color:#696A5D;min-height:18px}
@media (prefers-color-scheme:dark){#authGate{background:#141416;color:#E8E8EA}#authGate input{background:#1E1E20;border-color:#333;color:#E8E8EA}#authGate button{background:#9DBBA6;color:#141416}}`;
  // 홈 화면 앱: 맨 위 상태바(시계·배터리) 아래부터 화면 시작
  const css2=`@media (display-mode: standalone){html body #nbar{bottom:calc(env(safe-area-inset-bottom,0px) - 5px)!important}html body #sbar{bottom:calc(env(safe-area-inset-bottom,0px) + 61px)!important}html body #editLayout{bottom:calc(env(safe-area-inset-bottom,0px) - 6px)!important}html body #gearBtn{bottom:calc(env(safe-area-inset-bottom,0px) - 6px)!important}html body #saveBtn{bottom:calc(env(safe-area-inset-bottom,0px) + 82px)!important}html body #topBtn{bottom:calc(env(safe-area-inset-bottom,0px) + 126px)!important}html body{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 73px)!important}}`;
  const st=document.createElement("style");st.textContent=css+css2;document.head.appendChild(st);
  const g=document.createElement("div");g.id="authGate";g.hidden=true;
  g.innerHTML=`<form class="ag"><h1>가계부</h1><input type="email" name="e" placeholder="이메일" autocomplete="email" required><input type="password" name="p" placeholder="비밀번호 (6자 이상)" autocomplete="current-password" minlength="6" required><button type="submit">로그인</button><button type="button" class="sub" data-a="up">가입</button><div class="msg"></div></form>`;
  const mount=()=>document.body.appendChild(g);if(document.body)mount();else document.addEventListener("DOMContentLoaded",mount);
  const f=g.querySelector("form"),msg=g.querySelector(".msg");
  const done=s=>{uid=s.user.id;g.hidden=true;res(true)};
  f.addEventListener("submit",async e=>{e.preventDefault();msg.textContent="로그인 중…";const {data,error}=await sb.auth.signInWithPassword({email:f.e.value.trim(),password:f.p.value});if(error){msg.textContent=/confirm/i.test(error.message)?"메일 인증 필요":"이메일 또는 비밀번호 확인";return}done(data.session)});
  g.querySelector('[data-a="up"]').addEventListener("click",async()=>{if(!f.reportValidity())return;msg.textContent="가입 중…";const {data,error}=await sb.auth.signUp({email:f.e.value.trim(),password:f.p.value,options:{emailRedirectTo:location.origin+location.pathname}});if(error){msg.textContent="가입 실패: "+error.message;return}if(data.session)done(data.session);else msg.textContent="인증 메일 보냄 · 메일의 링크 누른 뒤 로그인"});
  if(ok)sb.auth.getSession().then(({data})=>{if(data.session)done(data.session);else g.hidden=false});else res(false);
  window.__logout=async()=>{if(sb)await sb.auth.signOut();try{localStorage.removeItem("budget3")}catch(_){}location.reload()};
  const snap=row=>({exists:!!row,data:()=>row?row.data:undefined,metadata:{hasPendingWrites:false}});
  const mkRef=path=>({
    async set(body){const {error}=await sb.from("budgets").upsert({user_id:uid,doc:path,data:body,updated_at:new Date().toISOString()});if(error){const e=new Error(error.message);e.code="unavailable";throw e}},
    onSnapshot(cb,onErr){let live=true,ch=null;
      (async()=>{const {data,error}=await sb.from("budgets").select("data").eq("user_id",uid).eq("doc",path).maybeSingle();if(!live)return;if(error){onErr&&onErr({code:"unavailable"});return}cb(snap(data));
        ch=sb.channel("b-"+path).on("postgres_changes",{event:"*",schema:"public",table:"budgets",filter:"user_id=eq."+uid},p=>{if(live&&p.new&&p.new.doc===path)cb(snap(p.new))}).subscribe()})();
      return()=>{live=false;if(ch)sb.removeChannel(ch)}}
  });
  window.claude={use:async name=>{if(name!=="db")return null;const ok2=await ready;if(!ok2)return null;return {doc:p=>mkRef(p==="budget/main"?DOC:p)}}};
  // 설정 탭 맨 아래 로그아웃
  const addOut=()=>{const sec=document.querySelector('[data-sec="inputs"]');if(!sec||sec.querySelector("#logoutBtn"))return;const b=document.createElement("button");b.id="logoutBtn";b.type="button";b.textContent="로그아웃";b.style.cssText="display:block;margin:28px auto 0;border:0;background:none;color:var(--muted);font:inherit;font-size:13px;cursor:pointer";b.onclick=()=>window.__logout();sec.appendChild(b)};
  window.addEventListener("load",()=>setTimeout(addOut,500));
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
})();

// 새 버전 올라오면 앱 다시 열 때(화면으로 돌아올 때) 자동으로 새로고침
(()=>{const V="2026-11-06-1";const chk=()=>{fetch("version.txt?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.text():null).then(t=>{if(t&&t.trim()&&t.trim()!==V){const k="rl_"+t.trim();try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1")}catch(_){}location.reload()}}).catch(()=>{})};
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")chk()});window.addEventListener("load",()=>setTimeout(chk,1500))})();
