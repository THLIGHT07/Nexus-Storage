/* ============================================================
   SETTINGS.JS — Clock format, theme, AI/website setting
   updaters, and the full Settings panel wiring (wallpaper
   scope/tabs, toggles, account, reset)
   ============================================================ */
(window.__nexusParts=window.__nexusParts||{})["settings.js"]="2026-10-02-xss1";


/* ═══════════════════════════════════════════════════
   CLOCK (12h / 24h / seconds)
═══════════════════════════════════════════════════ */
function setClockFormat(fmt){
  clockFormat=fmt;p(LS.CLOCK_FMT,fmt);
  document.getElementById("clock12Btn").classList.toggle("active",fmt===12);
  document.getElementById("clock24Btn").classList.toggle("active",fmt===24);
}
/* The interval id is stored so a second initClock() (next login) can never leave
   two timers running; stopClock() is called from resetUserSession on sign-out. */
let _clockTimer=null;
function stopClock(){clearInterval(_clockTimer);_clockTimer=null;}
function initClock(){
  stopClock(); // clear any previous interval BEFORE starting a new one
  const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function tick(){
    const now=new Date();
    let hr=now.getHours(),ampm="";
    if(clockFormat===12){ampm=hr>=12?" PM":" AM";hr=hr%12||12;}
    const hs=String(hr).padStart(2,"0");
    const ms=String(now.getMinutes()).padStart(2,"0");
    const ss=String(now.getSeconds()).padStart(2,"0");
    const secPart=showSeconds?h("span",{style:"font-size:.6em;color:var(--text3)"},":"+ss):null;
    const ampmPart=ampm?h("span",{style:"font-size:.45em;color:var(--accent2);letter-spacing:.05em;vertical-align:middle;margin-left:4px;"},ampm.trim()):null;
    document.getElementById("clockTime").replaceChildren(...[hs,h("span",null,":"),ms,secPart,ampmPart].filter(Boolean));
    document.getElementById("clockDate").textContent=`${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;
  }
  tick();_clockTimer=setInterval(tick,1000);
}

/* ═══════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════ */
function applyTheme(t){
  const known=[...document.querySelectorAll(".theme-swatch")].map(sw=>sw.dataset.theme);
  if(!t||!known.includes(t))t="default"; // anything that isn't a real theme (e.g. from an AI tool call) falls back safely
  document.body.className=document.body.className.replace(/theme-\S+/g,"").trim();
  if(t!=="default")document.body.classList.add("theme-"+t);
  document.querySelectorAll(".theme-swatch").forEach(s=>s.classList.toggle("active",s.dataset.theme===t));
  p(LS.THEME,t);
}

/* ── AI tool-callable settings updaters ── */
function updateWebsiteSetting(setting,value){
  const bool=v=>v===true||v==="true";            // AI tool values arrive as booleans or "true"/"false"
  const setChk=(id,v)=>{const el=document.getElementById(id);if(el)el.checked=v;}; // keep the Settings panel in sync
  switch(setting){
    case "theme":
      applyTheme(value);return{ok:true,message:`Theme changed to ${value}`};
    case "clockFormat":{
      const fmt=parseInt(value,10); // accepts 12, "12", "12h"
      if(fmt!==12&&fmt!==24)return{ok:false,error:`Clock format must be 12 or 24, got "${value}"`};
      setClockFormat(fmt); // updates the variable, storage AND the 12h/24h buttons
      return{ok:true,message:`Clock format set to ${fmt}h`};
    }
    case "clockSeconds":
      showSeconds=bool(value);p(LS.CLOCK_SEC,showSeconds);setChk("toggleSeconds",showSeconds);
      return{ok:true,message:`Clock seconds ${showSeconds?"enabled":"disabled"}`};
    case "showRecent":
      showRecent=bool(value);p(LS.SHOW_RECENT,showRecent);setChk("toggleRecent",showRecent);
      {const bar=document.querySelector(".recent-bar");if(bar)bar.style.display=showRecent?"block":"none";}
      return{ok:true,message:`Recent apps section ${showRecent?"shown":"hidden"}`};
    case "showWeather":
      showWeather=bool(value);p(LS.SHOW_WEATHER,showWeather);setChk("toggleWeather",showWeather);
      applyWeatherVisibility(); // show/hide the strip AND fetch the weather if it has never been loaded
      return{ok:true,message:`Weather widget ${showWeather?"shown":"hidden"}`};
    case "showParticles":
      showParticles=bool(value);p(LS.SHOW_PARTICLES,showParticles);setChk("toggleParticles",showParticles);
      return{ok:true,message:`Particle background ${showParticles?"enabled":"disabled"}`};
    case "overlay":{
      const n=Number(value);
      if(!Number.isFinite(n))return{ok:false,error:`Overlay must be a number 0-100, got "${value}"`};
      const v=Math.round(Math.min(100,Math.max(0,n)));
      applyOverlay(v);
      const sl=document.getElementById("overlaySlider");if(sl)sl.value=v;
      return{ok:true,message:`Wallpaper overlay set to ${v}%`};
    }
    default:
      return{ok:false,error:`Unknown website setting: ${setting}`};
  }
}
function updateAiSetting(setting,value){
  const fieldMap={
    persona:"aiPersonaName", name:"aiPersonaName", tone:"aiTone",
    userName:"aiUserName", customInstructions:"aiCustomInstructions"
  };
  const checkboxMap={
    autoSearch:"aiAutoSearch", webSearch:"aiWebSearch",
    emotionDetect:"aiEmotionDetect", allowApps:"aiAllowApps", autoOpen:"aiAutoOpen"
  };
  if(setting==="tone"&&!["friendly","professional","casual","witty","concise"].includes(value))
    return{ok:false,error:`Unknown tone "${value}". Use: friendly, professional, casual, witty, concise.`};
  if(fieldMap[setting]){
    const el=document.getElementById(fieldMap[setting]);
    if(el)el.value=value;
    if(setting==="persona"||setting==="name")updateAiNames(value);
  }else if(checkboxMap[setting]){
    const el=document.getElementById(checkboxMap[setting]);
    if(el)el.checked=!!value;
  }else{
    return{ok:false,error:`Unknown AI setting: ${setting}`};
  }
  saveAiConfig();
  return{ok:true,message:`AI setting "${setting}" updated to "${value}"`};
}

/* ═══════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════ */
/* initSettings runs on EVERY login. Listener wiring happens once (otherwise each
   login stacked another copy of every handler: duplicate toasts, repeated
   wallpaper re-applies, extra animation loops). Everything that shows THIS
   user's saved values is re-synced every time in syncSettingsUi(). */
let _settingsWired=false;
function initSettings(){
  if(!_settingsWired){_settingsWired=true;wireSettingsOnce();}
  syncSettingsUi();
}

function wireSettingsOnce(){
  // theme swatches
  document.querySelectorAll(".theme-swatch").forEach(s=>s.addEventListener("click",()=>applyTheme(s.dataset.theme)));

  // wall scope buttons
  document.querySelectorAll(".wall-scope-btn[data-scope]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      wallScope=btn.dataset.scope;p(LS.WALL_SCOPE,wallScope);
      document.querySelectorAll(".wall-scope-btn[data-scope]").forEach(b=>b.classList.toggle("active",b.dataset.scope===wallScope));
      // re-apply current wall to new scope
      const curWall=g(LS.WALL)||"none";
      const curLive=g(LS.LIVE_WALL)||"none";
      if(curLive&&curLive!=="none")startLiveWall(curLive);
      else applyWallpaper(curWall);
      toast(`Wallpaper scope: ${wallScope}`,"ti-photo");
    });
  });

  // wall tabs
  document.querySelectorAll(".wall-tab").forEach(tab=>{
    tab.addEventListener("click",()=>{
      document.querySelectorAll(".wall-tab").forEach(t=>t.classList.remove("active"));
      document.querySelectorAll(".wall-tab-content").forEach(tc=>tc.classList.remove("active"));
      tab.classList.add("active");
      const content=document.getElementById("wtab-"+tab.dataset.wtab);
      if(content)content.classList.add("active");
    });
  });

  // photo wall thumbs
  document.querySelectorAll(".wall-thumb").forEach(t=>t.addEventListener("click",()=>{
    stopLiveWall();liveWall="none";p(LS.LIVE_WALL,"none");
    document.querySelectorAll(".live-wall-thumb").forEach(l=>l.classList.remove("active"));
    applyWallpaper(t.dataset.wall);
    toast("Wallpaper applied","ti-photo");
  }));

  // live wall thumbs
  document.querySelectorAll(".live-wall-thumb").forEach(t=>t.addEventListener("click",()=>{
    const type=t.dataset.live;
    document.querySelectorAll(".wall-thumb").forEach(w=>w.classList.remove("active"));
    document.getElementById("wallGrid").querySelector("[data-wall='none']")?.classList.add("active");
    if(type==="none"){stopLiveWall();liveWall="none";p(LS.LIVE_WALL,"none");toast("Live wallpaper off","ti-photo");return;}
    startLiveWall(type);toast(`Live: ${type}`,"ti-player-play");
  }));

  // upload — only a short reference is ever kept in localStorage; the image bytes go to IndexedDB.
  // (Assigned as .onchange/.onclick so re-running initSettings on the next login REPLACES these
  //  handlers instead of stacking duplicates.)
  const MAX_WALL_BYTES=10*1024*1024;
  document.getElementById("wallUpload").onchange=async e=>{
    const input=e.target,file=input.files&&input.files[0];
    if(!file)return;
    if(!/^image\//.test(file.type)){toast("That file isn't an image","ti-alert-circle");input.value="";return;}
    if(file.size>MAX_WALL_BYTES){toast("Image too large (max 10MB)","ti-alert-circle");input.value="";return;}
    try{
      await setCustomWallpaperFromFile(file);
      toast("Custom wallpaper set 🖼️","ti-photo");
    }catch(err){
      console.error("[wallpaper] upload failed",err);
      toast("Couldn't save the image here — try pasting an image URL instead","ti-alert-circle");
    }
    input.value="";
  };
  document.getElementById("wallUrlBtn").onclick=async()=>{
    const box=document.getElementById("wallUrlInput"),url=box.value.trim();
    if(!isHttpUrl(url)){toast("Enter a full image URL starting with http:// or https://","ti-alert-circle");return;}
    const ok=await new Promise(res=>{const im=new Image();im.onload=()=>res(true);im.onerror=()=>res(false);im.src=url;});
    if(!ok){toast("That URL didn't load as an image","ti-alert-circle");return;}
    await setCustomWallpaperFromUrl(url);
    box.value="";
    toast("Wallpaper set from URL 🖼️","ti-photo");
  };
  document.getElementById("clearCustomWall").onclick=async()=>{
    await clearCustomWallpaper();
    document.getElementById("wallUpload").value="";
    toast("Wallpaper removed","ti-photo");
  };
  // overlay slider
  document.getElementById("overlaySlider").addEventListener("input",e=>applyOverlay(e.target.value));

  // clock seconds + display toggles
  document.getElementById("toggleSeconds").addEventListener("change",e=>{showSeconds=e.target.checked;p(LS.CLOCK_SEC,showSeconds);});
  document.getElementById("toggleRecent").addEventListener("change",e=>{showRecent=e.target.checked;p(LS.SHOW_RECENT,showRecent);document.querySelector(".recent-bar").style.display=showRecent?"block":"none";});
  document.getElementById("toggleWeather").addEventListener("change",e=>{showWeather=e.target.checked;p(LS.SHOW_WEATHER,showWeather);applyWeatherVisibility();});
  document.getElementById("toggleParticles").addEventListener("change",e=>{showParticles=e.target.checked;p(LS.SHOW_PARTICLES,showParticles);});

  // account — display name only. (There is deliberately no password field here: the
  // login password lives on the server and this screen never could change it.)
  document.getElementById("saveAccountBtn").addEventListener("click",()=>{
    const user=document.getElementById("setUsername").value.trim();
    if(user)p(LS.USER,user);
    if(typeof applyAvatar==="function")applyAvatar();
    toast("Saved ✓","ti-check");
  });

  // reset all data: wired in buildSettingsLayout() (inline "type RESET" confirmation)

  // init live previews after panel first opens
  // (this whole function runs once, so this listener is added once; previews stop again in closePanel)
  document.getElementById("settingsBtn").addEventListener("click",()=>{
    setTimeout(initLivePreviews,100);
  });
}

/** Shows THIS user's saved values in every Settings control. Runs on every login. */
function syncSettingsUi(){
  document.getElementById("overlaySlider").value=g(LS.OVERLAY)||"72";
  setClockFormat(clockFormat);
  document.getElementById("toggleSeconds").checked=showSeconds;
  document.getElementById("toggleRecent").checked=showRecent;
  document.getElementById("toggleWeather").checked=showWeather;
  document.getElementById("toggleParticles").checked=showParticles;
  document.getElementById("setUsername").value=g(LS.USER)||"";
  wallScope=g(LS.WALL_SCOPE)||"full";
  document.querySelectorAll(".wall-scope-btn[data-scope]").forEach(b=>b.classList.toggle("active",b.dataset.scope===wallScope));
  syncWallpaperUi();
  refreshCustomWallPreview();
  syncSettingsExtras(); // username, avatar, apps/categories counts, AI connection state
}


/* ════════════════════════════════════════════════════════════════════
   SETTINGS PANEL LAYOUT  (Account · Appearance · AI Assistant · Apps & Data · Danger Zone)
   ────────────────────────────────────────────────────────────────────
   The panel's controls already exist in the page (and the rest of the code finds them by id).
   So instead of re-creating them, buildSettingsLayout() MOVES each existing control — the very
   same DOM node, with its listeners and inline handlers — into a tabbed layout. That is what keeps
   the clock/theme/wallpaper wiring, the AI autosave, the Connect button and Sign out working.
   The old panel body is kept (hidden) so nothing a user could reach before is lost; the AI
   config fields are pulled out of the AI chat panel and the emptied old config UI there is deleted.
   Everything else (storage keys, per-user namespacing) is untouched.
════════════════════════════════════════════════════════════════════ */
const SX_TABS=[
  {id:"account",   label:"Account",      icon:"ti-user"},
  {id:"appearance",label:"Appearance",   icon:"ti-palette"},
  {id:"ai",        label:"AI Assistant", icon:"ti-brain"},
  {id:"data",      label:"Apps & Data",  icon:"ti-apps"},
  {id:"danger",    label:"Danger Zone",  icon:"ti-alert-triangle",danger:true}
];
const SX_AVATARS=["🦊","🐼","🐙","🦄","🚀","👾","🎧","🌙"];
const AI_TONES=[["friendly","Friendly"],["professional","Professional"],["casual","Casual"],["witty","Witty"],["concise","Concise"]];
let _sxBuilt=false,_sxTab="account",_avatarOriginal=null;

/* ── tiny DOM helpers (text is always a text node — never parsed as HTML) ── */
const $id=id=>document.getElementById(id);
function sxEl(tag,props,...kids){
  const el=document.createElement(tag);
  if(props)for(const [k,v] of Object.entries(props)){
    if(v==null||v===false)continue;
    if(k==="class")el.className=v;
    else if(k==="text")el.textContent=v;
    else el.setAttribute(k,v===true?"":String(v));
  }
  kids.flat().forEach(c=>{if(c==null||c===false)return;el.appendChild(typeof c==="string"?document.createTextNode(c):c);});
  return el;
}
const sxIcon=name=>sxEl("i",{class:"ti "+name,"aria-hidden":"true"});
function sxCard(title,icon,sub,...kids){
  return sxEl("section",{class:"sx-card"},
    sxEl("header",{class:"sx-card-head"},sxIcon(icon),
      sxEl("div",null,sxEl("h3",{class:"sx-card-title",text:title}),sub?sxEl("p",{class:"sx-card-sub",text:sub}):null)),
    sxEl("div",{class:"sx-card-body"},...kids));
}
function sxRow(label,sub,control){
  return sxEl("div",{class:"setting-row sx-row"},
    sxEl("div",{class:"sx-row-text"},sxEl("div",{class:"setting-label",text:label}),sub?sxEl("div",{class:"setting-sub",text:sub}):null),control);
}
function sxField(label,sub,control){
  return sxEl("div",{class:"sx-field"},
    sxEl("label",{class:"sx-field-label",for:control.id||null,text:label}),control,sub?sxEl("div",{class:"setting-sub",text:sub}):null);
}
/** Existing element by id, or a new one (same id) if the page doesn't have it. */
function sxEnsure(id,tag,attrs){
  let el=$id(id);
  if(!el){el=document.createElement(tag);el.id=id;}
  if(attrs)for(const [k,v] of Object.entries(attrs)){if(k==="placeholder"&&el.getAttribute("placeholder"))continue;el.setAttribute(k,v);}
  return el;
}
/** A checkbox (existing or new) inside a `.toggle` switch; returns the switch to place in a row. */
function sxToggle(id,defChecked){
  let input=$id(id);
  if(!input){input=sxEnsure(id,"input",{type:"checkbox"});if(defChecked)input.checked=true;} // missing from the page → create it (default state applied by loadAiConfig on login)
  return input.closest(".toggle")||sxEl("label",{class:"toggle"},input,sxEl("span",{class:"toggle-slider"}));
}
function sxButton(text,cls,icon){
  return sxEl("button",{type:"button",class:cls||"sx-btn"},icon?sxIcon(icon):null,text);
}
/** Inline "are you sure?" box (used instead of window.confirm). */
function sxConfirmBox({message,confirmLabel,needText,onConfirm}){
  const input=needText?sxEl("input",{type:"text",class:"sx-confirm-input",autocomplete:"off",placeholder:`Type ${needText} to confirm`,"aria-label":`Type ${needText} to confirm`}):null;
  const ok=sxButton(confirmLabel,"sx-btn sx-btn-danger");
  const cancel=sxButton("Cancel","sx-btn sx-btn-ghost");
  const box=sxEl("div",{class:"sx-confirm",hidden:true},sxEl("p",{class:"sx-confirm-msg",text:message}),input,sxEl("div",{class:"sx-actions"},cancel,ok));
  const sync=()=>{ok.disabled=!!needText&&(input.value.trim()!==needText);};
  if(input)input.addEventListener("input",sync);
  cancel.addEventListener("click",()=>{box.hidden=true;if(input){input.value="";sync();}});
  ok.addEventListener("click",()=>{if(needText&&input.value.trim()!==needText)return;box.hidden=true;if(input)input.value="";onConfirm();});
  sync();
  box.open=()=>{box.hidden=false;if(input)input.focus();};
  box.close=()=>{box.hidden=true;if(input){input.value="";sync();}};
  return box;
}

/* ── Avatar ── */
function applyAvatar(){
  const av=$id("userAvatar");if(!av)return;
  if(_avatarOriginal===null)_avatarOriginal=[...av.childNodes].map(n=>n.cloneNode(true));
  const pick=CURRENT_UID!=null?g(LS.AVATAR):null;
  if(pick&&SX_AVATARS.includes(pick))av.replaceChildren(document.createTextNode(pick));
  else if(pick==="initial"){
    const name=(g(LS.USER)||CURRENT_USERNAME||localStorage.getItem(LS.CURRENT_USER)||"?").trim();
    av.replaceChildren(document.createTextNode((name[0]||"?").toUpperCase()));
  }else av.replaceChildren(..._avatarOriginal.map(n=>n.cloneNode(true)));
  const prev=$id("sxAvatarPreview");
  if(prev){prev.replaceChildren(...[...av.childNodes].map(n=>n.cloneNode(true)));}
  document.querySelectorAll(".sx-av-opt").forEach(b=>b.classList.toggle("active",b.dataset.av===(pick||"default")));
}
function setAvatar(value){
  if(CURRENT_UID==null)return;
  if(value==="default")rm(LS.AVATAR);else if(value==="initial"||SX_AVATARS.includes(value))p(LS.AVATAR,value);else return;
  applyAvatar();
}

/* ── Account deletion (server first, then this device) ── */
async function deleteMyAccount(password){
  let res;
  try{res=await fetch(API_AUTH.ME,{method:"DELETE",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({password})});}
  catch(e){throw new Error(`Can't reach the Nexus server at ${API_BASE}.`);}
  let data=null;try{data=await res.json();}catch(e){/* non-JSON body */}
  if(!res.ok)throw Object.assign(new Error((data&&data.error)||`Could not delete the account (HTTP ${res.status}).`),{status:res.status});
  try{await clearAllUserData();}catch(e){console.warn("[delete account] local cleanup failed",e);} // this account's data on this device
  signOut();                                                                                        // token cleared → login screen
}

/* ── Default apps / categories ── */
function persistApps(){
  p(LS.APPS,apps);p(LS.FAVS,[...favs]);p(LS.RECENT,recent);
  renderAll();renderSxData();
}
function addMissingDefaultApps(){
  const have=a=>apps.some(x=>x.id===a.id||x.url===a.url);
  const add=DEFAULT_APPS.map(a=>sanitizeApp(structuredClone(a))).filter(a=>a&&!have(a));
  if(!add.length){toast("All default apps are already there","ti-check");return;}
  apps=[...apps,...add];persistApps();toast(`Added ${add.length} default app${add.length>1?"s":""}`,"ti-plus");
}
function resetAppsToDefaults(){
  apps=DEFAULT_APPS.map(a=>sanitizeApp(structuredClone(a))).filter(Boolean);
  const ids=new Set(apps.map(a=>a.id));
  favs=new Set([...favs].filter(id=>ids.has(id)));recent=recent.filter(id=>ids.has(id));
  activeFilter="All";persistApps();toast("Apps reset to defaults","ti-restore");
}
function renameCategory(oldName,newName){
  newName=String(newName||"").trim().slice(0,60);
  if(!newName||newName===oldName)return false;
  if(["All","★ Favourites"].includes(newName)){toast("That name is reserved","ti-alert-circle");return false;}
  apps=apps.map(a=>a.cat===oldName?{...a,cat:newName}:a);
  if(activeFilter===oldName)activeFilter="All";
  persistApps();toast(`Renamed to "${newName}"`,"ti-check");return true;
}
function removeCategory(name){
  apps=apps.map(a=>a.cat===name?{...a,cat:"Other"}:a);
  if(activeFilter===name)activeFilter="All";
  persistApps();toast(`"${name}" removed — its apps moved to Other`,"ti-trash");
}
function renderSxData(){
  const info=$id("sxDefaultsInfo"),list=$id("sxCatList");
  if(info){
    const installed=DEFAULT_APPS.filter(d=>apps.some(a=>a.id===d.id||a.url===d.url)).length;
    info.textContent=`${apps.length} app${apps.length===1?"":"s"} on your dashboard · ${installed} of ${DEFAULT_APPS.length} default apps installed`;
  }
  if(!list)return;
  const counts=new Map();apps.forEach(a=>counts.set(a.cat,(counts.get(a.cat)||0)+1));
  if(!counts.size){list.replaceChildren(sxEl("div",{class:"sx-empty",text:"No categories yet — add an app first."}));return;}
  list.replaceChildren(...[...counts.entries()].map(([name,n])=>{
    const dot=sxEl("span",{class:"sx-cat-dot"});dot.style.background=catColorFor(name);
    const label=sxEl("span",{class:"sx-cat-name",text:name});
    const edit=sxEl("button",{type:"button",class:"sx-icon-btn",title:`Rename ${name}`,"aria-label":`Rename ${name}`},sxIcon("ti-pencil"));
    const del=sxEl("button",{type:"button",class:"sx-icon-btn sx-icon-danger",title:`Remove ${name}`,"aria-label":`Remove ${name}`},sxIcon("ti-trash"));
    const row=sxEl("div",{class:"sx-cat-row"},dot,label,sxEl("span",{class:"sx-cat-count",text:String(n)}),edit);
    if(name!=="Other")row.appendChild(del);
    edit.addEventListener("click",()=>{
      const inp=sxEl("input",{type:"text",class:"sx-cat-input",maxlength:"60","aria-label":"New category name"});inp.value=name;
      const save=sxEl("button",{type:"button",class:"sx-icon-btn"},sxIcon("ti-check")),cancel=sxEl("button",{type:"button",class:"sx-icon-btn"},sxIcon("ti-x"));
      row.replaceChildren(dot,inp,save,cancel);inp.focus();inp.select();
      const done=()=>{if(!renameCategory(name,inp.value))renderSxData();};
      save.addEventListener("click",done);cancel.addEventListener("click",renderSxData);
      inp.addEventListener("keydown",e=>{if(e.key==="Enter")done();else if(e.key==="Escape")renderSxData();});
    });
    del.addEventListener("click",()=>{
      const box=sxConfirmBox({message:`Remove "${name}"? Its ${n} app${n>1?"s":""} will move to "Other".`,confirmLabel:"Remove",onConfirm:()=>removeCategory(name)});
      row.after(box);box.open();
    });
    return row;
  }));
}

/* ── Tabs ── */
function openSettingsTab(id){
  if(!_sxBuilt||!SX_TABS.some(t=>t.id===id))return;
  _sxTab=id;
  document.querySelectorAll(".sx-tab").forEach(t=>{const on=t.dataset.tab===id;t.classList.toggle("active",on);t.setAttribute("aria-selected",on?"true":"false");t.tabIndex=on?0:-1;});
  document.querySelectorAll(".sx-pane").forEach(p2=>{p2.hidden=p2.dataset.pane!==id;});
  const body=document.querySelector("#settingsPanel .sx-body");if(body)body.scrollTop=0;
  if(id==="data")renderSxData();
  if(id==="ai")syncSxAi();
}
function syncSxAi(){
  const el=$id("sxAiState");if(!el)return;
  const on=typeof aiState==="object"&&aiState&&aiState.url&&aiState.key;
  el.textContent=on?"● Connected":"○ Not connected";el.classList.toggle("on",!!on);
}

/* ── Build ── */
function buildSettingsLayout(){
  if(_sxBuilt)return;
  const panel=$id("settingsPanel");if(!panel)return;
  let legacy=panel.querySelector(".panel-body");
  if(!legacy){ // unexpected markup: treat everything below the header as the old body
    legacy=sxEl("div");[...panel.children].filter(c=>!c.classList.contains("panel-header")).forEach(c=>legacy.appendChild(c));panel.appendChild(legacy);
  }
  _sxBuilt=true; // set first: even a partial build must never run twice
  const move=id=>$id(id);

  /* ── ACCOUNT ── (the editing itself happens in the Edit Profile dialog) */
  const avatarPreview=sxEl("div",{class:"sx-avatar-preview",id:"sxAvatarPreview","aria-hidden":"true"});
  const editBtn=sxButton("Edit Profile","sx-btn sx-btn-primary","ti-pencil");editBtn.id="sxEditProfileBtn";
  editBtn.addEventListener("click",()=>openEditProfile({opener:editBtn}));
  const userBtn2=sxButton("Change username","sx-btn","ti-at");userBtn2.id="sxChangeUsernameBtn";
  userBtn2.addEventListener("click",()=>openEditProfile({focus:"username",opener:userBtn2}));
  const signOutBtn=move("signOutBtn")||sxEnsure("signOutBtn","button",{type:"button"});
  signOutBtn.classList.add("sx-btn","sx-btn-wide");
  if(!signOutBtn.textContent.trim())signOutBtn.textContent="Sign out";
  const pane_account=sxEl("div",null,
    sxCard("Profile","ti-id-badge-2","How you appear on Nexus.",
      sxEl("div",{class:"sx-acc-row"},avatarPreview,
        sxEl("div",{class:"sx-acc-text"},sxEl("div",{class:"sx-acc-name",id:"sxAccName"}),sxEl("div",{class:"sx-acc-user",id:"sxAccUser"}),sxEl("div",{class:"sx-acc-bio",id:"sxAccBio"}))),
      sxEl("div",{class:"sx-actions"},editBtn,userBtn2)),
    sxCard("Security","ti-shield-lock","Keep your account safe.",
      sxRow("Change password","Needs a server endpoint that isn't available yet.",sxEl("span",{class:"sx-soon",text:"Coming soon"})),
      sxEl("div",{class:"sx-actions"},(()=>{const b=sxButton("Change password","sx-btn","ti-key");b.disabled=true;b.title="Coming soon";return b;})())),
    sxCard("Account actions","ti-logout","Signing out clears your login token and returns to the login screen. Your saved apps and settings stay on this device.",
      sxEl("div",{class:"sx-actions"},signOutBtn)));

  /* ── APPEARANCE ── */
  const swatchBox=document.querySelector(".theme-swatch")?.parentElement;
  const scopeRow=document.querySelector(".wall-scope-btn")?.parentElement;
  const wallTabs=document.querySelector(".wall-tabs");
  const wallPanes=[...document.querySelectorAll(".wall-tab-content")];
  const overlay=sxEnsure("overlaySlider","input",{type:"range",min:"0",max:"100"});
  const wallCardKids=[scopeRow,wallTabs,...wallPanes,sxRow("Wallpaper darkness","Darken the wallpaper so text stays readable.",overlay)].filter(Boolean);
  const wallExtras=["wallUpload","wallUrlInput","wallUrlBtn","clearCustomWall","customWallPreview"].map($id).filter(el=>el&&legacy.contains(el)&&!wallCardKids.some(k=>k.contains&&k.contains(el)));
  const clockBtns=sxEl("div",{class:"sx-seg"},...["clock12Btn","clock24Btn"].map(move).filter(Boolean));
  clockBtns.querySelectorAll("button").forEach(b=>b.classList.add("sx-seg-btn"));
  const pane_appearance=sxEl("div",null,
    sxCard("Theme","ti-color-swatch","Accent colour used across Nexus.",swatchBox),
    sxCard("Wallpaper","ti-photo","Photos, live animations or your own image.",...wallCardKids,...wallExtras),
    sxCard("UI preferences","ti-adjustments","What shows on your dashboard.",
      sxRow("Clock format","12-hour or 24-hour",clockBtns),
      sxRow("Show seconds","On the hero clock",sxToggle("toggleSeconds")),
      sxRow("Recent apps","Quick strip of apps you opened lately",sxToggle("toggleRecent")),
      sxRow("Weather widget","Uses your location while shown",sxToggle("toggleWeather")),
      sxRow("Particle background","Animated dots behind the hero",sxToggle("toggleParticles"))));

  /* ── AI ASSISTANT (moved out of the AI chat panel) ── */
  const url=sxEnsure("aiModelUrl","input",{type:"url",placeholder:"https://api.openai.com/v1/chat/completions",autocomplete:"off",spellcheck:"false"});
  const key=sxEnsure("aiApiKey","input",{type:"password",placeholder:"sk-…",autocomplete:"new-password",spellcheck:"false"});
  const eye=sxEl("button",{type:"button",class:"sx-icon-btn","aria-label":"Show or hide API key",title:"Show / hide"},sxIcon("ti-eye"));
  eye.addEventListener("click",()=>{const show=key.type==="password";key.type=show?"text":"password";eye.firstChild.className="ti "+(show?"ti-eye-off":"ti-eye");});
  const model=sxEnsure("aiModelName","input",{type:"text",placeholder:"gpt-4o-mini",autocomplete:"off",spellcheck:"false"});
  const persona=sxEnsure("aiPersonaName","input",{type:"text",placeholder:"ARIA",maxlength:"30",autocomplete:"off"});
  const uname=sxEnsure("aiUserName","input",{type:"text",placeholder:"What should the AI call you?",maxlength:"40",autocomplete:"off"});
  let tone=$id("aiTone");
  if(!tone){tone=sxEnsure("aiTone","select");AI_TONES.forEach(([v,l])=>tone.appendChild(sxEl("option",{value:v,text:l})));}
  const proxy=sxEnsure("aiProxyUrl","input",{type:"url",placeholder:"https://corsproxy.io/?",autocomplete:"off",spellcheck:"false"});
  const instr=sxEnsure("aiCustomInstructions","textarea",{rows:"4",placeholder:"e.g. Keep answers short. Always reply in English."});
  const connect=move("aiConnectBtn")||(()=>{const b=sxEnsure("aiConnectBtn","button",{type:"button"});b.textContent="Connect";b.addEventListener("click",()=>aiConnectNow());return b;})();
  connect.classList.add("sx-btn","sx-btn-primary");
  connect.addEventListener("click",()=>setTimeout(syncSxAi,60));
  const pane_ai=sxEl("div",null,
    sxCard("Connection","ti-plug-connected","Any OpenAI-compatible endpoint. Stored for your account on this device.",
      sxField("API URL",null,url),
      sxField("API key",null,sxEl("div",{class:"sx-secret"},key,eye)),
      sxField("Model",null,model),
      sxEl("div",{class:"sx-actions sx-actions-split"},sxEl("span",{class:"sx-state",id:"sxAiState",text:"○ Not connected"}),connect)),
    sxCard("Name & persona","ti-mood-smile","Who you're talking to.",
      sxField("AI name",null,persona),
      sxField("Your name","Used when the AI addresses you.",uname),
      sxField("Tone",null,tone)),
    sxCard("Web search","ti-world-search","Lets the assistant look things up online.",
      sxRow("Web search","Allow searching the web",sxToggle("aiWebSearch",true)),
      sxField("CORS proxy","Search requests go through this proxy. Only use one you trust.",proxy)),
    sxCard("Behaviour","ti-toggle-right","",
      sxRow("Auto-search","Search automatically when a question needs fresh info",sxToggle("aiAutoSearch",true)),
      sxRow("App suggestions","Suggest apps from your dashboard",sxToggle("aiAllowApps",true)),
      sxRow("Emotion detection","Adapt replies to the mood of your message",sxToggle("aiEmotionDetect",true)),
      sxRow("Auto-open links","Open the app automatically when there's a single match",sxToggle("aiAutoOpen",false))),
    sxCard("Custom instructions","ti-notes","Added to every conversation.",sxField("Instructions",null,instr)));

  /* ── APPS & DATA ── */
  const addDefaults=sxButton("Add missing defaults","sx-btn","ti-plus");
  addDefaults.addEventListener("click",addMissingDefaultApps);
  const resetApps=sxButton("Reset apps to defaults","sx-btn sx-btn-ghost","ti-restore");
  const resetAppsBox=sxConfirmBox({message:"Replace ALL your apps with the default set? Apps you added yourself will be removed.",confirmLabel:"Reset apps",onConfirm:resetAppsToDefaults});
  resetApps.addEventListener("click",()=>resetAppsBox.open());
  const pane_data=sxEl("div",null,
    sxCard("Default apps","ti-apps","The starter set that comes with Nexus.",
      sxEl("div",{class:"setting-sub",id:"sxDefaultsInfo"}),
      sxEl("div",{class:"sx-actions"},addDefaults,resetApps),resetAppsBox),
    sxCard("Categories","ti-tags","Rename a category, or remove one (its apps move to \"Other\").",sxEl("div",{id:"sxCatList",class:"sx-cat-list"})));

  /* ── DANGER ZONE ── */
  const resetBtn=move("resetDataBtn")||sxEnsure("resetDataBtn","button",{type:"button"});
  resetBtn.classList.add("sx-btn","sx-btn-danger");if(!resetBtn.textContent.trim())resetBtn.textContent="Reset all data";
  const resetBox=sxConfirmBox({message:"This erases your apps, notes, settings, AI config and wallpapers on this device. Your login stays.",confirmLabel:"Erase everything",needText:"RESET",
    onConfirm:()=>{clearAllUserData().finally(()=>location.reload());}});
  resetBox.querySelector(".sx-confirm-input").id="sxResetConfirm";
  resetBtn.onclick=()=>resetBox.open();
  const delPass=sxEl("input",{type:"password",id:"sxDelPass",autocomplete:"current-password",placeholder:"Your password"});
  const delAck=sxEl("input",{type:"checkbox",id:"sxDelAck"});
  const delErr=sxEl("div",{class:"sx-error",id:"sxDelErr",role:"alert",hidden:true});
  const delBtn=sxButton("Delete my account","sx-btn sx-btn-danger","ti-user-x");delBtn.disabled=true;
  const delSync=()=>{delBtn.disabled=!(delAck.checked&&delPass.value.length>0);};
  delPass.addEventListener("input",delSync);delAck.addEventListener("change",delSync);
  delBtn.addEventListener("click",async()=>{
    delErr.hidden=true;delBtn.disabled=true;const label=delBtn.lastChild.textContent;delBtn.lastChild.textContent="Deleting…";
    try{await deleteMyAccount(delPass.value);}
    catch(err){delErr.textContent=err.message||"Could not delete the account.";delErr.hidden=false;}
    finally{delBtn.lastChild.textContent=label;delPass.value="";delAck.checked=false;delSync();}
  });
  const pane_danger=sxEl("div",null,
    sxCard("Reset all data","ti-eraser","Start fresh without deleting your login.",sxEl("div",{class:"sx-actions"},resetBtn),resetBox),
    sxCard("Delete account","ti-user-x","Permanently deletes your account on the server and clears its data on this device. This can't be undone.",
      sxField("Confirm with your password",null,delPass),
      sxEl("label",{class:"sx-check"},delAck,sxEl("span",{text:"I understand this is permanent."})),
      delErr,sxEl("div",{class:"sx-actions"},delBtn)));

  /* ── assemble ── */
  const panes={account:pane_account,appearance:pane_appearance,ai:pane_ai,data:pane_data,danger:pane_danger};
  const tablist=sxEl("div",{class:"sx-tabs",role:"tablist","aria-label":"Settings sections"},SX_TABS.map(t=>{
    const b=sxEl("button",{type:"button",class:"sx-tab"+(t.danger?" danger":""),role:"tab","data-tab":t.id,id:"sxtab-"+t.id,"aria-controls":"sxpane-"+t.id},sxIcon(t.icon),sxEl("span",{text:t.label}));
    b.addEventListener("click",()=>openSettingsTab(t.id));
    b.addEventListener("keydown",e=>{
      const i=SX_TABS.findIndex(x=>x.id===t.id);let n=null;
      if(e.key==="ArrowRight")n=(i+1)%SX_TABS.length;else if(e.key==="ArrowLeft")n=(i-1+SX_TABS.length)%SX_TABS.length;
      else if(e.key==="Home")n=0;else if(e.key==="End")n=SX_TABS.length-1;
      if(n!==null){e.preventDefault();openSettingsTab(SX_TABS[n].id);$id("sxtab-"+SX_TABS[n].id).focus();}
    });
    return b;
  }));
  const body=sxEl("div",{class:"sx-body"},SX_TABS.map(t=>{const pn=panes[t.id];pn.className="sx-pane";pn.dataset.pane=t.id;pn.id="sxpane-"+t.id;pn.setAttribute("role","tabpanel");pn.setAttribute("aria-labelledby","sxtab-"+t.id);pn.hidden=true;return pn;}));
  const wrap=sxEl("div",{class:"sx-wrap"},tablist,body);
  legacy.style.display="none";legacy.setAttribute("data-sx-legacy","");
  legacy.after(wrap);

  /* anything interactive that was NOT relocated stays reachable instead of silently vanishing */
  const stray=[...legacy.querySelectorAll("input,select,textarea,button")].filter(el=>(el.id||el.tagName==="BUTTON")&&!["setUsername","saveAccountBtn"].includes(el.id)); // those two are replaced by the Edit Profile dialog
  if(stray.length){legacy.style.display="";legacy.classList.add("sx-legacy");pane_appearance.appendChild(sxCard("Other settings","ti-dots","",legacy));}

  /* The AI chat panel is chat-only: every AI config control now lives in Settings → AI Assistant (moved above),
     so delete what is left of the old config UI there (header rows, Behavior Settings block, "⚙️ Settings" button). */
  if(typeof removeLegacyAiConfigUi==="function")removeLegacyAiConfigUi();
  openSettingsTab(_sxTab);
}
function syncSettingsExtras(){
  if(!_sxBuilt)return;
  refreshProfileUi(); // avatar, display name, @username, bio — all from THIS account
  renderSxData();syncSxAi();
  ["sxDelPass","sxResetConfirm"].forEach(id=>{const el=$id(id);if(el)el.value="";});
}

/* ════════════════════════════════════════════════════════════════════
   PROFILE POPUP + EDIT PROFILE
   ────────────────────────────────────────────────────────────────────
   • Topbar avatar → small fixed-size popup (avatar, display name, @username, scrolling bio, 3 buttons).
   • "Edit Profile" (popup + Settings → Account) → one dialog: avatar, display name, bio, and — as a
     separate, password-protected step — the login username.
   Per-user data: avatar / display name / bio live in THIS account's own storage (g/p/rm, namespaced by the
   account id). The login username lives on the server (PATCH /api/auth/me/username).
   Everything is built from JS (no index.html change); all text goes in via textContent.
════════════════════════════════════════════════════════════════════ */
let _pp=null,_ppAbort=null,_ppOpener=null,_ppOpen=false;
let _ep=null,_epAbort=null,_epOpener=null,_epOpen=false,_epBase=null,_epDraft=null,_epBusy=false;
const EP_USER_HINT=`At least ${USERNAME_MIN_LETTERS} letters and ${USERNAME_MIN_DIGITS} number · only a–z, 0–9 and hyphens (-) · spaces become hyphens · this is also your login name`;
let _epSpaceNote=false; // true right after a typed space was turned into a hyphen

/** The logged-in account's profile, read from ITS namespaced storage (never another user's). */
function readProfile(){
  const username=CURRENT_USERNAME||normalizeUsername(localStorage.getItem(LS.CURRENT_USER)||"");
  const name=sanitizeDisplayName(g(LS.USER))||username||"User";
  const pick=g(LS.AVATAR);
  const avatar=(pick==="initial"||SX_AVATARS.includes(pick))?pick:"default";
  return{username,name,bio:sanitizeBio(g(LS.BIO)),avatar};
}

/** Re-draws every place that shows the profile (topbar avatar, Settings summary, popup, editor header). */
function refreshProfileUi(){
  try{applyAvatar();}catch(e){/* avatar element missing */}
  const d=readProfile();
  const set=(id,text)=>{const el=$id(id);if(el)el.textContent=text;};
  set("sxAccName",d.name);set("sxAccUser","@"+d.username);
  const ab=$id("sxAccBio");if(ab){ab.textContent=d.bio||"No bio yet.";ab.classList.toggle("empty",!d.bio);}
  set("epCurrentUser","@"+d.username);
  if(_pp)fillProfilePopup();
}

/* ───────────────────────── Profile popup ───────────────────────── */
function buildProfilePopup(){
  if(_pp)return;
  const btn=(id,label,icon,cls)=>{const b=sxEl("button",{type:"button",id,class:"pp-btn "+(cls||"")},sxIcon(icon),sxEl("span",{text:label}));return b;};
  const edit=btn("ppEdit","Edit Profile","ti-pencil","pp-btn-primary");
  const sett=btn("ppSettings","Settings","ti-settings");
  const out=btn("ppSignOut","Sign out","ti-logout","pp-btn-danger pp-btn-wide");
  edit.addEventListener("click",()=>openEditProfile({opener:_ppOpener}));
  sett.addEventListener("click",()=>{closeProfilePopup(false);$id("settingsBtn")?.click();openSettingsTab("account");});
  out.addEventListener("click",()=>{closeProfilePopup(false);signOut();});
  const stagger=(i,el)=>{el.classList.add("pp-stagger");el.style.setProperty("--i",String(i));return el;};
  _pp=sxEl("div",{id:"profilePopup",class:"pp",role:"dialog","aria-label":"Your profile",tabindex:"-1","aria-hidden":"true"},
    sxEl("div",{class:"pp-banner"}),
    sxEl("div",{class:"pp-avatar-wrap"},sxEl("div",{class:"pp-avatar",id:"ppAvatar","aria-hidden":"true"})),
    sxEl("div",{class:"pp-card"},
      stagger(1,sxEl("div",{class:"pp-name",id:"ppName"})),
      stagger(2,sxEl("div",{class:"pp-user",id:"ppUser"})),
      sxEl("div",{class:"pp-sep"}),
      stagger(3,sxEl("div",{class:"pp-label",text:"About me"})),
      stagger(4,sxEl("div",{class:"pp-bio",id:"ppBio",tabindex:"0",role:"region","aria-label":"About me"}))),
    stagger(5,sxEl("div",{class:"pp-actions"},edit,sett,out)));
  _pp.addEventListener("keydown",e=>{ // keep Tab inside the popup while it is open
    if(e.key!=="Tab")return;
    const f=[..._pp.querySelectorAll("button,[tabindex='0']")].filter(x=>!x.disabled);
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===_pp)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  document.body.appendChild(_pp);
}
function fillProfilePopup(){
  if(!_pp)return;
  const d=readProfile();
  const nm=$id("ppName");nm.textContent=d.name;nm.title=d.name;
  $id("ppUser").textContent="@"+d.username;
  const bio=$id("ppBio");bio.textContent=d.bio||"No bio yet.";bio.classList.toggle("empty",!d.bio);bio.scrollTop=0;
  const av=$id("userAvatar");
  $id("ppAvatar").replaceChildren(...(av?[...av.childNodes].map(n=>n.cloneNode(true)):[]));
}
function positionProfilePopup(anchor){
  if(!_pp||!anchor)return;
  const r=anchor.getBoundingClientRect(),pad=12,w=_pp.offsetWidth||320,h=_pp.offsetHeight||0;
  const left=Math.min(Math.max(pad,r.right-w),Math.max(pad,window.innerWidth-w-pad));
  const top=Math.max(pad,Math.min(r.bottom+10,window.innerHeight-h-pad));
  _pp.style.left=left+"px";_pp.style.top=top+"px";
  _pp.style.setProperty("--pp-ox",Math.round(r.left+r.width/2-left)+"px"); // the popup grows out of the avatar
}
function isProfilePopupOpen(){return _ppOpen;}
function openProfilePopup(anchor){
  if(CURRENT_UID==null||_ppOpen)return;
  buildProfilePopup();
  _ppOpener=anchor||$id("userAvatar");
  fillProfilePopup();positionProfilePopup(_ppOpener);
  _ppOpen=true;
  _pp.setAttribute("aria-hidden","false");
  _pp.getBoundingClientRect(); // commit the closed state so the open transition always plays
  _pp.classList.add("open");
  if(_ppOpener)_ppOpener.setAttribute("aria-expanded","true");
  _ppAbort=new AbortController();const opt={signal:_ppAbort.signal};
  document.addEventListener("pointerdown",e=>{ // click outside closes (the avatar itself is handled by its own toggle)
    if(_pp.contains(e.target)||(_ppOpener&&_ppOpener.contains(e.target)))return;
    closeProfilePopup(false);
  },{...opt,capture:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();closeProfilePopup(true);}},opt);
  window.addEventListener("resize",()=>positionProfilePopup(_ppOpener),opt);
  _pp.focus({preventScroll:true});
}
function closeProfilePopup(restoreFocus){
  if(!_ppOpen)return;
  _ppOpen=false;
  if(_ppAbort){_ppAbort.abort();_ppAbort=null;}
  if(_pp){_pp.classList.remove("open");_pp.setAttribute("aria-hidden","true");}
  if(_ppOpener){_ppOpener.setAttribute("aria-expanded","false");if(restoreFocus)_ppOpener.focus({preventScroll:true});}
}
function toggleProfilePopup(anchor){_ppOpen?closeProfilePopup(false):openProfilePopup(anchor);}

/* ───────────────────────── Edit Profile dialog ───────────────────────── */
function epDirty(){
  if(!_epBase||!_epDraft)return false;
  return _epDraft.avatar!==_epBase.avatar||sanitizeDisplayName(_epDraft.name)!==_epBase.name||sanitizeBio(_epDraft.bio)!==_epBase.bio;
}
function epShowAvatar(){
  const prev=$id("epAvatarPreview");if(!prev)return;
  const d=readProfile(),a=_epDraft.avatar;
  if(SX_AVATARS.includes(a))prev.replaceChildren(document.createTextNode(a));
  else if(a==="initial")prev.replaceChildren(document.createTextNode(((sanitizeDisplayName(_epDraft.name)||d.username||"?")[0]||"?").toUpperCase()));
  else{const av=$id("userAvatar");prev.replaceChildren(...(av&&_avatarOriginal?_avatarOriginal.map(n=>n.cloneNode(true)):[document.createTextNode((d.username[0]||"?").toUpperCase())]));}
  document.querySelectorAll(".ep-av-opt").forEach(b=>{const on=b.dataset.av===a;b.classList.toggle("active",on);b.setAttribute("aria-pressed",on?"true":"false");});
}
function epSync(){
  if(!_ep)return;
  const nameOk=!!sanitizeDisplayName($id("epName").value);
  const save=$id("epSave");if(save)save.disabled=_epBusy||!epDirty()||!nameOk;
  $id("epBioCount").textContent=`${$id("epBio").value.length} / ${BIO_MAX}`;
  $id("epBioCount").classList.toggle("near",$id("epBio").value.length>BIO_MAX-60);
}
function epUserValidate(){
  if(!_ep)return false;
  const v=normalizeUsername($id("epUser").value),hint=$id("epUserHint"),cur=readProfile().username;
  let msg=EP_USER_HINT,state="";
  if(v){
    const problems=usernameProblems(v);
    if(problems.length){msg=problems.join("\n");state="bad";}  // one line per broken rule
    else if(v===cur){msg="That is already your username.";state="bad";}
    else{msg="✓ Looks good";state="ok";}
  }
  hint.textContent=(_epSpaceNote?USERNAME_MSG.spaceFixed+"\n":"")+msg;hint.dataset.state=state;
  $id("epUserBtn").disabled=_epBusy||!(state==="ok"&&$id("epPass").value.length>0);
  return state==="ok";
}
function epUserMessage(text,kind){
  const err=$id("epUserErr"),ok=$id("epUserOk");
  err.hidden=kind!=="error";ok.hidden=kind!=="ok";
  if(kind==="error")err.textContent=text;if(kind==="ok")ok.textContent=text;
}
function buildEditProfile(){
  if(_ep)return;
  const nameIn=sxEl("input",{type:"text",id:"epName",maxlength:String(DISPLAY_NAME_MAX),autocomplete:"off",spellcheck:"false"});
  const bioIn=sxEl("textarea",{id:"epBio",maxlength:String(BIO_MAX),rows:"5",autocomplete:"off",placeholder:"Tell people a little about yourself…"});
  const nameErr=sxEl("div",{class:"sx-error",id:"epNameErr",role:"alert",hidden:true});
  const avPrev=sxEl("div",{class:"ep-av-preview",id:"epAvatarPreview","aria-hidden":"true"});
  const avOpts=[["default","⟲","Default avatar"],["initial","Aa","Use my initial"],...SX_AVATARS.map(a=>[a,a,"Avatar "+a])].map(([val,label,title])=>{
    const b=sxEl("button",{type:"button",class:"ep-av-opt","data-av":val,title,"aria-label":title,"aria-pressed":"false",text:label});
    b.addEventListener("click",()=>{_epDraft.avatar=val;epShowAvatar();epSync();});return b;
  });
  const save=sxEl("button",{type:"button",id:"epSave",class:"sx-btn sx-btn-primary"},sxIcon("ti-check"),"Save changes");
  const cancel=sxEl("button",{type:"button",id:"epCancel",class:"sx-btn sx-btn-ghost",text:"Cancel"});
  const userIn=sxEl("input",{type:"text",id:"epUser",maxlength:String(USERNAME_MAX),autocomplete:"off",autocapitalize:"off",spellcheck:"false",placeholder:"newusername123"});
  const passIn=sxEl("input",{type:"password",id:"epPass",autocomplete:"current-password",placeholder:"Your current password"});
  const userHint=sxEl("div",{class:"ep-hint",id:"epUserHint",text:EP_USER_HINT});
  const userErr=sxEl("div",{class:"sx-error",id:"epUserErr",role:"alert",hidden:true});
  const userOk=sxEl("div",{class:"ep-success",id:"epUserOk",role:"status",hidden:true});
  const userBtn=sxEl("button",{type:"button",id:"epUserBtn",class:"sx-btn"},sxIcon("ti-at"),"Change username");userBtn.disabled=true;
  const close=sxEl("button",{type:"button",class:"ep-close","aria-label":"Close",title:"Close"},sxIcon("ti-x"));

  nameIn.addEventListener("input",()=>{_epDraft.name=nameIn.value;nameErr.hidden=true;if(_epDraft.avatar==="initial")epShowAvatar();epSync();});
  bioIn.addEventListener("input",()=>{_epDraft.bio=bioIn.value;epSync();});
  save.addEventListener("click",saveProfileEdits);
  cancel.addEventListener("click",()=>closeEditProfile(true));
  close.addEventListener("click",()=>closeEditProfile(false));
  wireUsernameInput(userIn,spaced=>{ // lowercases, turns spaces into "-" and keeps the caret (utils.js)
    _epSpaceNote=spaced;epUserMessage("",null);epUserValidate();
  });
  passIn.addEventListener("input",()=>{epUserMessage("",null);epUserValidate();});
  const enter=e=>{if(e.key==="Enter"&&!userBtn.disabled){e.preventDefault();submitUsernameChange();}};
  userIn.addEventListener("keydown",enter);passIn.addEventListener("keydown",enter);
  userBtn.addEventListener("click",submitUsernameChange);

  const dialog=sxEl("div",{class:"ep-dialog",role:"dialog","aria-modal":"true","aria-labelledby":"epTitle"},
    sxEl("header",{class:"ep-head"},sxEl("h2",{class:"ep-title",id:"epTitle",text:"Edit Profile"}),close),
    sxEl("div",{class:"ep-body"},
      sxEl("section",{class:"ep-section"},
        sxEl("h3",{class:"ep-section-title",text:"Profile"}),
        sxEl("div",{class:"ep-av-row"},avPrev,sxEl("div",{class:"ep-av-opts",role:"group","aria-label":"Avatar"},avOpts)),
        sxField("Display name","Shown on your profile. Free to change — it is not your login name.",nameIn),nameErr,
        sxEl("div",{class:"sx-field"},
          sxEl("label",{class:"sx-field-label",for:"epBio",text:"Bio"}),bioIn,
          sxEl("div",{class:"ep-count",id:"epBioCount"})),
        sxEl("div",{class:"sx-actions ep-actions"},cancel,save)),
      sxEl("section",{class:"ep-section ep-section-user"},
        sxEl("h3",{class:"ep-section-title",text:"Username"}),
        sxEl("p",{class:"ep-note"},"Your login name is ",sxEl("strong",{id:"epCurrentUser"}),". Changing it needs your current password."),
        sxEl("div",{class:"sx-field"},sxEl("label",{class:"sx-field-label",for:"epUser",text:"New username"}),userIn,userHint),
        sxField("Current password",null,passIn),
        userErr,userOk,
        sxEl("div",{class:"sx-actions"},userBtn))));
  _ep=sxEl("div",{id:"editProfileOverlay",class:"ep-overlay","aria-hidden":"true"},dialog);
  _ep.dialog=dialog;
  _ep.addEventListener("pointerdown",e=>{if(e.target===_ep)closeEditProfile(false);});
  document.body.appendChild(_ep);
}
function openEditProfile(opts){
  opts=opts||{};
  if(CURRENT_UID==null||_epOpen)return;
  closeProfilePopup(false);
  buildEditProfile();
  const d=readProfile();
  _epBase={avatar:d.avatar,name:d.name,bio:d.bio};
  _epDraft={..._epBase};_epBusy=false;
  _epOpener=opts.opener||document.activeElement;
  $id("epName").value=d.name;$id("epBio").value=d.bio;
  $id("epNameErr").hidden=true;
  $id("epUser").value="";$id("epPass").value="";epUserMessage("",null);_epSpaceNote=false;
  $id("epCurrentUser").textContent="@"+d.username;
  epShowAvatar();epSync();epUserValidate();
  _epOpen=true;
  _ep.setAttribute("aria-hidden","false");
  _ep.getBoundingClientRect();
  _ep.classList.add("open");
  _epAbort=new AbortController();const opt={signal:_epAbort.signal};
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeEditProfile(false);}
    else if(e.key==="Tab"){ // focus trap
      const f=[..._ep.dialog.querySelectorAll("button,input,textarea")].filter(x=>!x.disabled&&!x.hidden&&x.offsetParent!==null||x===document.activeElement);
      if(!f.length)return;
      const first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      else if(!_ep.dialog.contains(document.activeElement)){e.preventDefault();first.focus();}
    }
  },{...opt,capture:true});
  requestAnimationFrame(()=>{const t=opts.focus==="username"?$id("epUser"):$id("epName");if(t){t.focus({preventScroll:true});if(t.select&&opts.focus!=="username")t.select();}
    if(opts.focus==="username"&&$id("epUser").scrollIntoView)$id("epUser").scrollIntoView({block:"center"});});
}
/** Closes the dialog. Unsaved edits are never thrown away by Esc / backdrop / ✕ — the dialog just nudges;
 *  Cancel (force) discards them. `silent` skips focus restore (used when the session is being torn down). */
