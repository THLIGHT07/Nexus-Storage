/* ============================================================
   CLOUD.JS — Cloud storage: each account's data lives on the server
   (PostgreSQL, via /api/me/*). Loads right after utils.js.
   ------------------------------------------------------------
   HOW IT FITS TOGETHER
   • The backend is the source of truth. localStorage (the per-user
     namespaced keys from utils.js) is only a CACHE of it: the UI keeps
     reading g()/gJson() exactly as before, and every p()/rm() that
     changes a value tells this file (cloudNotify) so it can be saved.
   • Login:   GET /api/me/bootstrap → cache is overwritten with the
              account's cloud data → loadUserState() reads it.
   • Saving:  changes are queued per area (profile / settings / apps /
              notes), debounced, and sent in the background. The screen
              updates instantly; failures retry with back-off and the
              unsaved areas are remembered ("dirty") even across reloads.
   • Logout / lock / block / expired session: unsaved changes are sent
              first, then the cache for that account is wiped. Anything
              that could NOT be sent is kept and pushed at the next login.
   • Existing data in this browser that the cloud has never seen is
              offered for a one-time import (it is never uploaded or
              thrown away without the user choosing).
   • Different accounts never mix: every request carries that
              session's own token and every cache access names its own
              user id, so a slow save from account A can't touch B.
   ============================================================ */
(window.__nexusParts=window.__nexusParts||{})["cloud.js"]="2026-10-02-xss1";

const API_ME=`${API_BASE.replace(/\/+$/,"")}/api/me`; // derived from the single API_BASE in utils.js
const CLOUD_DOMAINS=["profile","settings","apps","notes"];
const CLOUD_DEBOUNCE_MS={profile:900,settings:900,apps:700,notes:500};
const CLOUD_RETRY_MS=[2000,5000,15000,30000,60000];
const CLOUD_REFRESH_AFTER_MS=20000;   // returning to the tab after this long re-checks the cloud
const CLOUD_EXIT_FLUSH_MS=4000;       // how long logout waits for pending saves
const CLOUD_BULK_NOTES_MAX_BYTES=1800000;
const LS_CLOUD_DIRTY="nexus_cloud_dirty_v1";       // + "_<uid>": areas with changes the server hasn't confirmed
const LS_CLOUD_NOTEBASE="nexus_cloud_notebase_v1"; // + "_<uid>": which notes the server is known to have

let cloudSession=null; // { uid, username, token, dirty:Set, ver, timers, inflight, rerun, retry, paused:Set, noteBase:Map, plan, ... }
let cloudQuietDepth=0; // >0 while cache writes must NOT be queued for upload (startup defaults, applying cloud data)

/* ── tiny helpers ── */
const cloudSleep=ms=>new Promise(r=>setTimeout(r,ms));
function cloudQuiet(fn){cloudQuietDepth++;try{return fn();}finally{cloudQuietDepth--;}}
/* Cache access with an EXPLICIT user id: logout/background work must never depend on CURRENT_UID. */
const cGet=(uid,key)=>{try{return localStorage.getItem(`${key}_${uid}`);}catch(e){return null;}};
const cSet=(uid,key,val)=>{try{localStorage.setItem(`${key}_${uid}`,typeof val==="string"?val:JSON.stringify(val));return true;}catch(e){console.warn("[cloud] cache write failed",key,e);return false;}};
const cDel=(uid,key)=>{try{localStorage.removeItem(`${key}_${uid}`);}catch(e){/* best effort */}};
function cJson(uid,key,fallback){const raw=cGet(uid,key);if(raw===null)return fallback;try{const v=JSON.parse(raw);return v===null?fallback:v;}catch(e){return fallback;}}

