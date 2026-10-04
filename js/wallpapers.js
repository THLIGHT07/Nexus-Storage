/* ============================================================
   WALLPAPERS.JS — Overlay darkness, static photo wallpaper,
   live animated wallpapers (particles/matrix/aurora/stars/waves),
   and settings-panel live-wallpaper previews
   ============================================================ */
(window.__nexusParts=window.__nexusParts||{})["wallpapers.js"]="2026-10-02-xss1";


/* ═══════════════════════════════════════════════════
   WALLPAPER SYSTEM (advanced)
═══════════════════════════════════════════════════ */
function applyOverlay(val){
  document.documentElement.style.setProperty("--wall-overlay",`rgba(10,10,15,${val/100})`);
  p(LS.OVERLAY,val);
}

/* ═══════════════════════════════════════════════════
   WALLPAPER STORAGE — what goes where
   • localStorage (md_wall_v4_<id>, md_customwall_v4_<id>) holds ONLY a short
     string: either a plain image URL ("https://…") or a reference to an
     uploaded image ("idb:custom_<id>"). NEVER the image data itself — a
     base64 photo is megabytes and blows the ~5 MB localStorage quota.
   • An uploaded file has no URL of its own, so its bytes live in IndexedDB
     (database "nexus_wallpapers"), keyed per user. IndexedDB has a far
     larger quota and stores binary Blobs natively (no base64 inflation).
═══════════════════════════════════════════════════ */
const WALL_DB_NAME="nexus_wallpapers",WALL_STORE="images",WALL_REF="idb:";
const wallKey=(userId,slot="custom")=>`${slot}_${userId}`;

function wallDb(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(new Error("IndexedDB is not available in this browser"));return;}
    const req=indexedDB.open(WALL_DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(WALL_STORE))req.result.createObjectStore(WALL_STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("Could not open image storage"));
  });
}
async function wallTx(mode,fn){
  const db=await wallDb();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(WALL_STORE,mode);
      const out=fn(tx.objectStore(WALL_STORE));
      tx.oncomplete=()=>resolve(out&&"result" in out?out.result:undefined);
      tx.onerror=()=>reject(tx.error||new Error("Image storage transaction failed"));
      tx.onabort=()=>reject(tx.error||new Error("Image storage transaction aborted"));
    });
  }finally{db.close();}
}
const wallPut=(key,blob)=>wallTx("readwrite",s=>s.put(blob,key));
const wallGet=(key)=>wallTx("readonly",s=>s.get(key));
const wallDel=(key)=>wallTx("readwrite",s=>s.delete(key));

/** Removes a user's stored wallpaper images (used by "Reset all data"). */
async function deleteUserWallpaperBlobs(userId){
  try{await wallDel(wallKey(userId,"custom"));await wallDel(wallKey(userId,"wall"));}
  catch(err){console.warn("[wallpaper] couldn't delete stored images",err);}
}

const isDataImage=v=>typeof v==="string"&&v.startsWith("data:image");
const isHttpUrl=v=>typeof v==="string"&&/^https?:\/\//i.test(v);

/** Turns a stored reference into something a CSS url()/<img> can load.
 * Uploaded images become a blob: URL (caller is responsible for revoking it). */
async function resolveWallpaperUrl(ref){
  if(!ref||ref==="none")return null;
  if(typeof ref==="string"&&ref.startsWith(WALL_REF)){
    const blob=await wallGet(ref.slice(WALL_REF.length));
    return blob?URL.createObjectURL(blob):null;
  }
  return ref; // plain URL (or a not-yet-migrated legacy data: URL — displayed as-is, left untouched)
}
/** CSS-safe url(...) value (escapes characters that could break out of it). */
function cssUrl(u){return `url("${String(u).replace(/["'()\\\s]/g,c=>"%"+c.charCodeAt(0).toString(16).padStart(2,"0"))}")`;}

/** One-time, loss-free move of an OLD base64 wallpaper out of localStorage
 * into IndexedDB. The localStorage value is only replaced AFTER the image has
 * been written and read back; if anything fails the old value is left alone. */
async function migrateLegacyWallpapers(){
  const userId=CURRENT_UID;
  if(userId==null)return;
  const custom=g(LS.CUSTOM_WALL),wall=g(LS.WALL);
  if(!isDataImage(custom)&&!isDataImage(wall))return;
  try{
    const refs=new Map(); // data URL → ref, so identical values are stored once
    for(const [lsKey,value,slot] of [[LS.CUSTOM_WALL,custom,"custom"],[LS.WALL,wall,"wall"]]){
      if(!isDataImage(value))continue;
      if(!refs.has(value)){
        const blob=await (await fetch(value)).blob();
        const key=wallKey(userId,slot);
        await wallPut(key,blob);
        const back=await wallGet(key);
        if(!back||back.size!==blob.size)throw new Error("verification failed");
        refs.set(value,WALL_REF+key);
      }
      if(userId!==CURRENT_UID)return; // user switched mid-way — stop, nothing half-written
      p(lsKey,refs.get(value));
    }
    console.info("[wallpaper] moved base64 wallpaper from localStorage to IndexedDB");
  }catch(err){
    console.warn("[wallpaper] migration skipped — old value left untouched",err);
  }
}

