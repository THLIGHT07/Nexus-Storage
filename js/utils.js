/* ============================================================
   UTILS.JS — Shared data/constants, localStorage keys, core
   app state, and common helpers (toast, uid, esc, colorForCat)
   Loads FIRST — almost every other module reads these globals.
   ============================================================ */

/* ── Build stamp + "stale file" detector ──
   Every script that changed in this release registers the same build id in
   window.__nexusParts. If the browser served a cached OLD copy of any of
   them next to the new ones, the ids won't all match and we say so on
   screen (instead of the app quietly behaving like a mix of two versions). */
const NEXUS_BUILD="2026-10-02-xss1";
(window.__nexusParts=window.__nexusParts||{})["utils.js"]=NEXUS_BUILD;
console.info("[nexus] build",NEXUS_BUILD);
function checkNexusBuild(){
  const expected=["index.html","utils.js","boot.js","settings.js","wallpapers.js","ai-core.js","main.js"];
  const parts=window.__nexusParts||{};
  const bad=expected.filter(f=>parts[f]!==NEXUS_BUILD);
  if(!bad.length)return true;
  console.error("[nexus] Out-of-date files detected (stale browser cache?):",bad.map(f=>`${f}=${parts[f]||"MISSING"}`).join(", "),"— expected",NEXUS_BUILD);
  const bar=document.createElement("div");
  bar.id="nexusStaleBanner";
  bar.setAttribute("style","position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:10px 14px;background:#b3261e;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center;");
  bar.textContent="Some Nexus files are out of date ("+bad.join(", ")+"). Press Ctrl+Shift+R (hard refresh) to finish updating — until then accounts may not stay separate.";
  document.body.appendChild(bar);
  return false;
}
window.addEventListener("load",checkNexusBuild);


/* ═══════════════════════════════════════════════════
   DATA & CONSTANTS
═══════════════════════════════════════════════════ */
const DEFAULT_APPS=[
  {id:"chatgpt",name:"ChatGPT",icon:"message-code",url:"https://chatgpt.com",cat:"AI Assistant",bg:"#CED4FA",c:"#534AB7"},
  {id:"notebook_lm",name:"Notebook LM",icon:"book",url:"https://notebooklm.google.com",cat:"Research",bg:"#B5D4F4",c:"#185FA5"},
  {id:"whatsapp",name:"WhatsApp",icon:"brand-whatsapp",url:"https://web.whatsapp.com",cat:"Communication",bg:"#9FE1CB",c:"#0F6E56"},
  {id:"instagram",name:"Instagram",icon:"brand-instagram",url:"https://www.instagram.com",cat:"Social",bg:"#F4C0D1",c:"#993556"},
  {id:"vidbox",name:"VidBox",icon:"device-tv",url:"https://vidbox.co",cat:"Media",bg:"#FAC775",c:"#854F0B"},
  {id:"gmail",name:"Gmail",icon:"mail",url:"https://mail.google.com",cat:"Communication",bg:"#9FE1CB",c:"#0F6E56"},
  {id:"grok",name:"Grok",icon:"terminal-2",url:"https://x.com/i/grok",cat:"AI Assistant",bg:"#CED4FA",c:"#534AB7"},
  {id:"gemini",name:"Gemini",icon:"sparkles",url:"https://gemini.google.com",cat:"AI Assistant",bg:"#CED4FA",c:"#534AB7"},
  {id:"google_drive",name:"Google Drive",icon:"brand-google-drive",url:"https://drive.google.com",cat:"Storage",bg:"#FAC775",c:"#854F0B"},
  {id:"github",name:"GitHub",icon:"brand-github",url:"https://github.com",cat:"Development",bg:"#D3D1C7",c:"#444441"},
  {id:"youtube",name:"YouTube",icon:"brand-youtube",url:"https://www.youtube.com",cat:"Media",bg:"#FAC775",c:"#854F0B"},
  {id:"youtube_music",name:"YouTube Music",icon:"music",url:"https://music.youtube.com",cat:"Media",bg:"#FAC775",c:"#854F0B"},
];
const CAT_COLORS={"AI Assistant":"#7F77DD","Research":"#378ADD","Communication":"#1D9E75","Social":"#D4537E","Media":"#E09C2A","Storage":"#E09C2A","Development":"#7F77DD"};
const PALETTES=[{bg:"#CED4FA",c:"#534AB7"},{bg:"#B5D4F4",c:"#185FA5"},{bg:"#9FE1CB",c:"#0F6E56"},{bg:"#F4C0D1",c:"#993556"},{bg:"#FAC775",c:"#854F0B"},{bg:"#D3E4FA",c:"#1A4F8A"},{bg:"#E4D4F4",c:"#6A35A5"},{bg:"#D4F0FA",c:"#155FA0"}];
const WEATHER_ICONS={"Clear":"☀️","Clouds":"☁️","Rain":"🌧️","Drizzle":"🌦️","Thunderstorm":"⛈️","Snow":"❄️","Mist":"🌫️","Haze":"🌫️","Fog":"🌁","default":"🌡️"};