/* ═══════════════════════════════════════════════════
   WHICH CACHE KEY BELONGS TO WHICH CLOUD AREA
   (lazy: LS_SEARCH_HIST / LS_AI are declared in scripts that load after this one)
═══════════════════════════════════════════════════ */
function cloudKeys(){return{
  profile:[LS.USER,LS.AVATAR,LS.BIO],
  settings:[LS.THEME,LS.WALL,LS.OVERLAY,LS.VIEW,LS.SORT,LS.SHOW_RECENT,LS.SHOW_WEATHER,LS.SHOW_PARTICLES,LS.CLOCK_FMT,LS.CLOCK_SEC,LS.WALL_SCOPE,LS.LIVE_WALL,LS.CUSTOM_WALL,LS_SEARCH_HIST,LS_AI],
  apps:[LS.APPS,LS.FAVS,LS.RECENT],
  notes:[LS.NOTES]
};}
/** [json key in the cloud settings object, cache key, type: s=string b=boolean n=number j=json] */
function cloudSettingsMap(){return[
  ["theme",LS.THEME,"s"],["wall",LS.WALL,"s"],["overlay",LS.OVERLAY,"s"],["view",LS.VIEW,"s"],["sort",LS.SORT,"s"],
  ["showRecent",LS.SHOW_RECENT,"b"],["showWeather",LS.SHOW_WEATHER,"b"],["showParticles",LS.SHOW_PARTICLES,"b"],
  ["clockFormat",LS.CLOCK_FMT,"n"],["showSeconds",LS.CLOCK_SEC,"b"],
  ["wallScope",LS.WALL_SCOPE,"s"],["liveWall",LS.LIVE_WALL,"s"],["customWall",LS.CUSTOM_WALL,"s"],
  ["searchHistory",LS_SEARCH_HIST,"j"],["ai",LS_AI,"j"]
];}
let _cloudDomainOfKey=null;
function cloudDomainOfKey(key){
  if(!_cloudDomainOfKey){_cloudDomainOfKey=new Map();const k=cloudKeys();for(const d of CLOUD_DOMAINS)k[d].forEach(x=>_cloudDomainOfKey.set(x,d));}
  return _cloudDomainOfKey.get(key)||null;
}

/* ═══════════════════════════════════════════════════
   CACHE ⇄ CLOUD SHAPES (all take an explicit uid)
═══════════════════════════════════════════════════ */
function cloudReadProfile(uid){return{displayName:cGet(uid,LS.USER)||"",avatar:cGet(uid,LS.AVATAR)||"",bio:cGet(uid,LS.BIO)||""};}
function cloudReadSettings(uid){
  const out={};
  for(const[jk,lk,t]of cloudSettingsMap()){
    const raw=cGet(uid,lk);if(raw===null)continue;
    if(t==="s")out[jk]=raw;
    else if(t==="b")out[jk]=raw==="true";
    else if(t==="n"){const n=parseInt(raw,10);if(Number.isFinite(n))out[jk]=n;}
    else{try{const v=JSON.parse(raw);if(v!==null&&typeof v==="object")out[jk]=v;}catch(e){/* corrupt value: leave it out */}}
  }
  return out;
}
function cloudReadApps(uid){
  const raw=cJson(uid,LS.APPS,null);
  const seen=new Set();
  const list=(Array.isArray(raw)?raw:DEFAULT_APPS).map(sanitizeApp).filter(a=>a&&!seen.has(a.id)&&seen.add(a.id));
  const ids=new Set(list.map(a=>a.id));
  const fav=cJson(uid,LS.FAVS,[]),rec=cJson(uid,LS.RECENT,[]);
  return{apps:list,
    favs:[...new Set((Array.isArray(fav)?fav:[]).filter(id=>ids.has(id)))],
    recent:[...new Set((Array.isArray(rec)?rec:[]).filter(id=>ids.has(id)))].slice(0,8)};
}
function cloudReadNotes(uid){
  const raw=cJson(uid,LS.NOTES,[]);
  const seen=new Set();
  return(Array.isArray(raw)?raw:[]).map(sanitizeNote).filter(n=>n&&!seen.has(n.id)&&seen.add(n.id));
}
const cloudNoteSig=n=>JSON.stringify([n.title,n.body,n.date||""]);
function cloudReadDomain(uid,d){
  if(d==="profile")return cloudReadProfile(uid);
  if(d==="settings")return cloudReadSettings(uid);
  if(d==="apps")return cloudReadApps(uid);
  return cloudReadNotes(uid);
}

/** Server note → the local note shape. (Older notes have no date label: derive one from updatedAt.) */
function cloudNoteFromServer(n){
  let date=typeof n.date==="string"?n.date:"";
  if(!date&&n.updatedAt){const t=new Date(n.updatedAt);if(!isNaN(t))date=`${t.getDate()}/${t.getMonth()+1} ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`;}
  return sanitizeNote({id:n.id,title:n.title,body:n.body,date});
}

