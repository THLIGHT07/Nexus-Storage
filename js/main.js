/* ============================================================
   MAIN.JS — Initialization + event wiring that connects every
   module together. Loads LAST. Contains initMainApp (the boot-
   after-login orchestrator), weather widget, particle canvas,
   side-panel open/close wiring, and the AI panel button wiring.
   ============================================================ */
(window.__nexusParts=window.__nexusParts||{})["main.js"]="2026-10-02-xss1";


/* ═══════════════════════════════════════════════════
   INIT MAIN APP
═══════════════════════════════════════════════════ */
/* Runs one init step in isolation: if it throws (a widget, the weather call,
   a canvas…) the error is logged and the REST of the app still starts — in
   particular the per-user steps below can never be skipped by an unrelated
   failure further down. */
function safeInit(name,fn){
  try{return fn();}
  catch(err){console.error(`[init] "${name}" failed — continuing`,err);}
}

function initMainApp(){
  if(CURRENT_UID==null){ // should never happen — never render an app that can't read/save its own data
    console.error("initMainApp called with no logged-in user id");
    lockScreen();return;
  }

  /* ── 1. THIS account's private state first: AI config, wallpaper, theme ──
        (everything the previous account may have left in the DOM is blanked,
         then only the logged-in account's own saved values are shown) */
  safeInit("AI panel",()=>{resetAiPanel();loadAiConfig();wireAiAutosave();});
  safeInit("wallpaper",()=>{restoreWallpaper().catch(err=>console.warn("[wallpaper] restore failed",err));});
  safeInit("theme",()=>{applyTheme(g(LS.THEME)||"default");applyOverlay(g(LS.OVERLAY)||"72");});
  wallScope=g(LS.WALL_SCOPE)||"full";
  clockFormat=parseInt(g(LS.CLOCK_FMT)||"24");
  showSeconds=g(LS.CLOCK_SEC)==="true";

  /* ── 2. The rest of the dashboard ── */
  safeInit("clock",initClock);
  safeInit("weather",initWeather);
  safeInit("particles",initParticleCanvas);
  safeInit("search",initSearch);
  safeInit("notes",initNotes);
  safeInit("settings",initSettings);
  safeInit("drag & drop",initDnd);
  safeInit("render",renderAll);
  safeInit("account status",startAccountStatusPolling); // begin the "is this account still active?" heartbeat
  safeInit("toggles",()=>{
    updateSortBtn();
    updateViewBtns();
    document.querySelector(".recent-bar").style.display=showRecent?"block":"none";
  });

  /* Wave bars */
  safeInit("wave bars",()=>{
    const waveEl=document.getElementById("wave");
    if(waveEl){
      waveEl.innerHTML="";
      for(let i=0;i<34;i++){const d=document.createElement("div");d.style.animationDelay=`${(i*.058).toFixed(2)}s`;waveEl.appendChild(d);}
    }
  });

  /* Modal enter key — wired once */
  safeInit("modal enter key",()=>{
    const appModalEl=document.getElementById("appModal");
    if(appModalEl&&!appModalEl.dataset.enterWired){
      appModalEl.dataset.enterWired="1";
      appModalEl.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName!=="BUTTON")saveApp();});
    }
  });
}

/* Auto-save AI inputs on change — wired ONCE (initMainApp runs on every login;
   stacking listeners would multiply writes). Each handler reads the current
   user at event time, and p() refuses to write when nobody is logged in. */
let _aiAutosaveWired=false;
function wireAiAutosave(){
  if(_aiAutosaveWired)return;
  _aiAutosaveWired=true;
  const fields={...AI_TEXT_FIELDS,...AI_SELECT_FIELDS};
  Object.entries(fields).forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener("input",()=>{
      if(CURRENT_UID==null)return;
      const next={...aiState,[key]:el.value.trim()};
      if(p(LS_AI,next))aiState=next;
      if(id==="aiPersonaName")updateAiNames(el.value.trim()||"ARIA");
    });
  });
  Object.entries(AI_CHECK_FIELDS).forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener("change",()=>{
      if(CURRENT_UID==null)return;
      const next={...aiState,[key]:el.checked};
      if(p(LS_AI,next))aiState=next;
    });
  });
}