/* ═══════════════════════════════════════════════════
   BACKEND / AUTH CONFIG
   Real Nexus backend (Express + JWT). See js/boot.js for the
   login/register calls that use these.
═══════════════════════════════════════════════════ */
// Deploy: change API_BASE to your live backend URL (e.g. https://your-api.railway.app)
const API_BASE="https://nexus-backend-production-44ae.up.railway.app/";  // <- the ONE line to change for production (no trailing slash)
const API_AUTH=(b=>({LOGIN:`${b}/api/auth/login`,REGISTER:`${b}/api/auth/register`,ME:`${b}/api/auth/me`,USERNAME:`${b}/api/auth/me/username`}))(API_BASE.replace(/\/+$/,""));
/* How often (ms) we poll GET /api/auth/me while logged in to catch an
   admin block in near-real-time. A random 5–8s cadence, re-picked each
   cycle in main.js, avoids every open tab hitting the server in lockstep. */
const ACCOUNT_STATUS_POLL_MIN=5000,ACCOUNT_STATUS_POLL_MAX=8000;

/* ═══════════════════════════════════════════════════
   STATE (localStorage)
═══════════════════════════════════════════════════ */
const LS={
  APPS:"md_apps_v4",FAVS:"md_favs_v4",VIEW:"md_view_v4",SORT:"md_sort_v4",
  NOTES:"md_notes_v4",RECENT:"md_recent_v4",THEME:"md_theme_v4",WALL:"md_wall_v4",
  OVERLAY:"md_overlay_v4",USER:"md_user_v4",AVATAR:"md_avatar_v4",BIO:"md_bio_v4",
  TOKEN:"nexus_jwt_token",CURRENT_USER:"nexus_current_user",
  SHOW_RECENT:"md_showrecent_v4",SHOW_WEATHER:"md_showweather_v4",SHOW_PARTICLES:"md_showparticles_v4",
  CLOCK_FMT:"md_clockfmt_v4",CLOCK_SEC:"md_clocksec_v4",
  WALL_SCOPE:"md_wallscope_v4",LIVE_WALL:"md_livewall_v4",CUSTOM_WALL:"md_customwall_v4"
};
const LS_MIGRATED="nexus_legacy_migrated_v1"; /* global marker — legacy data is only ever migrated once, to whichever user logs in first */

let apps=structuredClone(DEFAULT_APPS); /* placeholders — loadUserState() overwrites these right after login, per user */
let favs=new Set();
let notes=[];
let recent=[];
let activeFilter="All",editingId=null,deletingId=null,openMenuId=null;
let searchQuery="",viewMode="grid",sortMode="default";
let sdIdx=-1,dragSrcId=null;
let showRecent=true,showWeather=true,showParticles=true;
let clockFormat=24,showSeconds=false;
let wallScope="full",liveWall="none",liveWallAnimId=null;

/* ═══════════════════════════════════════════════════
   PER-USER STORAGE NAMESPACE
   Every account gets its own slice of localStorage: nsKey() suffixes
   a base LS.* key with the logged-in user's backend id, so
   "md_apps_v4" becomes "md_apps_v4_3" for user 3, "md_apps_v4_4" for
   user 4, etc. LS.TOKEN/LS.CURRENT_USER are deliberately NEVER
   namespaced — they're what let us know who's logged in before we can
   even compute a namespace.

   SAFETY RULES (these are what keep existing accounts' data intact):
   1. g()/p()/rm() only work while a user is logged in. With no user
      they do NOTHING — they never fall back to the shared/global key,
      so a stray call can't read, write or clobber un-namespaced data.
   2. setCurrentUid() refuses anything that isn't a positive integer.
      Login must never "succeed" into the global namespace.
   3. Nothing here ever overwrites a key that already holds data:
      legacy migration and identity adoption are fill-only-if-empty.
═══════════════════════════════════════════════════ */
let CURRENT_UID=null;
let CURRENT_USERNAME=""; // this tab's login name (lowercase). Kept in memory because LS.CURRENT_USER is shared by every tab of the browser.