/** Writes one area's CLOUD data into the cache (no upload is queued — these use the explicit-uid helpers). */
function cloudApplyDomain(s,d,boot){
  const uid=s.uid;
  if(d==="profile"){
    const pr=boot.profile||{};
    cSet(uid,LS.USER,pr.displayName||s.username);
    if(pr.avatar)cSet(uid,LS.AVATAR,pr.avatar);else cDel(uid,LS.AVATAR);
    if(pr.bio)cSet(uid,LS.BIO,pr.bio);else cDel(uid,LS.BIO);
  }else if(d==="settings"){
    const obj=boot.settings&&typeof boot.settings==="object"&&!Array.isArray(boot.settings)?boot.settings:{};
    for(const[jk,lk,t]of cloudSettingsMap()){
      const has=Object.prototype.hasOwnProperty.call(obj,jk)&&obj[jk]!==null&&obj[jk]!==undefined;
      if(!has){cDel(uid,lk);continue;}
      const v=obj[jk];
      if(t==="j"){
        const ok=(jk==="searchHistory")?Array.isArray(v):(v&&typeof v==="object"&&!Array.isArray(v));
        if(ok)cSet(uid,lk,v);else cDel(uid,lk);
      }else cSet(uid,lk,String(v));
    }
  }else if(d==="apps"){
    cSet(uid,LS.APPS,Array.isArray(boot.apps)?boot.apps:[]);
    cSet(uid,LS.FAVS,Array.isArray(boot.favs)?boot.favs:[]);
    cSet(uid,LS.RECENT,Array.isArray(boot.recent)?boot.recent:[]);
  }else if(d==="notes"){
    const list=(Array.isArray(boot.notes)?boot.notes:[]).map(cloudNoteFromServer).filter(Boolean);
    cSet(uid,LS.NOTES,list);
    s.noteBase=new Map(list.map(n=>[n.id,cloudNoteSig(n)]));
    cloudPersistNoteBase(s);
  }
}
/** Cloud has nothing for this area and neither does the browser → clean defaults. */
function cloudApplyDefaults(s,d){
  if(d==="profile"){cSet(s.uid,LS.USER,s.username);cDel(s.uid,LS.AVATAR);cDel(s.uid,LS.BIO);}
  else cloudKeys()[d].forEach(k=>cDel(s.uid,k));
  if(d==="notes"){s.noteBase=new Map();cloudPersistNoteBase(s);}
}
/** Does this browser hold real data for the area? (Defaults written by the app itself don't count.) */
function cloudLocalInfo(s,d){
  const uid=s.uid;
  if(d==="profile"){
    const u=cGet(uid,LS.USER);
    const has=cGet(uid,LS.AVATAR)!==null||cGet(uid,LS.BIO)!==null||(u!==null&&u.trim().toLowerCase()!==s.username.toLowerCase());
    return{has,count:has?1:0};
  }
  if(d==="settings"){const has=cloudKeys().settings.some(k=>cGet(uid,k)!==null);return{has,count:has?1:0};}
  if(d==="apps"){
    const fav=cJson(uid,LS.FAVS,[]),rec=cJson(uid,LS.RECENT,[]);
    const has=cGet(uid,LS.APPS)!==null||(Array.isArray(fav)&&fav.length>0)||(Array.isArray(rec)&&rec.length>0);
    return{has,count:has?cloudReadApps(uid).apps.length:0};
  }
  const n=cloudReadNotes(uid).length;return{has:n>0,count:n};
}

/* ── dirty markers + known-notes snapshot (persisted, so a crash / offline edit is never forgotten) ── */
function cloudReadDirty(uid){
  try{const a=JSON.parse(localStorage.getItem(`${LS_CLOUD_DIRTY}_${uid}`)||"[]");return new Set((Array.isArray(a)?a:[]).filter(d=>CLOUD_DOMAINS.includes(d)));}
  catch(e){return new Set();}
}
function cloudPersistDirty(s){
  try{
    const key=`${LS_CLOUD_DIRTY}_${s.uid}`;
    if(s.dirty.size)localStorage.setItem(key,JSON.stringify([...s.dirty]));else localStorage.removeItem(key);
  }catch(e){console.warn("[cloud] could not persist dirty markers",e);}
}
function cloudReadNoteBase(uid){
  try{const o=JSON.parse(localStorage.getItem(`${LS_CLOUD_NOTEBASE}_${uid}`)||"{}");return new Map(Object.entries(o&&typeof o==="object"?o:{}));}
  catch(e){return new Map();}
}
function cloudPersistNoteBase(s){
  try{localStorage.setItem(`${LS_CLOUD_NOTEBASE}_${s.uid}`,JSON.stringify(Object.fromEntries(s.noteBase)));}catch(e){/* best effort */}
}