/* ═══════════════════════════════════════════════════
   SESSION RESET — called on lock / logout / block (boot.js).
   Clears everything account-specific that lives in memory or the DOM so
   the next login can't see it: AI URL/key/model + chat, wallpaper layers,
   open panels, half-typed forms. It never touches localStorage/IndexedDB,
   so the account's saved data is exactly as it was.
═══════════════════════════════════════════════════ */
/* Stops every per-login timer / animation loop / listener started by initMainApp's
   notes, search, drag&drop, clock and particle steps, and RESETS their init guards,
   so the next login starts each of them exactly once. Idempotent (safe to call twice). */
function teardownMainInits(){
  [["notes",teardownNotes],["search",teardownSearch],["drag & drop",teardownDnd],["clock",stopClock],["particles",stopParticleCanvas],["wallpaper previews",stopLivePreviews],["profile popup + editor",closeProfileUi]]
    .forEach(([name,fn])=>{try{fn();}catch(err){console.warn(`[teardown] "${name}" failed`,err);}});
}

function resetUserSession(){
  teardownMainInits(); // sign-out / lock / block: stop timers+loops and reset init guards first
  aiState={}; // forget the previous account's AI config in memory (it stays safely in its own storage)
  try{resetAiPanel();}catch(e){console.warn("resetAiPanel",e);}
  try{clearWallpaperLayers();}catch(e){console.warn("clearWallpaperLayers",e);}
  try{closePanel("notesPanel");closePanel("settingsPanel");}catch(e){}
  ["searchInput","noteTitle","noteBody","setUsername","wallUrlInput","sxDelPass","sxResetConfirm"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("noteForm")?.classList.remove("show");
  document.getElementById("searchClear")?.classList.remove("visible");
  const prev=document.getElementById("customWallPreview");if(prev)prev.style.display="none";
  const up=document.getElementById("wallUpload");if(up)up.value="";
  releasePreviewUrl();
}

/* ═══════════════════════════════════════════════════
   WEATHER
═══════════════════════════════════════════════════ */
/* Weather: one tiny state machine (idle → loading → loaded | failed).
   • applyWeatherVisibility() is the ONLY place that shows/hides the strip — called at login,
     from the Settings toggle and from the AI tool — and it fetches when the widget is shown and
     there is nothing fresh to show. So "off at login, switched on later" now works.
   • Re-toggling never re-fetches while loading, or while data is < 30 min old; a failed load retries. */
const WEATHER_TTL_MS=30*60*1000;
const _weather={state:"idle",at:0};
function applyWeatherVisibility(){
  const strip=document.getElementById("weatherStrip");
  if(strip)strip.style.display=showWeather?"flex":"none"; // explicit both ways (a previous account may have left it hidden)
  if(showWeather)loadWeather();
}
function initWeather(){applyWeatherVisibility();}
function loadWeather(){
  if(_weather.state==="loading")return;
  if(_weather.state==="loaded"&&Date.now()-_weather.at<WEATHER_TTL_MS)return;
  if(!navigator.geolocation){_weather.state="failed";setWeather("⚡","—","Unavailable");return;}
  const hasData=_weather.state==="loaded"; // keep showing old data while refreshing
  _weather.state="loading";
  if(!hasData)setWeather("🌡️","…","Locating…");
  const fail=desc=>{_weather.state="failed";setWeather("🌡️","—",desc);};
  navigator.geolocation.getCurrentPosition(pos=>{
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true&hourly=relativehumidity_2m`)
      .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
      .then(data=>{
        const w=data.current_weather;
        const code=w.weathercode;
        const temp=Math.round(w.temperature);
        const icon=code<=1?"☀️":code<=3?"🌤️":code<=48?"☁️":code<=67?"🌧️":code<=77?"❄️":code<=82?"🌦️":code<=99?"⛈️":"🌡️";
        const desc=code<=1?"Clear":code<=3?"Partly Cloudy":code<=48?"Cloudy":code<=67?"Rainy":code<=77?"Snowy":code<=82?"Showers":"Thunderstorm";
        setWeather(icon,`${temp}°C`,desc);
        _weather.state="loaded";_weather.at=Date.now();
      }).catch(()=>fail("Unavailable"));
  },err=>fail(err&&err.code===1?"Location denied":"Location unavailable"),{timeout:10000,maximumAge:600000});
}
function setWeather(icon,temp,desc){
  document.getElementById("weatherIcon").textContent=icon;
  document.getElementById("weatherTemp").textContent=temp;
  document.getElementById("weatherDesc").textContent=desc;
}

/* ═══════════════════════════════════════════════════
   PARTICLE CANVAS
═══════════════════════════════════════════════════ */
let particlesActive=true;
let _particleRaf=null,_particleAbort=null; // id of the pending animation frame + the controller that owns the canvas/hero/window listeners
/** Stops the particle loop and removes its listeners. Safe to call any time (also from resetUserSession). */
function stopParticleCanvas(){
  if(_particleRaf!==null){cancelAnimationFrame(_particleRaf);_particleRaf=null;}
  if(_particleAbort){_particleAbort.abort();_particleAbort=null;}
}
function initParticleCanvas(){
  stopParticleCanvas(); // cancel any previous loop + listeners BEFORE starting a new one
  _particleAbort=new AbortController();
  const opt={signal:_particleAbort.signal};
  const canvas=document.getElementById("bgCanvas"),ctx=canvas.getContext("2d");
  let W,H,pts=[];
  function resize(){W=canvas.width=canvas.offsetWidth;H=canvas.height=canvas.offsetHeight;}
  function init(){pts=Array.from({length:60},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.38,vy:(Math.random()-.5)*.38,r:Math.random()*1.7+.5}));}
  function draw(){
    if(!showParticles){ctx.clearRect(0,0,W,H);_particleRaf=requestAnimationFrame(draw);return;}
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba(170,158,255,0.5)";ctx.fill();});
    for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const d=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);if(d<110){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(124,111,255,${.08*(1-d/110)})`;ctx.lineWidth=.8;ctx.stroke();}}
    _particleRaf=requestAnimationFrame(draw);
  }
  resize();init();draw();
  window.addEventListener("resize",()=>{resize();init();},opt);
  const hero=document.getElementById("hero"),glow=document.getElementById("glow");
  hero.addEventListener("mousemove",e=>{const r=hero.getBoundingClientRect();glow.style.left=(e.clientX-r.left)+"px";glow.style.top=(e.clientY-r.top)+"px";},opt);
}