function nsKey(baseKey){return CURRENT_UID!=null?`${baseKey}_${CURRENT_UID}`:baseKey;}
/** Namespaced localStorage read. Returns null when nobody is logged in. */
function g(key){return CURRENT_UID!=null?localStorage.getItem(nsKey(key)):null;}
/** Namespaced localStorage remove. No-op when nobody is logged in. */
function rm(key){if(CURRENT_UID!=null)localStorage.removeItem(nsKey(key));}
/** Namespaced localStorage write. Returns true on success, false if blocked
 * (no user) or if the browser refused (e.g. quota) — it never throws. */
function p(key,val){
  if(CURRENT_UID==null){console.warn(`[storage] blocked write to "${key}" — no user is logged in`);return false;}
  try{
    localStorage.setItem(nsKey(key),typeof val==="object"?JSON.stringify(val):String(val));
    return true;
  }catch(err){
    console.error(`[storage] could not save "${key}"`,err);
    const quota=err&&(err.name==="QuotaExceededError"||err.name==="NS_ERROR_DOM_QUOTA_REACHED"||err.code===22);
    toast(quota?"Browser storage is full — that change was not saved":"Couldn't save that change","ti-alert-circle");
    return false;
  }
}
/** Namespaced JSON read. A missing key gives `fallback`. A CORRUPT value also
 * gives `fallback` for this session, but the raw text is first copied to a
 * "__corrupt_backup" key so a later save can't silently destroy it. */
function gJson(key,fallback){
  const raw=g(key);
  if(raw===null)return fallback;
  try{const v=JSON.parse(raw);return v===null?fallback:v;}
  catch(err){
    console.error(`[storage] "${nsKey(key)}" is not valid JSON — using defaults this session`,err);
    try{localStorage.setItem(nsKey(key)+"__corrupt_backup",raw);}catch(e){/* best effort */}
    return fallback;
  }
}

/** Every LS.* key (minus the global TOKEN/CURRENT_USER pair) plus the
 * two extra per-user keys declared in other files (LS_SEARCH_HIST in
 * apps.js, LS_AI in ai-core.js). Referencing those two by name here is
 * safe even though this file loads first — this list is only ever
 * built at call time, by which point every script has loaded. */
function perUserKeys(){
  return [...Object.values(LS).filter(k=>k!==LS.TOKEN&&k!==LS.CURRENT_USER),LS_SEARCH_HIST,LS_AI];
}

/** Re-populates every per-user state variable from the CURRENT_UID's
 * namespaced storage. Call this once, right after CURRENT_UID is set
 * (see setCurrentUid below) and before anything renders. A brand-new
 * user simply has nothing stored yet, so every line below falls back
 * to its default — clean apps grid, empty notes, empty AI config,
 * default display settings. Existing users' stored values always win. */