/* ═══════════════════════════════════════════════════
   HTTP
═══════════════════════════════════════════════════ */
function cloudErr(status,message,extra){return Object.assign(new Error(message),{status,...(extra||{})});}
async function cloudApi(token,path,{method="GET",body,keepalive=false}={}){
  let res;
  try{
    res=await fetch(API_ME+path,{method,keepalive,
      headers:{...(body!==undefined?{"Content-Type":"application/json"}:{}),"Authorization":`Bearer ${token}`},
      body:body!==undefined?JSON.stringify(body):undefined});
  }catch(e){throw cloudErr(0,`Can't reach the Nexus server at ${API_BASE}.`,{network:true});}
  let data=null;try{data=await res.json();}catch(e){/* non-JSON body */}
  if(!res.ok){
    throw cloudErr(res.status,(data&&data.error)||`Request failed (HTTP ${res.status}).`,{retryAfter:Number(res.headers.get("Retry-After"))||0,data:data||{}});
  }
  return data||{};
}

/* ═══════════════════════════════════════════════════
   SESSION START (called by the login handler in boot.js)
═══════════════════════════════════════════════════ */
function cloudNewSession(uid,username,token){
  return{uid,username:String(username||"").trim().toLowerCase(),token,dirty:new Set(),ver:{},timers:{},inflight:{},rerun:{},retry:{},
    paused:new Set(),noteBase:new Map(),plan:null,ending:false,dead:false,offlineToast:false,hiddenAt:0,failedToast:{}};
}
function cloudLoginError(err){
  if(err.network)return err;
  if(err.status===403)return cloudErr(403,err.message||"This account has been blocked.");
  if(err.status===401)return cloudErr(401,"Your sign-in could not be verified. Please try again.");
  return cloudErr(err.status||0,`Signed in, but your cloud data could not be loaded (${err.message||"server error"}). Please try again.`);
}

/**
 * Fetches the account's cloud data and decides, per area, what the cache should hold:
 *   unsynced local edits (dirty)        → keep local, push it
 *   cloud has the area                  → cloud wins (cache overwritten)
 *   cloud empty, browser has real data  → offer a one-time import (browser data stays in use until answered)
 *   cloud empty, browser empty          → clean defaults
 * Resolves with the plan; throws (and starts NO session) if the cloud can't be reached.
 */
async function cloudStartSession({uid,username,token}){
  const s=cloudNewSession(uid,username,token);
  let boot;
  try{boot=await cloudApi(token,"/bootstrap");}catch(err){throw cloudLoginError(err);}
  const init=boot.initialized||{};
  const dirty=cloudReadDirty(uid);
  const plan={import:[],pushDirty:[],counts:{}};
  for(const d of CLOUD_DOMAINS){
    if(dirty.has(d)){plan.pushDirty.push(d);continue;}
    if(init[d]){cloudApplyDomain(s,d,boot);continue;}
    const info=cloudLocalInfo(s,d);
    if(info.has){plan.import.push(d);plan.counts[d]=info.count;}
    else cloudApplyDefaults(s,d);
  }
  if(plan.pushDirty.includes("notes"))s.noteBase=cloudReadNoteBase(uid); // what the server is known to have; we diff against it
  else if(plan.import.includes("notes"))s.noteBase=new Map();
  plan.pushDirty.forEach(d=>s.dirty.add(d));
  plan.import.forEach(d=>s.paused.add(d)); // nothing from this browser is uploaded until the user says so
  s.plan=plan;
  cloudSession=s;
  return plan;
}

/** Runs after the dashboard is up: asks about importing, or pushes leftover unsaved changes. */
function cloudAfterLogin(plan){
  const s=cloudSession;if(!s||!plan)return;
  if(plan.import.length)cloudOpenImportModal();
  if(plan.pushDirty.length){
    plan.pushDirty.forEach(d=>cloudScheduleFlush(s,d,100));
    cloudWhenIdle(s).then(()=>{if(cloudSession===s)return cloudRefresh(s,{force:true});}).catch(()=>{});
  }
}
function cloudWhenIdle(s,timeoutMs=20000){
  return new Promise(resolve=>{
    const t0=Date.now();
    const tick=()=>{if(cloudSession!==s||(!s.dirty.size&&!Object.values(s.inflight).some(Boolean))||Date.now()-t0>timeoutMs)return resolve();setTimeout(tick,150);};
    tick();
  });
}