let _wallPaintToken=0,_wallObjUrl=null,_previewObjUrl=null;
function revokeUrl(u){if(u&&u.startsWith("blob:"))try{URL.revokeObjectURL(u);}catch(e){}}
function releasePreviewUrl(){revokeUrl(_previewObjUrl);_previewObjUrl=null;const img=document.getElementById("customWallImg");if(img)img.removeAttribute("src");}

function clearWallpaperLayers(){
  _wallPaintToken++;
  stopLiveWall();
  document.getElementById("wallpaperBg").style.backgroundImage="none";
  document.getElementById("heroWallLayer").style.backgroundImage="none";
  revokeUrl(_wallObjUrl);_wallObjUrl=null;
  syncWallpaperUi();
}

/** Makes the Settings → Wallpaper highlights (selected photo / live thumbnail)
 * match the CURRENT user's saved choice — or nothing selected when nobody is
 * logged in. Without this the previous account's highlighted thumbnail stays
 * lit for the next account, which looks exactly like "same wallpaper". */
function syncWallpaperUi(){
  const live=g(LS.LIVE_WALL)||"none";
  const wall=live!=="none"?"none":(g(LS.WALL)||"none");
  const nobody=CURRENT_UID==null;
  document.querySelectorAll(".wall-thumb").forEach(t=>t.classList.toggle("active",!nobody&&t.dataset.wall===wall));
  document.querySelectorAll(".live-wall-thumb").forEach(t=>t.classList.toggle("active",!nobody&&live!=="none"&&t.dataset.live===live));
}

/** Draws a resolved wallpaper into the layer for the current scope. */
async function paintWallpaper(ref){
  const token=++_wallPaintToken,userId=CURRENT_UID;
  const url=await resolveWallpaperUrl(ref);
  if(token!==_wallPaintToken||userId!==CURRENT_UID){revokeUrl(url);return;} // superseded (new choice, live wall, or user switched)
  const bg=document.getElementById("wallpaperBg"),hero=document.getElementById("heroWallLayer");
  const value=url?cssUrl(url):"none";
  if(wallScope==="hero"){hero.style.backgroundImage=value;bg.style.backgroundImage="none";}
  else{bg.style.backgroundImage=value;hero.style.backgroundImage="none";} // "full" and "particle"
  revokeUrl(_wallObjUrl);_wallObjUrl=url;
}

/** Apply + remember a wallpaper. `ref` is a URL, an "idb:…" reference, or "none". */
function applyWallpaper(ref){
  stopLiveWall(); // stop live if switching to photo
  const value=ref||"none";
  p(LS.WALL,value); // only ever a short URL/reference — never image data
  document.querySelectorAll(".wall-thumb").forEach(t=>t.classList.toggle("active",t.dataset.wall===value));
  return paintWallpaper(value).catch(err=>console.warn("[wallpaper] paint failed",err));
}

/** Called at login: clear whatever the previous user left, then show THIS user's wallpaper. */
async function restoreWallpaper(){
  const userId=CURRENT_UID;
  clearWallpaperLayers();
  await migrateLegacyWallpapers();
  if(userId!==CURRENT_UID)return;
  const live=g(LS.LIVE_WALL)||"none",wall=g(LS.WALL)||"none";
  if(live!=="none")startLiveWall(live);
  else if(wall!=="none")await paintWallpaper(wall);
  syncWallpaperUi();
  await refreshCustomWallPreview();
}

/** Settings → Upload tab thumbnail for the saved custom wallpaper. */
async function refreshCustomWallPreview(){
  const prev=document.getElementById("customWallPreview"),img=document.getElementById("customWallImg");
  if(!prev||!img)return;
  const userId=CURRENT_UID,ref=g(LS.CUSTOM_WALL);
  releasePreviewUrl();
  if(!ref||ref==="none"){prev.style.display="none";return;}
  try{
    const url=await resolveWallpaperUrl(ref);
    if(userId!==CURRENT_UID){revokeUrl(url);return;}
    if(!url){prev.style.display="none";return;}
    _previewObjUrl=url;img.src=url;prev.style.display="block";
  }catch(err){console.warn("[wallpaper] preview failed",err);prev.style.display="none";}
}