function loadUserState(){
  /* Everything read from localStorage is UNTRUSTED (it may have been written by an older
     build, a tampered browser profile, or an AI tool call) — validate it on the way in. */
  const savedApps=gJson(LS.APPS,null);
  if(Array.isArray(savedApps)){
    apps=savedApps.map(sanitizeApp).filter(Boolean);
    if(apps.length!==savedApps.length){
      // Something invalid/unsafe was dropped. Keep the original once (for recovery), then store the cleaned list.
      try{const bk=nsKey(LS.APPS)+"__unsafe_backup";if(localStorage.getItem(bk)===null)localStorage.setItem(bk,JSON.stringify(savedApps));}catch(e){/* best effort */}
      console.warn(`[security] dropped ${savedApps.length-apps.length} invalid/unsafe app record(s) while loading`);
      p(LS.APPS,apps);
    }
  }else{
    apps=DEFAULT_APPS.map(sanitizeApp).filter(Boolean);
  }
  const knownIds=new Set(apps.map(a=>a.id));
  const savedFavs=gJson(LS.FAVS,[]);favs=new Set((Array.isArray(savedFavs)?savedFavs:[]).filter(id=>knownIds.has(id)));
  const savedNotes=gJson(LS.NOTES,[]);notes=(Array.isArray(savedNotes)?savedNotes:[]).map(sanitizeNote).filter(Boolean);
  const savedRecent=gJson(LS.RECENT,[]);recent=(Array.isArray(savedRecent)?savedRecent:[]).filter(id=>knownIds.has(id)).slice(0,8);
  activeFilter="All";editingId=null;deletingId=null;openMenuId=null;
  searchQuery="";sdIdx=-1;dragSrcId=null;
  viewMode=g(LS.VIEW)||"grid";
  sortMode=g(LS.SORT)||"default";
  showRecent=g(LS.SHOW_RECENT)!=="false";
  showWeather=g(LS.SHOW_WEATHER)!=="false";
  showParticles=g(LS.SHOW_PARTICLES)!=="false";
  clockFormat=parseInt(g(LS.CLOCK_FMT)||"24");
  showSeconds=g(LS.CLOCK_SEC)==="true";
  wallScope=g(LS.WALL_SCOPE)||"full";
  liveWall=g(LS.LIVE_WALL)||"none";
  const savedHist=gJson(LS_SEARCH_HIST,[]);searchHistory=(Array.isArray(savedHist)?savedHist:[]).filter(x=>typeof x==="string"&&x).slice(0,8);
  const savedAi=gJson(LS_AI,{});aiState=(savedAi&&typeof savedAi==="object"&&!Array.isArray(savedAi))?savedAi:{};
}

/* ── Copy helpers (never overwrite, never delete) ── */
/** True if ANY per-user key exists for this user id. */
function namespaceHasData(userId){
  return perUserKeys().some(k=>localStorage.getItem(`${k}_${userId}`)!==null);
}
/** True if ANY account (any id) already has namespaced data in this browser,
 * i.e. the multi-user era is already in effect. */
function anyNamespacedUserData(){
  const bases=new Set(perUserKeys());
  for(let i=0;i<localStorage.length;i++){
    const m=/^(.*)_(\d+)$/.exec(localStorage.key(i)||"");
    if(m&&bases.has(m[1]))return true;
  }
  return false;
}
/** Copies every per-user key from one id's namespace into another's, but ONLY
 * where the destination key is still empty. Source is left untouched.
 * Returns {copied:[...keys], skipped:[...keys already present at destination]}. */
function copyUserData(fromUid,toUid){
  const copied=[],skipped=[];
  perUserKeys().forEach(k=>{
    const v=localStorage.getItem(`${k}_${fromUid}`);
    if(v===null)return;
    if(localStorage.getItem(`${k}_${toUid}`)!==null){skipped.push(k);return;}
    try{localStorage.setItem(`${k}_${toUid}`,v);copied.push(k);}
    catch(err){console.warn(`[storage] couldn't copy ${k}_${fromUid} → ${k}_${toUid}`,err);skipped.push(k);}
  });
  return{copied,skipped};
}

/** One-time upgrade from the ORIGINAL single-user build (un-namespaced keys
 * like "md_apps_v4"). It only runs when:
 *   • it has never run before (LS_MIGRATED), AND
 *   • no account in this browser has namespaced data yet.
 * So once any account (e.g. NEXUS / id 3) has its own data, legacy keys are
 * never handed to anyone else — a new user always starts clean. It only fills
 * empty destination keys, and only removes a legacy key after the copy has
 * been read back and verified identical. */
function migrateLegacyDataIfNeeded(){
  if(CURRENT_UID==null||localStorage.getItem(LS_MIGRATED))return;
  if(!anyNamespacedUserData()){
    perUserKeys().forEach(k=>{
      const legacyVal=localStorage.getItem(k);
      if(legacyVal===null||localStorage.getItem(nsKey(k))!==null)return;
      try{
        localStorage.setItem(nsKey(k),legacyVal);
        if(localStorage.getItem(nsKey(k))===legacyVal)localStorage.removeItem(k);
      }catch(err){console.warn(`[storage] legacy migration skipped for ${k}`,err);}
    });
  }
  localStorage.setItem(LS_MIGRATED,"1");
}