/* ═══════════════════════════════════════════════════
   SAVING
═══════════════════════════════════════════════════ */
/** utils.js calls this from p()/rm() when a stored value actually CHANGED. */
function cloudNotify(key){
  const s=cloudSession;
  if(!s||cloudQuietDepth>0||s.uid!==CURRENT_UID)return;
  const d=cloudDomainOfKey(key);
  if(!d||s.paused.has(d))return;
  s.ver[d]=(s.ver[d]||0)+1;
  if(!s.dirty.has(d)){s.dirty.add(d);cloudPersistDirty(s);}
  cloudScheduleFlush(s,d);
}
function cloudScheduleFlush(s,d,delay){
  clearTimeout(s.timers[d]);
  s.timers[d]=setTimeout(()=>{cloudFlushDomain(s,d);},delay===undefined?CLOUD_DEBOUNCE_MS[d]:delay);
}

async function cloudPushDomain(s,d,{keepalive=false}={}){
  const uid=s.uid,tok=s.token;
  if(d==="profile")return cloudApi(tok,"/profile",{method:"PUT",body:cloudReadProfile(uid),keepalive});
  if(d==="settings")return cloudApi(tok,"/settings",{method:"PUT",body:{settings:cloudReadSettings(uid)},keepalive});
  if(d==="apps")return cloudApi(tok,"/apps",{method:"PUT",body:cloudReadApps(uid),keepalive});
  /* notes: only what changed since the server's known state — new/edited notes first (oldest first so the
     newest keeps the newest timestamp), then deletions. Idempotent, so a retry is always safe. */
  const cur=cloudReadNotes(uid);
  const curIds=new Set(cur.map(n=>n.id));
  for(const n of [...cur].reverse()){
    const sig=cloudNoteSig(n);
    if(s.noteBase.get(n.id)===sig)continue;
    await cloudApi(tok,`/notes/${encodeURIComponent(n.id)}`,{method:"PUT",body:{title:n.title,body:n.body,date:n.date||""}});
    s.noteBase.set(n.id,sig);cloudPersistNoteBase(s);
  }
  for(const id of [...s.noteBase.keys()]){
    if(curIds.has(id))continue;
    try{await cloudApi(tok,`/notes/${encodeURIComponent(id)}`,{method:"DELETE"});}
    catch(err){if(err.status!==404)throw err;}
    s.noteBase.delete(id);cloudPersistNoteBase(s);
  }
}

async function cloudFlushDomain(s,d){
  if(cloudSession!==s&&!s.ending)return;      // that session is over (or replaced by another account)
  if(!s.dirty.has(d)||s.dead)return;
  if(s.inflight[d]){s.rerun[d]=true;return;}
  s.inflight[d]=true;
  const v=s.ver[d]||0;
  try{
    await cloudPushDomain(s,d);
    s.retry[d]=0;s.offlineToast=false;delete s.failedToast[d];
    if((s.ver[d]||0)===v){s.dirty.delete(d);cloudPersistDirty(s);}else s.rerun[d]=true; // edited again while saving
  }catch(err){
    cloudHandleSyncError(s,d,err);
  }finally{
    s.inflight[d]=false;
    if(s.rerun[d]){s.rerun[d]=false;if(!s.ending)cloudScheduleFlush(s,d,50);}
  }
}

function cloudHandleSyncError(s,d,err){
  if(s.ending||cloudSession!==s)return;       // logging out: the end-of-session code decides what to keep
  if(err.status===401){cloudSessionExpired(s);return;}
  if(err.status===403){showBlockedScreen();return;}
  if(err.status===400||err.status===409||err.status===413){
    // The server refused this data itself — retrying the same thing can't help. It stays marked unsaved, so the
    // next change (or the next login) tries again.
    console.warn(`[cloud] ${d} rejected by the server:`,err.message);
    if(!s.failedToast[d]){s.failedToast[d]=true;toast(`Couldn't save your ${d} to the cloud: ${err.message}`,"ti-alert-circle");}
    return;
  }
  const i=s.retry[d]||0;s.retry[d]=i+1;
  const wait=err.status===429&&err.retryAfter?err.retryAfter*1000:CLOUD_RETRY_MS[Math.min(i,CLOUD_RETRY_MS.length-1)];
  if(!s.offlineToast){s.offlineToast=true;toast("Can't reach cloud storage — your changes are kept and will sync automatically","ti-cloud-off");}
  cloudScheduleFlush(s,d,wait);
}

