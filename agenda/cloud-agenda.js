// Agenda 저장소 연결: 가계부와 같은 Supabase 계정·테이블(budgets)에 doc="agenda/main"으로 저장
(()=>{
  const C=window.BUDGET_CONFIG||{};const DOC="agenda/main";const CACHE="agenda-cache-v1";
  const ok=!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&window.supabase);
  const sb=ok?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
  let uid=null,lastSaved=0,booted=false,pendingReload=false;
  const stateEl=()=>document.getElementById("state");
  const setState=d=>{stateEl().textContent=JSON.stringify(d).replace(/</g,"\\u003c")};
  const cache=d=>{try{localStorage.setItem(CACHE,JSON.stringify(d))}catch(_){}};
  const cached=()=>{try{const r=localStorage.getItem(CACHE);return r?JSON.parse(r):null}catch(_){return null}};

  // 로그인 화면 (가계부와 같은 계정)
  const css=`#authGate{position:fixed;inset:0;z-index:9999;background:#0f1012;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Inter","Geist","Pretendard","Noto Sans KR",system-ui,sans-serif}
#authGate[hidden]{display:none}#authGate .ag{width:100%;max-width:340px;display:flex;flex-direction:column;gap:10px}
#authGate h1{font-size:24px;font-weight:600;letter-spacing:-.02em;margin:0 0 2px}#authGate p{margin:0 0 10px;color:#878c95;font-size:13px}
#authGate input{font:inherit;font-size:16px;padding:11px 14px;border:0;border-radius:8px;background:#1d1e22;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.11);outline:none}
#authGate input:focus{box-shadow:inset 0 0 0 1px #7180f0}
#authGate button{font:inherit;font-size:15px;font-weight:500;padding:11px 14px;border:0;border-radius:8px;background:#5e6ad2;color:#fff;cursor:pointer}
#authGate button.sub{background:transparent;color:#878c95}#authGate .msg{font-size:13px;color:#b4b8c0;min-height:18px;text-align:center}`;
  const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
  const g=document.createElement("div");g.id="authGate";g.hidden=true;
  g.innerHTML=`<form class="ag"><h1>Agenda</h1><p>가계부와 같은 계정으로 로그인</p><input type="email" name="e" placeholder="이메일" autocomplete="email" required><input type="password" name="p" placeholder="비밀번호" autocomplete="current-password" minlength="6" required><button type="submit">로그인</button><button type="button" class="sub" data-a="up">가입</button><div class="msg"></div></form>`;
  document.body.appendChild(g);
  const f=g.querySelector("form"),msg=g.querySelector(".msg");

  function boot(adapter){
    if(booted)return;booted=true;
    window.claude={use:async n=>(n==="artifact"?adapter:null)};
    const s=document.createElement("script");s.textContent=document.getElementById("app").textContent;document.body.appendChild(s);
    if(sb){const foot=document.createElement("div");foot.className="appfoot";foot.innerHTML='<button type="button">로그아웃</button>';foot.firstChild.onclick=async()=>{await sb.auth.signOut();try{localStorage.removeItem(CACHE)}catch(_){}location.reload()};document.body.insertBefore(foot,s)}
  }
  const adapter={publish:async html=>{
    const m=html.match(/<script id="state" type="application\/json">([\s\S]*?)<\/script>/);if(!m)return;
    const d=JSON.parse(m[1]);lastSaved=d.updated||Date.now();cache(d);
    const {error}=await sb.from("budgets").upsert({user_id:uid,doc:DOC,data:d,updated_at:new Date().toISOString()});
    if(error){const e=new Error(error.message);e.code="unavailable";throw e}
  }};

  async function fetchRemote(){const {data,error}=await sb.from("budgets").select("data").eq("user_id",uid).eq("doc",DOC).maybeSingle();if(error)throw error;return data&&data.data};
  function maybeReload(){const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){pendingReload=true;return}location.reload()}

  async function start(session){
    uid=session.user.id;g.hidden=true;
    try{
      const remote=await fetchRemote();
      if(remote&&remote.items){setState(remote);lastSaved=remote.updated||0;cache(remote)}
      else{const seed=JSON.parse(stateEl().textContent);lastSaved=seed.updated||0;await sb.from("budgets").upsert({user_id:uid,doc:DOC,data:seed,updated_at:new Date().toISOString()});cache(seed)}
    }catch(_){const c=cached();if(c&&c.items){setState(c);lastSaved=c.updated||0}}
    boot(adapter);
    // 다른 기기에서 바뀌면 다시 불러오기
    sb.channel("agenda-"+uid).on("postgres_changes",{event:"*",schema:"public",table:"budgets",filter:"user_id=eq."+uid},p=>{
      if(p.new&&p.new.doc===DOC&&p.new.data&&(p.new.data.updated||0)>lastSaved)maybeReload();
    }).subscribe();
    document.addEventListener("visibilitychange",async()=>{if(document.visibilityState!=="visible")return;try{const r=await fetchRemote();if(r&&(r.updated||0)>lastSaved)maybeReload()}catch(_){}});
    document.addEventListener("focusout",()=>{if(pendingReload)setTimeout(()=>{const a=document.activeElement;if(!a||!/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))location.reload()},1800)});
  }

  f.addEventListener("submit",async e=>{e.preventDefault();msg.textContent="로그인 중…";const {data,error}=await sb.auth.signInWithPassword({email:f.e.value.trim(),password:f.p.value});if(error){msg.textContent=/confirm/i.test(error.message)?"메일 인증이 필요해요":"이메일 또는 비밀번호를 확인해 주세요";return}start(data.session)});
  g.querySelector('[data-a="up"]').addEventListener("click",async()=>{if(!f.reportValidity())return;msg.textContent="가입 중…";const {data,error}=await sb.auth.signUp({email:f.e.value.trim(),password:f.p.value,options:{emailRedirectTo:location.origin+location.pathname}});if(error){msg.textContent="가입 실패: "+error.message;return}if(data.session)start(data.session);else msg.textContent="인증 메일을 보냈어요. 링크를 누른 뒤 로그인하세요"});

  if(ok){sb.auth.getSession().then(({data})=>{if(data.session)start(data.session);else g.hidden=false}).catch(()=>{const c=cached();if(c&&c.items)setState(c);boot(null)})}
  else boot(null); // 설정이 없으면 이 기기에만 저장

  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
})();