/* ═══════════════════════════════════════════════════
   PANELS
═══════════════════════════════════════════════════ */
function openPanel(id){
  document.getElementById("panelBackdrop").classList.add("open");
  document.getElementById(id).classList.add("open");
}
function closePanel(id){
  document.getElementById("panelBackdrop").classList.remove("open");
  document.getElementById(id).classList.remove("open");
  if(id==="settingsPanel")stopLivePreviews(); // the wallpaper thumbnails only animate while Settings is open
}
document.getElementById("notesBtn").addEventListener("click",()=>openPanel("notesPanel"));
document.getElementById("settingsBtn").addEventListener("click",()=>openPanel("settingsPanel"));
document.getElementById("notesPanelClose").addEventListener("click",()=>closePanel("notesPanel"));
document.getElementById("settingsPanelClose").addEventListener("click",()=>closePanel("settingsPanel"));
document.getElementById("panelBackdrop").addEventListener("click",()=>{closePanel("notesPanel");closePanel("settingsPanel");});

/* ═══════════════════════════════════════════════════
   ACCOUNT STATUS POLLING
   While logged in, periodically re-check GET /api/auth/me so an admin
   block is caught within a few seconds instead of waiting for a page
   refresh. Started from initMainApp() (i.e. only once logged in) and
   stopped from lockScreen()/showBlockedScreen() in boot.js.
═══════════════════════════════════════════════════ */
let accountStatusTimer=null;