function cloudSessionExpired(s){
  if(cloudSession!==s)return;
  s.dead=true; // the token is useless now; unsaved areas stay marked and are pushed after the next sign-in
  signOut();
  setTimeout(()=>{try{setLoginError("Your session expired. Please sign in again.");}catch(e){/* login screen not ready */}},0);
}

/* Best-effort save while the page is closing (fetch keepalive). Whatever doesn't make it stays marked unsaved. */
window.addEventListener("pagehide",()=>{
  const s=cloudSession;if(!s||s.dead)return;
  for(const d of s.dirty){
    if(d==="notes")continue; // several small requests — can't be done reliably here; the marker keeps it for next login
    try{cloudPushDomain(s,d,{keepalive:true}).catch(()=>{});}catch(e){/* ignore */}
  }
});
window.addEventListener("online",()=>{
  const s=cloudSession;if(!s)return;
  for(const d of s.dirty)cloudScheduleFlush(s,d,300);
});

/* ═══════════════════════════════════════════════════
   END OF SESSION (logout / lock / block / expired / delete)
═══════════════════════════════════════════════════ */
function cloudClearCache(uid,domains){
  const keys=cloudKeys();
  domains.forEach(d=>keys[d].forEach(k=>cDel(uid,k)));
}
/**
 * Detaches the current cloud session immediately (no further saves are queued), then — in the background —
 * sends what is still unsaved and wipes this account's cache. Areas that could not be sent (or that are waiting
 * for an import decision) keep their cache, so nothing the user typed is ever silently lost.
 *   flush:false  → don't try to send (blocked account / dead token)      discard:true → wipe everything, send nothing
 */
function cloudEndSession({flush=true,discard=false}={}){
  const s=cloudSession;
  if(!s)return Promise.resolve();
  cloudSession=null;
  s.ending=true;
  Object.values(s.timers).forEach(clearTimeout);
  cloudCloseImportModal();
  return(async()=>{
    try{
      if(!discard&&flush&&!s.dead&&s.dirty.size){
        const run=Promise.all([...s.dirty].map(d=>{s.inflight[d]=false;return cloudFlushDomain(s,d);}));
        await Promise.race([run,cloudSleep(CLOUD_EXIT_FLUSH_MS)]);
      }
    }catch(err){console.warn("[cloud] final save failed",err);}
    if(cloudSession&&cloudSession.uid===s.uid)return; // the same account signed in again meanwhile: its fresh cache must stay
    if(discard){
      cloudClearCache(s.uid,CLOUD_DOMAINS);
      try{localStorage.removeItem(`${LS_CLOUD_DIRTY}_${s.uid}`);localStorage.removeItem(`${LS_CLOUD_NOTEBASE}_${s.uid}`);}catch(e){/* ignore */}
      return;
    }
    const keep=new Set([...s.dirty,...s.paused]);
    cloudClearCache(s.uid,CLOUD_DOMAINS.filter(d=>!keep.has(d)));
    cloudPersistDirty(s);
    if(!s.dirty.has("notes")){try{localStorage.removeItem(`${LS_CLOUD_NOTEBASE}_${s.uid}`);}catch(e){/* ignore */}}
    if(keep.size)console.info(`[cloud] kept the local copy of: ${[...keep].join(", ")} (not yet saved to the cloud)`);
  })();
}