/** Save an uploaded image file as THIS user's custom wallpaper. */
async function setCustomWallpaperFromFile(file){
  const userId=CURRENT_UID;
  if(userId==null)return;
  const key=wallKey(userId,"custom");
  await wallPut(key,file); // bytes → IndexedDB
  if(userId!==CURRENT_UID)return;
  const ref=WALL_REF+key;
  p(LS.CUSTOM_WALL,ref); // tiny reference → localStorage
  await applyWallpaper(ref);
  await refreshCustomWallPreview();
}
/** Use an image URL as THIS user's custom wallpaper (only the URL string is stored). */
async function setCustomWallpaperFromUrl(url){
  const userId=CURRENT_UID;
  if(userId==null)return;
  const previous=g(LS.CUSTOM_WALL);
  p(LS.CUSTOM_WALL,url);
  await applyWallpaper(url);
  if(typeof previous==="string"&&previous.startsWith(WALL_REF))wallDel(previous.slice(WALL_REF.length)).catch(()=>{}); // free the old upload
  await refreshCustomWallPreview();
}
/** Remove THIS user's custom wallpaper (and its stored image, if any). */
async function clearCustomWallpaper(){
  const userId=CURRENT_UID;
  if(userId==null)return;
  const ref=g(LS.CUSTOM_WALL);
  if(g(LS.WALL)===ref)await applyWallpaper("none");
  p(LS.CUSTOM_WALL,"");
  if(typeof ref==="string"&&ref.startsWith(WALL_REF))await wallDel(ref.slice(WALL_REF.length)).catch(()=>{});
  await refreshCustomWallPreview();
}

/* ── LIVE WALLPAPERS ── */
const LIVE_RENDERERS={
  particles:(ctx,W,H,t)=>{
    ctx.clearRect(0,0,W,H);
    const count=Math.floor(W*H/6000);
    for(let i=0;i<count;i++){
      const x=(Math.sin(i*2.4+t*.0008)*W/2+W/2+Math.cos(i*1.7)*80)%W;
      const y=(Math.cos(i*1.9+t*.0006)*H/2+H/2+Math.sin(i*2.1)*60)%H;
      const r=(Math.sin(i+t*.001)+1.5)*1.5;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle=`hsla(${(i*13+t*.02)%360},70%,70%,0.55)`;ctx.fill();
    }
    // connect nearby
    // (skip for perf on full-page)
  },
  matrix:(ctx,W,H,t)=>{
    ctx.fillStyle="rgba(0,0,0,0.05)";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#0f0";ctx.font=`${Math.max(10,Math.floor(W/80))}px 'JetBrains Mono',monospace`;
    const cols=Math.floor(W/14);
    if(!ctx._drops){ctx._drops=Array.from({length:cols},()=>Math.random()*H);}
    ctx._drops.forEach((y,i)=>{
      const ch=String.fromCharCode(0x30A0+Math.random()*96);
      const x=i*14;
      ctx.fillStyle=`rgba(0,${180+Math.floor(Math.random()*75)},0,0.85)`;
      ctx.fillText(ch,x,y);
      ctx._drops[i]=y>H+Math.random()*1000?0:y+14;
    });
  },
  aurora:(ctx,W,H,t)=>{
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);
    for(let band=0;band<4;band++){
      const grad=ctx.createLinearGradient(0,0,W,H);
      const hue=(band*60+t*.015)%360;
      grad.addColorStop(0,"transparent");
      grad.addColorStop(.3+Math.sin(t*.001+band)*.2,`hsla(${hue},80%,55%,0.18)`);
      grad.addColorStop(.7+Math.cos(t*.0013+band)*.2,`hsla(${(hue+40)%360},70%,60%,0.12)`);
      grad.addColorStop(1,"transparent");
      ctx.fillStyle=grad;
      ctx.save();ctx.translate(W/2,H/2);
      ctx.rotate(Math.sin(t*.0004+band)*0.3);
      ctx.translate(-W/2,-H/2);
      ctx.fillRect(0,0,W,H);ctx.restore();
    }
  },
  stars:(ctx,W,H,t)=>{
    ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fillRect(0,0,W,H);
    if(!ctx._stars){ctx._stars=Array.from({length:Math.floor(W*H/800)},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5+.2,s:Math.random()*2+.5,p:Math.random()*Math.PI*2}));}
    ctx._stars.forEach(s=>{
      const bright=(Math.sin(t*.002*s.s+s.p)+1)/2;
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,255,255,${0.3+bright*0.7})`;ctx.fill();
      if(bright>0.9){ctx.beginPath();ctx.arc(s.x,s.y,s.r*3,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,0.04)`;ctx.fill();}
    });
  },
  waves:(ctx,W,H,t)=>{
    ctx.clearRect(0,0,W,H);
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,"#0a0a1a");grad.addColorStop(1,"#060614");
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    for(let i=0;i<5;i++){
      ctx.beginPath();
      const yBase=H*(0.35+i*0.12);
      ctx.moveTo(0,yBase);
      for(let x=0;x<=W;x+=4){
        const y=yBase+Math.sin(x*.006+t*.001+i*.8)*30+Math.sin(x*.012-t*.0007+i)*15;
        ctx.lineTo(x,y);
      }
      ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
      const alpha=0.12-i*0.018;
      ctx.fillStyle=`hsla(${220+i*15},80%,60%,${alpha})`;ctx.fill();
    }
  }
};