function startAccountStatusPolling(){
  if(accountStatusTimer)return; // already running — don't stack timers
  scheduleNextAccountStatusCheck();
}
function stopAccountStatusPolling(){
  clearTimeout(accountStatusTimer);
  accountStatusTimer=null;
}
function scheduleNextAccountStatusCheck(){
  const delay=ACCOUNT_STATUS_POLL_MIN+Math.random()*(ACCOUNT_STATUS_POLL_MAX-ACCOUNT_STATUS_POLL_MIN);
  accountStatusTimer=setTimeout(async()=>{
    await checkAccountStatus();
    if(accountStatusTimer!==null)scheduleNextAccountStatusCheck(); // keep going unless something stopped us mid-check
  },delay);
}

/** One GET /api/auth/me round-trip. Only acts when it finds a genuine
 * block (403, or "blocked" anywhere in the response's error/message) —
 * anything else (network hiccup, expired token, etc.) is left alone so
 * this heartbeat can never itself log a healthy user out. */
async function checkAccountStatus(){
  if(!getAuthToken())return; // requirement 4: never runs while logged out
  let res;
  try{
    res=await fetch(API_AUTH.ME,{headers:{...authHeaders()}});
  }catch(networkErr){
    return; // offline / server down for a moment — just try again next cycle
  }
  let data=null;
  try{data=await res.json();}catch(e){/* non-JSON body — fine, we still have res.status */}
  const text=String((data&&(data.error||data.message))||"").toLowerCase();
  if(res.status===403||text.includes("blocked")){
    showBlockedScreen();
  }
}

/* Kept from the original build (legacy reference, currently unused) */
const _origInitMainApp=initMainApp;

/* ── One-time AI panel button + Cmd/Ctrl+J shortcut wiring.
   Called at the end of every renderAll() in apps.js; the
   _aiPanelInited guard makes sure it only truly runs once. ── */
let _aiPanelInited=false;
function wireAiPanelButton(){
  if(!_aiPanelInited){_aiPanelInited=true;setTimeout(()=>{
    // Wire aiBtn immediately — safe because mainApp is visible now
    const aiBtn=document.getElementById("aiBtn");
    const aiPanel=document.getElementById("aiPanel");
    if(aiBtn&&aiPanel){
      aiBtn.addEventListener("click",(e)=>{
        e.stopPropagation();
        const isOpen=aiPanel.classList.toggle("open");
        aiBtn.classList.toggle("active",isOpen);
        const badge=document.getElementById("aiBadge");
        if(badge)badge.style.display="none";
        if(isOpen)ensureAiPanelForCurrentUser();
        if(isOpen)setTimeout(()=>{const inp=document.getElementById("aiInput");if(inp)inp.focus();},360);
        // Init full panel on first open
        if(isOpen&&!window._aiFullInited){
          window._aiFullInited=true;
          try{initAiPanel();}catch(e){console.error("initAiPanel error:",e);}
        }
      });
      // CMD+J shortcut
      document.addEventListener("keydown",e=>{
        const isMac=navigator.platform.toUpperCase().includes("MAC");
        if((isMac?e.metaKey:e.ctrlKey)&&e.key==="j"){
          e.preventDefault();
          const isOpen=aiPanel.classList.toggle("open");
          aiBtn.classList.toggle("active",isOpen);
          if(isOpen&&!window._aiFullInited){
            window._aiFullInited=true;
            try{initAiPanel();}catch(e){console.error("initAiPanel error:",e);}
          }
          if(isOpen)ensureAiPanelForCurrentUser();
        if(isOpen)setTimeout(()=>{const inp=document.getElementById("aiInput");if(inp)inp.focus();},360);
        }
      });
    }
  },80);}}