/* ═══════════════════════════════════════════════════
   RESET ALL DATA (Settings → Danger zone): the CLOUD copy goes too, otherwise the next login would bring it back
═══════════════════════════════════════════════════ */
async function cloudResetAll(){
  const s=cloudSession;
  if(!s)return;
  Object.values(s.timers).forEach(clearTimeout);
  s.paused.clear();
  const defaults={apps:DEFAULT_APPS.map(sanitizeApp).filter(Boolean),favs:[],recent:[]};
  try{
    await cloudApi(s.token,"/apps",{method:"PUT",body:defaults});
    await cloudApi(s.token,"/notes",{method:"PUT",body:{notes:[]}});
    await cloudApi(s.token,"/settings",{method:"PUT",body:{settings:{}}});
    await cloudApi(s.token,"/profile",{method:"PUT",body:{displayName:s.username,avatar:"",bio:""}});
  }catch(err){
    if(err.status===401){cloudSessionExpired(s);}
    throw err.network?err:cloudErr(err.status||0,`Couldn't reset your cloud data: ${err.message}`);
  }
  s.dirty.clear();cloudPersistDirty(s);
  s.noteBase=new Map();
  try{localStorage.removeItem(`${LS_CLOUD_NOTEBASE}_${s.uid}`);}catch(e){/* ignore */}
}

/* ═══════════════════════════════════════════════════
   COMING BACK TO A TAB: pick up changes made on another device
   (saving replaces whole lists, so a stale tab could overwrite newer data — this keeps tabs fresh)
═══════════════════════════════════════════════════ */
function cloudNormalize(v){
  if(Array.isArray(v))return v.map(cloudNormalize);
  if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,cloudNormalize(v[k])]));
  return v;
}
const cloudSame=(a,b)=>JSON.stringify(cloudNormalize(a))===JSON.stringify(cloudNormalize(b));
function cloudUiBusy(){return !!document.querySelector(".modal-backdrop.open, .side-panel.open");}

async function cloudRefresh(s,{force=false}={}){
  if(cloudSession!==s||s.dead)return;
  if(!force&&(s.dirty.size||Object.values(s.inflight).some(Boolean)||cloudUiBusy()))return;
  let boot;
  try{boot=await cloudApi(s.token,"/bootstrap");}
  catch(err){if(err.status===401)cloudSessionExpired(s);else if(err.status===403)showBlockedScreen();return;}
  if(cloudSession!==s||(!force&&(s.dirty.size||cloudUiBusy())))return;
  const init=boot.initialized||{};
  const changed=[];
  for(const d of CLOUD_DOMAINS){
    if(!init[d]||s.paused.has(d)||s.dirty.has(d))continue;
    let cloudSide,cacheSide;
    if(d==="profile"){const p=boot.profile||{};cloudSide={displayName:p.displayName||s.username,avatar:p.avatar||"",bio:p.bio||""};const c=cloudReadProfile(s.uid);cacheSide={...c,displayName:c.displayName||s.username};}
    else if(d==="settings"){cloudSide=boot.settings||{};cacheSide=cloudReadSettings(s.uid);}
    else if(d==="apps"){cloudSide={apps:(boot.apps||[]).map(sanitizeApp).filter(Boolean),favs:boot.favs||[],recent:boot.recent||[]};cacheSide=cloudReadApps(s.uid);}
    else{cloudSide=(boot.notes||[]).map(cloudNoteFromServer).filter(Boolean).map(n=>[n.id,n.title,n.body]);cacheSide=cloudReadNotes(s.uid).map(n=>[n.id,n.title,n.body]);}
    if(!cloudSame(cloudSide,cacheSide))changed.push(d);
  }
  if(!changed.length)return;
  changed.forEach(d=>cloudApplyDomain(s,d,boot));
  cloudQuiet(()=>{loadUserState();cloudRehydrateUi();});
  console.info("[cloud] refreshed from the cloud:",changed.join(", "));
}
function cloudRehydrateUi(){
  const safe=(n,f)=>{try{f();}catch(e){console.warn(`[cloud] refresh step "${n}" failed`,e);}};
  safe("theme",()=>{applyTheme(g(LS.THEME)||"default");applyOverlay(g(LS.OVERLAY)||"72");});
  safe("ai",()=>loadAiConfig());
  safe("wallpaper",()=>{restoreWallpaper().catch(()=>{});});
  safe("toggles",()=>{[["toggleSeconds",showSeconds],["toggleRecent",showRecent],["toggleWeather",showWeather],["toggleParticles",showParticles]].forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.checked=!!v;});});
  safe("render",()=>{renderAll();renderNotes();updateSortBtn();updateViewBtns();const rb=document.querySelector(".recent-bar");if(rb)rb.style.display=showRecent?"block":"none";});
  safe("weather",()=>{if(typeof applyWeatherVisibility==="function")applyWeatherVisibility();});
  safe("settings panel",()=>{if(typeof syncSettingsExtras==="function")syncSettingsExtras();});
}
document.addEventListener("visibilitychange",()=>{
  const s=cloudSession;if(!s)return;
  if(document.hidden){s.hiddenAt=Date.now();return;}
  if(s.hiddenAt&&Date.now()-s.hiddenAt>=CLOUD_REFRESH_AFTER_MS)cloudRefresh(s).catch(()=>{});
  s.hiddenAt=0;
});