/* Live wallpaper runtime. Everything it creates (animation frame, resize listener, hero canvas)
   is owned here and removed in stopLiveWall(), so starting/stopping/switching never leaks. */
let _liveWallRaf=null,_liveWallT=0,_liveWallAbort=null,_liveWallHeroCanvas=null;
function startLiveWall(type){
  stopLiveWall();_wallPaintToken++; // cancel the previous loop + listener + hero canvas, and any in-flight photo paint
  if(!type||type==="none"){p(LS.LIVE_WALL,"none");liveWall="none";return;}
  const renderer=LIVE_RENDERERS[type];if(!renderer)return;
  liveWall=type;p(LS.LIVE_WALL,type);
  document.getElementById("wallpaperBg").style.backgroundImage="none";
  const heroEl=document.getElementById("heroWallLayer");
  heroEl.style.backgroundImage="none";
  let canvas,size;
  if(wallScope==="hero"){
    // Draw straight into a <canvas> inside the hero layer. (It used to render offscreen and call
    // canvas.toDataURL() + set a CSS background EVERY frame — encoding a PNG 60×/second.)
    const hero=document.getElementById("hero");
    canvas=document.createElement("canvas");
    canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;";
    heroEl.replaceChildren(canvas);_liveWallHeroCanvas=canvas;
    size=()=>{canvas.width=hero.offsetWidth||900;canvas.height=hero.offsetHeight||260;};
  }else{ // "full" and "particle"
    canvas=document.getElementById("wallpaperLiveCanvas");
    canvas.style.display="block";canvas.style.zIndex="-2";
    size=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
  }
  const ctx=canvas.getContext("2d");
  const reset=()=>{size();ctx._drops=undefined;ctx._stars=undefined;}; // matrix/stars cache per-size state on ctx → rebuild after any resize
  reset();
  _liveWallAbort=new AbortController();
  window.addEventListener("resize",reset,{signal:_liveWallAbort.signal}); // removed by stopLiveWall (used to stack one more listener per start)
  function frame(ts){_liveWallT=ts;renderer(ctx,canvas.width,canvas.height,ts);_liveWallRaf=requestAnimationFrame(frame);}
  _liveWallRaf=requestAnimationFrame(frame);
  document.querySelectorAll(".live-wall-thumb").forEach(t=>t.classList.toggle("active",t.dataset.live===type));
}

function stopLiveWall(){
  if(_liveWallRaf){cancelAnimationFrame(_liveWallRaf);_liveWallRaf=null;}
  if(_liveWallAbort){_liveWallAbort.abort();_liveWallAbort=null;}
  if(_liveWallHeroCanvas){_liveWallHeroCanvas.remove();_liveWallHeroCanvas=null;}
  const canvas=document.getElementById("wallpaperLiveCanvas");
  if(canvas){canvas.style.display="none";const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);}
}

/* Tiny previews in settings panel.
   They only run while the Settings panel is OPEN: initLivePreviews() on open, stopLivePreviews() on close
   (before, 5 animation loops started on first open and ran forever, even with the panel closed). */
const _livePreviews=new Map(); // type → {raf, stopped}
function stopLivePreviews(){
  _livePreviews.forEach(st=>{st.stopped=true;cancelAnimationFrame(st.raf);});
  _livePreviews.clear();
}
function initLivePreviews(){
  stopLivePreviews(); // idempotent: never two loops per thumbnail
  const panel=document.getElementById("settingsPanel");
  if(panel&&!panel.classList.contains("open"))return; // panel was closed again before we got here
  ["particles","matrix","aurora","stars","waves"].forEach(type=>{
    const c=document.getElementById("prev-"+type);if(!c)return;
    const thumb=c.closest(".live-wall-thumb");
    c.width=(thumb&&thumb.offsetWidth)||160;c.height=(thumb&&thumb.offsetHeight)||62;
    const ctx=c.getContext("2d"),renderer=LIVE_RENDERERS[type];
    const st={raf:0,stopped:false,last:0};_livePreviews.set(type,st);
    const frame=ts=>{
      if(st.stopped)return;
      if(ts-st.last>=50){st.last=ts;renderer(ctx,c.width,c.height,ts);} // ~20fps is plenty for a 160px thumbnail
      st.raf=requestAnimationFrame(frame);
    };
    st.raf=requestAnimationFrame(frame);
  });
}