/* ── Identity map: username → the user id we last saw for it ──
   Ids come from the server's database. If that database is ever rebuilt or
   the account is re-created, "NEXUS" can come back with a different id and
   its data would look "lost" under the old _3 keys. Remembering which id a
   username used lets us carry that data forward (copy-only, fill-only). */
const LS_IDENTITY="nexus_identity_map_v1";
function readIdentityMap(){
  try{const m=JSON.parse(localStorage.getItem(LS_IDENTITY)||"{}");return(m&&typeof m==="object")?m:{};}
  catch(e){return{};}
}
function adoptKnownIdentity(username,userId){
  const name=String(username||"").trim().toLowerCase();
  if(!name)return;
  const map=readIdentityMap();
  const known=Number(map[name]);
  if(Number.isInteger(known)&&known>0&&known!==userId&&!namespaceHasData(userId)&&namespaceHasData(known)){
    const r=copyUserData(known,userId);
    console.info(`[storage] "${name}" was id ${known}, now id ${userId} — carried over ${r.copied.length} key(s); originals left in place.`);
  }
  map[name]=userId;
  try{localStorage.setItem(LS_IDENTITY,JSON.stringify(map));}catch(e){/* best effort */}
}

/** Call right after a successful login with the backend's numeric user id and
 * the username. Order matters: adopt/migrate BEFORE loading, and BEFORE any
 * p() write, so the checks above see the user's data exactly as it was. */
function setCurrentUid(uidValue,username){
  const userId=Number(uidValue);
  if(!Number.isInteger(userId)||userId<=0)throw new Error("Invalid user id from server — storage was not opened.");
  CURRENT_UID=userId;
  CURRENT_USERNAME=String(username||"").trim().toLowerCase();
  try{
    try{adoptKnownIdentity(username,userId);migrateLegacyDataIfNeeded();}
    catch(err){console.error("[storage] identity/migration step failed (no data was changed):",err);}
    loadUserState();
    purgeStoredPasswords();
  }catch(err){CURRENT_UID=null;CURRENT_USERNAME="";throw err;}
}

/** The old Settings screen had a "New Password" box that only ever copied the
 * typed password, in plain text, into localStorage (md_pass_v4[_<id>]) and
 * never changed the real login. Nothing reads it, so it is just a leaked
 * secret sitting in the browser. The feature is gone; this removes any copies
 * (for every account in this browser) the first time anyone logs in. */
function purgeStoredPasswords(){
  const doomed=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i)||"";
    if(/^md_pass_v4(_\d+)?$/.test(k))doomed.push(k);
  }
  doomed.forEach(k=>localStorage.removeItem(k));
  if(doomed.length)console.info(`[storage] removed ${doomed.length} stored plain-text password cop${doomed.length>1?"ies":"y"} (feature removed; it never changed your real password)`);
}
/** Call on logout/lock/block so no per-user read or write can
 * accidentally happen against the wrong (previous) namespace. */
function clearCurrentUid(){CURRENT_UID=null;CURRENT_USERNAME="";}

/** Manual recovery: copies another id's saved data into the CURRENT account
 * (only into keys that are still empty; nothing is overwritten or deleted),
 * e.g. after logging in as NEXUS:   recoverUserData(3)
 * Then reload the page and log in again. */
function recoverUserData(fromUid){
  if(CURRENT_UID==null)throw new Error("Log in first, then run recoverUserData(<oldUserId>).");
  const from=Number(fromUid);
  if(!Number.isInteger(from)||from<=0||from===CURRENT_UID)throw new Error("Give a different, positive user id to copy from.");
  const r=copyUserData(from,CURRENT_UID);
  console.info(`[recover] copied ${r.copied.length} key(s) from id ${from}; skipped ${r.skipped.length} that already had data.`,r);
  return r;
}

/** Wipes every namespaced key for the CURRENT_UID only (plus that user's
 * stored wallpaper image) — used by "Reset ALL data" in Settings. Never
 * touches TOKEN/CURRENT_USER or any other user's data. Returns a Promise. */