/* ═══════════════════════════════════════════════════
   ONE-TIME IMPORT OF THIS BROWSER'S EXISTING DATA
   (modal markup: #cloudImportModal in index.html)
═══════════════════════════════════════════════════ */
const CLOUD_IMPORT_LABEL={
  profile:()=>"Your profile (avatar, display name, bio)",
  settings:()=>"Your settings (theme, wallpaper, AI configuration)",
  apps:n=>`${n} app${n===1?"":"s"}, plus favourites and recent apps`,
  notes:n=>`${n} note${n===1?"":"s"}`
};
function cloudOpenImportModal(){
  const s=cloudSession,m=document.getElementById("cloudImportModal");
  if(!s||!m||!s.plan||!s.plan.import.length)return;
  const list=document.getElementById("cloudImportList");
  list.replaceChildren();
  s.plan.import.forEach(d=>{const li=document.createElement("li");li.textContent=CLOUD_IMPORT_LABEL[d](s.plan.counts[d]||0);list.appendChild(li);});
  cloudImportMsg("");
  document.getElementById("cloudImportNow").disabled=false;document.getElementById("cloudImportLater").disabled=false;
  m.classList.add("open");
}
function cloudCloseImportModal(){const m=document.getElementById("cloudImportModal");if(m)m.classList.remove("open");}
function cloudImportMsg(text){const el=document.getElementById("cloudImportErr");if(!el)return;el.textContent=text||"";el.style.display=text?"block":"none";}

async function cloudImportDomain(s,d){
  const uid=s.uid;
  if(d==="notes"){
    const list=cloudReadNotes(uid);
    const body={notes:list.map(n=>({id:n.id,title:n.title,body:n.body,date:n.date||""}))};
    if(JSON.stringify(body).length>CLOUD_BULK_NOTES_MAX_BYTES)throw cloudErr(413,"Your notes are too large to import in one go.");
    await cloudApi(s.token,"/notes",{method:"PUT",body});
    s.noteBase=new Map(list.map(n=>[n.id,cloudNoteSig(n)]));cloudPersistNoteBase(s);
    return;
  }
  await cloudPushDomain(s,d);
}
async function cloudImportNow(){
  const s=cloudSession;
  if(!s||!s.plan)return;
  const now=document.getElementById("cloudImportNow"),later=document.getElementById("cloudImportLater");
  now.disabled=true;later.disabled=true;cloudImportMsg("");
  const label=now.querySelector("span");const orig=label?label.textContent:"";if(label)label.textContent="Importing…";
  try{
    for(const d of [...s.plan.import]){
      await cloudImportDomain(s,d);
      s.plan.import=s.plan.import.filter(x=>x!==d);
      s.dirty.delete(d);s.paused.delete(d);cloudPersistDirty(s);
    }
    cloudCloseImportModal();
    toast("Your data is now saved to your cloud account","ti-cloud-check");
  }catch(err){
    if(cloudSession!==s)return;
    if(err.status===401){cloudSessionExpired(s);return;}
    if(err.status===403){showBlockedScreen();return;}
    cloudImportMsg(err.network?err.message:`Import failed: ${err.message}`);
    now.disabled=false;later.disabled=false;
  }finally{
    if(label)label.textContent=orig;
  }
}
function cloudImportLater(){
  const s=cloudSession;
  if(s&&s.plan){s.plan.import.forEach(d=>s.paused.add(d));}
  cloudCloseImportModal();
  toast("Your existing data stays in this browser until you import it","ti-device-desktop");
}
(function wireCloudImportButtons(){
  const bind=()=>{
    const a=document.getElementById("cloudImportNow"),b=document.getElementById("cloudImportLater");
    if(a)a.addEventListener("click",cloudImportNow);
    if(b)b.addEventListener("click",cloudImportLater);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();