function closeEditProfile(force,silent){
  if(!_epOpen)return true;
  if(!force&&epDirty()&&!silent){
    _ep.dialog.classList.remove("nudge");void _ep.dialog.offsetWidth;_ep.dialog.classList.add("nudge");
    toast("You have unsaved changes — Save or Cancel","ti-alert-circle");
    return false;
  }
  _epOpen=false;
  if(_epAbort){_epAbort.abort();_epAbort=null;}
  _ep.classList.remove("open");_ep.setAttribute("aria-hidden","true");
  const pw=$id("epPass");if(pw)pw.value="";
  const un=$id("epUser");if(un)un.value="";
  if(!silent&&_epOpener&&_epOpener.isConnected)_epOpener.focus({preventScroll:true});
  return true;
}
function saveProfileEdits(){
  if(CURRENT_UID==null||!_epOpen)return;
  const name=sanitizeDisplayName($id("epName").value),bio=sanitizeBio($id("epBio").value);
  if(!name){const e=$id("epNameErr");e.textContent="Display name can't be empty.";e.hidden=false;$id("epName").focus();return;}
  if(!p(LS.USER,name))return;                 // p() already told the user if storage refused
  if(bio){if(!p(LS.BIO,bio))return;}else rm(LS.BIO);
  setAvatar(_epDraft.avatar);
  refreshProfileUi();
  toast("Profile updated","ti-check");
  closeEditProfile(true);
}
async function submitUsernameChange(){
  if(_epBusy||CURRENT_UID==null||!_epOpen)return;
  const next=normalizeUsername($id("epUser").value),pass=$id("epPass").value;
  if(!epUserValidate()||!pass){epUserMessage(usernameError(next,"\n")||"Enter your current password.","error");return;}
  const old=readProfile();
  _epBusy=true;epUserMessage("",null);epUserValidate();
  const btn=$id("epUserBtn"),label=btn.lastChild;label.textContent="Saving…";
  const requestUid=CURRENT_UID;
  try{
    let res;
    try{res=await fetch(API_AUTH.USERNAME,{method:"PATCH",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({username:next,password:pass})});}
    catch(e){throw new Error(`Can't reach the Nexus server at ${API_BASE}.`);}
    let data=null;try{data=await res.json();}catch(e){/* non-JSON body */}
    if(CURRENT_UID!==requestUid)return; // signed out / switched account while waiting — never apply it to someone else
    if(!res.ok)throw new Error((data&&data.error)||(res.status===409?"Username already exists":`Could not change the username (HTTP ${res.status}).`));
    if(!data||!data.token||typeof data.username!=="string")throw new Error("The server's reply was incomplete. Please try again.");
    setAuthToken(data.token);                                   // the old token still names the old username
    localStorage.setItem(LS.CURRENT_USER,data.username);
    CURRENT_USERNAME=normalizeUsername(data.username);
    const stored=g(LS.USER);                                    // a display name that was only ever the old login name follows it
    if(typeof stored==="string"&&stored.trim().toLowerCase()===old.username)p(LS.USER,data.username);
    $id("epUser").value="";$id("epPass").value="";
    refreshProfileUi();
    epUserMessage(`Username changed to @${data.username}`,"ok");
    toast(`Username changed to @${data.username}`,"ti-check");
  }catch(err){
    $id("epPass").value="";
    epUserMessage(err.message||"Could not change the username.","error");
  }finally{
    _epBusy=false;if(btn.isConnected)btn.lastChild.textContent="Change username";epUserValidate();epSync();
  }
}
/** Closes everything profile-related and clears typed secrets (sign-out / lock / admin block). */
function closeProfileUi(){
  try{closeProfilePopup(false);}catch(e){console.warn("[profile] popup close failed",e);}
  try{closeEditProfile(true,true);}catch(e){console.warn("[profile] editor close failed",e);}
  _epBusy=false;_epBase=null;_epDraft=null;
}

try{
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{try{buildSettingsLayout();}catch(e){console.error("[settings] layout failed",e);}});
  else buildSettingsLayout();
}catch(err){console.error("[settings] layout failed — the old Settings panel is shown instead",err);
  const lg=document.querySelector("#settingsPanel [data-sx-legacy]");if(lg)lg.style.display="";}