function clearAllUserData(){
  const userId=CURRENT_UID;
  perUserKeys().forEach(k=>rm(k));
  return(userId!=null&&typeof deleteUserWallpaperBlobs==="function")?deleteUserWallpaperBlobs(userId):Promise.resolve();
}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
/* ═══════════════════════════════════════════════════════════════════
   SAFE DOM / XSS DEFENCE — the one place all untrusted text goes through
   ───────────────────────────────────────────────────────────────────
   RULES the rest of the code base follows (please keep following them):
     1. Never build HTML strings out of dynamic data. Build nodes with h()
        (or createElement + textContent). Text is ALWAYS a text node, so
        "<img src=x onerror=…>" is displayed literally and can never run.
     2. Never give a URL to href / src / window.open() without safeUrl() or
        openSafe(). Only absolute http(s) URLs pass — javascript:, data:,
        vbscript: … never do (checked on the PARSED url, so tricks like
        "jav\tascript:" or " JaVaScRiPt:" are caught too).
     3. Anything that lands in a class / style / id value goes through
        safeHex() / safeIconName() / safeId().
     4. Data read back from localStorage is untrusted too: sanitizeApp() and
        friends run when a user's state is loaded (see loadUserState).
   esc() stays only for the rare place a string must still be escaped by hand.
═══════════════════════════════════════════════════════════════════ */
const _ESC_MAP={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;"};
/** Escapes & < > " ' ` — safe for HTML text AND for quoted attribute values. */
function esc(s){return String(s==null?"":s).replace(/[&<>"'`]/g,c=>_ESC_MAP[c]);}

/** Returns the normalised absolute http(s) URL, or "" if it is anything else. */
function safeUrl(u){
  if(typeof u!=="string")return "";
  const s=u.trim();
  if(!s||s.length>2048)return "";
  let url;
  try{url=new URL(s);}catch(e){return "";}
  return(url.protocol==="http:"||url.protocol==="https:")?url.href:"";
}
/** window.open() that refuses anything safeUrl() rejects. */
function openSafe(u){
  const s=safeUrl(u);
  if(!s){try{toast("Blocked an unsafe link","ti-alert-circle");}catch(e){}return null;}
  return window.open(s,"_blank","noopener,noreferrer");
}

const _HEX6=/^#[0-9a-fA-F]{6}$/;
/** "#rrggbb" only (alpha is appended by the callers), else `fallback`. */
function safeHex(v,fallback){return(typeof v==="string"&&_HEX6.test(v.trim()))?v.trim():fallback;}
/** Tabler icon name ("movie", "brand-github"); anything else → "globe". */
function safeIconName(v){
  const s=String(v==null?"":v).trim().replace(/^ti-/i,"");
  return(s.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(s))?s.toLowerCase():"globe";
}
const _SAFE_ID=/^[A-Za-z0-9_-]{1,64}$/;
/** Record id usable inside an id="" attribute / dataset; else null. */
function safeId(v){return(typeof v==="string"&&_SAFE_ID.test(v))?v:null;}
/** Category dot colour — own-property lookup so "__proto__" etc. can't leak through. */
function catColorFor(cat){return Object.prototype.hasOwnProperty.call(CAT_COLORS,cat)?CAT_COLORS[cat]:"#7f77dd";}
/** {bg,c} for an app: its own colours if (and only if) both are valid hex, else derived from the category. */
function appPalette(app){
  const bg=safeHex(app&&app.bg),c=safeHex(app&&app.c);
  return(bg&&c)?{bg,c}:colorForCat(app&&app.cat);
}

/** Cleans one app record (from storage, the form, or an AI tool call).
 *  Returns a brand-new, fully validated object — or null if it can't be made safe. */
function sanitizeApp(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const url=safeUrl(raw.url);
  const name=String(raw.name==null?"":raw.name).trim().slice(0,120);
  if(!url||!name)return null;
  const cat=String(raw.cat==null?"":raw.cat).trim().slice(0,60)||"Other";
  const bg=safeHex(raw.bg),c=safeHex(raw.c);
  const pal=(bg&&c)?{bg,c}:colorForCat(cat);
  return{id:safeId(raw.id)||uid(),name,url,icon:safeIconName(raw.icon),cat,bg:pal.bg,c:pal.c};
}
/** Cleans one note record from storage. */
function sanitizeNote(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const title=String(raw.title==null?"":raw.title),body=String(raw.body==null?"":raw.body);
  if(!title&&!body)return null;
  return{id:safeId(raw.id)||uid(),title:title||"Untitled",body,date:String(raw.date==null?"":raw.date)};
}

/** Tiny hyperscript: h("a",{class:"x",href:url},"text",childNode,…) → a real element.
 *  – children that are strings/numbers become TEXT NODES (never parsed as HTML)
 *  – href/src only accept http(s) URLs (anything else is simply not set)
 *  – on* attributes are refused: wire events with addEventListener
 *  – style:{…} goes through the CSSOM, so a hostile value can't break out of the declaration */
function h(tag,props,...kids){
  const el=document.createElement(tag);
  if(props){
    for(const k of Object.keys(props)){
      const v=props[k];
      if(v==null||v===false)continue;
      if(/^on/i.test(k))throw new Error(`h(): "${k}" is not allowed — attach events with addEventListener`);
      if(k==="class"||k==="className")el.className=String(v);
      else if(k==="style"&&typeof v==="object"){
        for(const sk of Object.keys(v)){
          if(sk.startsWith("--"))el.style.setProperty(sk,String(v[sk]));else el.style[sk]=String(v[sk]);
        }
      }
      else if(k==="dataset"&&typeof v==="object"){for(const dk of Object.keys(v))el.dataset[dk]=String(v[dk]);}
      else if(k==="href"||k==="src"){const u=safeUrl(String(v));if(u)el.setAttribute(k,u);}
      else el.setAttribute(k,v===true?"":String(v));
    }
  }
  _appendKids(el,kids);
  return el;
}
function _appendKids(parent,kids){
  for(const k of kids){
    if(k==null||k===false||k===true)continue;
    if(Array.isArray(k))_appendKids(parent,k);
    else if(k instanceof Node)parent.appendChild(k);
    else parent.appendChild(document.createTextNode(String(k)));
  }
}
/** Text with every case-insensitive match of `q` wrapped in <mark> — built from nodes, never HTML. */
function highlightText(text,q){
  text=String(text==null?"":text);
  const frag=document.createDocumentFragment();
  if(!q){frag.appendChild(document.createTextNode(text));return frag;}
  const re=new RegExp("("+String(q).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");
  text.split(re).forEach((part,i)=>{
    if(!part)return;
    frag.appendChild(i%2===1?h("mark",null,part):document.createTextNode(part));
  });
  return frag;
}
function colorForCat(cat){const h=Math.abs(String(cat==null?"":cat).split("").reduce((a,c)=>a+c.charCodeAt(0),0));return PALETTES[h%PALETTES.length];}

/* ── Auth token helpers (backend JWT) ──
   getAuthToken()/setAuthToken() wrap localStorage so the rest of the
   app (and future authenticated fetch() calls) has one place to read
   the token from. authHeaders() is a ready-to-spread Authorization header. */
function getAuthToken(){return localStorage.getItem(LS.TOKEN);}
function setAuthToken(token){if(token)localStorage.setItem(LS.TOKEN,token);else localStorage.removeItem(LS.TOKEN);}
function authHeaders(){const t=getAuthToken();return t?{"Authorization":`Bearer ${t}`}:{};}

/* ── Profile text rules (shared by the register form, the Edit Profile dialog and the popup) ──
   Username = the LOGIN name: only a-z and 0-9, always lowercase, 8–30 characters. The server enforces the
   same rules (routes/auth.js). Display name and bio are free text that lives in this account's own storage. */
const USERNAME_MIN_LETTERS=5,USERNAME_MIN_DIGITS=1,USERNAME_MAX=30,DISPLAY_NAME_MAX=40,BIO_MAX=1000;
const _TEXT_JUNK=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g; // control + bidi-override characters
function _cutSafe(str,max){ // never splits a surrogate pair (emoji)
  if(str.length<=max)return str;
  let t=str.slice(0,max);const c=t.charCodeAt(t.length-1);
  return(c>=0xD800&&c<=0xDBFF)?t.slice(0,-1):t;
}
/* USERNAME RULES (the server enforces the very same ones — routes/auth.js):
     • only a–z, 0–9 and hyphen (-)          • at least 5 letters (a–z)       • at least 1 digit (0–9)
     • no spaces (typed spaces become "-")   • always lowercase               • 30 characters at most
   e.g.  nexus-nexi1088 ✓  lord12345 ✓  sainath9 ✓   |   nexus ✗ (no digit)  12345678 ✗ (no 5 letters)  "nexus nexi1088" ✗ (space) */
const USERNAME_MSG={
  empty:"Choose a username.",
  chars:"Only letters a–z, numbers 0–9 and hyphens (-) are allowed.",
  letters:`Needs at least ${USERNAME_MIN_LETTERS} letters (a–z).`,
  digit:`Needs at least ${USERNAME_MIN_DIGITS} number (0–9).`,
  max:`Can be at most ${USERNAME_MAX} characters.`,
  spaceFixed:"Spaces aren't allowed — we used a hyphen (-) instead."
};
/** While typing/pasting: lowercase, drop leading spaces, turn spaces BETWEEN characters into "-".
 *  (A trailing space is left alone until the next character, so a stray space at the end never becomes a hyphen.) */
function typingUsername(v){return String(v==null?"":v).toLowerCase().replace(/^\s+/,"").replace(/\s+(?=\S)/g,"-");}
/** What gets validated and sent: trimmed + typingUsername. */
function normalizeUsername(v){return typingUsername(String(v==null?"":v).trim());}
/** EVERY rule the (normalized) username breaks, as messages — [] when it is acceptable. */
function usernameProblems(name){
  if(!name)return[USERNAME_MSG.empty];
  const out=[];
  if(/[^a-z0-9-]/.test(name))out.push(USERNAME_MSG.chars);
  if((name.match(/[a-z]/g)||[]).length<USERNAME_MIN_LETTERS)out.push(USERNAME_MSG.letters);
  if((name.match(/[0-9]/g)||[]).length<USERNAME_MIN_DIGITS)out.push(USERNAME_MSG.digit);
  if(name.length>USERNAME_MAX)out.push(USERNAME_MSG.max);
  return out;
}
/** "" if acceptable, otherwise all broken rules joined (default: one line; pass "\n" for a list). */
function usernameError(name,sep){return usernameProblems(name).join(sep==null?" ":sep);}
/** Hooks a text input so it lowercases and converts spaces as you type, keeping the caret in place. */
function wireUsernameInput(el,onChange){
  el.addEventListener("input",()=>{
    const v=el.value,nv=typingUsername(v);
    const spaced=/\S\s+\S/.test(v); // a space was typed between characters → it is about to become "-"
    if(v!==nv){
      const pos=el.selectionStart;
      el.value=nv;
      try{const np=typingUsername(v.slice(0,pos)).length;el.setSelectionRange(np,np);}catch(e){/* not a text input */}
    }
    if(onChange)onChange(spaced);
  });
}
function sanitizeDisplayName(v){
  if(typeof v!=="string")return"";
  return _cutSafe(v.replace(_TEXT_JUNK,"").replace(/\s+/g," ").trim(),DISPLAY_NAME_MAX);
}
function sanitizeBio(v){
  if(typeof v!=="string")return"";
  return _cutSafe(v.replace(/\r\n?/g,"\n").replace(_TEXT_JUNK,"").trim(),BIO_MAX);
}

/** Reads the (unverified — display/consistency use only) payload of a JWT. */
function decodeJwtPayload(token){
  try{
    const part=String(token).split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(part));
  }catch(e){return null;}
}
/** Works out WHICH account just logged in, as a positive integer — from the
 * server's `user.id`, cross-checked against the id inside the JWT. Throws
 * (so login stops) rather than ever guessing or using the global namespace. */
function resolveUserId(loginData){
  const ok=n=>Number.isInteger(n)&&n>0;
  const fromUser=Number(loginData?.user?.id);
  const fromToken=Number(decodeJwtPayload(loginData?.token)?.id);
  if(ok(fromUser)&&ok(fromToken)&&fromUser!==fromToken)
    throw new Error("The server returned two different user ids. Nothing was loaded or changed.");
  if(ok(fromUser))return fromUser;
  if(ok(fromToken))return fromToken;
  throw new Error("Login worked but the server sent no valid user id. Nothing was loaded or changed.");
}

/* TOAST */
let tTimer;
function toast(msg,icon="ti-check",gold=false){
  clearTimeout(tTimer);const t=document.getElementById("toast");
  document.getElementById("toastMsg").textContent=msg;
  const ic=document.getElementById("toastIcon");ic.className=`ti ${icon}`;ic.style.color=gold?"var(--gold)":"var(--accent2)";
  t.classList.add("show");tTimer=setTimeout(()=>t.classList.remove("show"),2500);
}
