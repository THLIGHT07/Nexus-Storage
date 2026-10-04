const {JSDOM}=require("jsdom"),fs=require("fs"),path=require("path");
const root=process.argv[2], label=process.argv[3];
const files=["js/utils.js","js/ai/ai-core.js","js/apps.js","js/settings.js","js/notes.js","js/wallpapers.js","js/boot.js","js/main.js"];
// the real index.html isn't in the zip → build a stub DOM containing every id the scripts ask for
const ids=new Set();
for(const f of files){for(const m of fs.readFileSync(path.join(root,f),"utf8").matchAll(/getElementById\(["']([^"']+)["']\)/g))ids.add(m[1]);}
["settingsPanel","notesPanel","loginEyeBtn","loginEyeIcon","regEyeBtn","regEyeIcon"].forEach(i=>ids.add(i));
const html="<!doctype html><body>"+[...ids].map(i=>{
  const t=/Canvas$/.test(i)||i==="bgCanvas"?"canvas":(/^(searchInput|noteTitle|aiInput|aiModelUrl|aiApiKey|aiModelName|aiUserName|aiPersonaName|aiCustomInstructions|aiProxyUrl|loginUser|loginPass|regUser|regPass|setUsername|wallUrlInput|fieldName|fieldUrl|fieldIcon|fieldCat|overlaySlider)$/.test(i)?"input":(i==="noteBody"?"textarea":"div"));
  return `<${t} id="${i}"></${t}>`}).join("")+'<div class="recent-bar"></div></body>';
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"http://localhost:8080/"});
const w=dom.window;w.structuredClone=structuredClone;
const stats={geo:0,fetch:0,toDataURL:0,geoMode:"ok",geoDelay:0};
Object.defineProperty(w.navigator,"geolocation",{value:{getCurrentPosition(ok,err){stats.geo++;setTimeout(()=>stats.geoMode==="ok"?ok({coords:{latitude:1,longitude:2}}):err({code:1}),stats.geoDelay);}}});
w.HTMLCanvasElement.prototype.toDataURL=function(){stats.toDataURL++;return "data:image/png;base64,AA==";};
for(const t of ["particles","matrix","aurora","stars","waves"]){const th=w.document.createElement("div");th.className="live-wall-thumb";th.dataset.live=t;const c=w.document.createElement("canvas");c.id="prev-"+t;th.appendChild(c);w.document.body.appendChild(th);}

// ---- instrumentation ----
const pendingAll=new Set();const liveIntervals=new Set(),pendingRaf=new Set(),listeners=[];
const _si=w.setInterval.bind(w),_ci=w.clearInterval.bind(w);
w.setInterval=(f,t)=>{const id=_si(f,t);liveIntervals.add(id);return id;};
w.clearInterval=id=>{liveIntervals.delete(id);_ci(id);};
const _raf=w.requestAnimationFrame.bind(w),_caf=w.cancelAnimationFrame.bind(w);
w.requestAnimationFrame=cb=>{const id=_raf(ts=>{pendingRaf.delete(id);pendingAll.delete(id);cb(ts);});if(cb.name==="draw")pendingRaf.add(id);if(cb.name==="frame")pendingAll.add(id);return id;};
w.cancelAnimationFrame=id=>{pendingRaf.delete(id);pendingAll.delete(id);_caf(id);};
const _add=w.EventTarget.prototype.addEventListener;
w.EventTarget.prototype.addEventListener=function(type,fn,opt){listeners.push({t:this,type,signal:opt&&opt.signal});return _add.call(this,type,fn,opt);};
const noop=new Proxy(function(){},{get:(_,k)=>k==="canvas"?{}:noop,apply:()=>noop,set:()=>true});
w.HTMLCanvasElement.prototype.getContext=()=>noop;
w.fetch=()=>Promise.reject(new Error("offline"));
w.confirm=()=>false;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
for(const f of files){const s=w.document.createElement("script");s.textContent=fs.readFileSync(path.join(root,f),"utf8");w.document.body.appendChild(s);}
if(errs.length)console.log("script load errors:",errs);
const $=id=>w.document.getElementById(id);
const active=(el,type)=>listeners.filter(l=>l.t===el&&l.type===type&&!(l.signal&&l.signal.aborted)).length;
const ev=(el,type,init)=>el.dispatchEvent(new w.Event(type,{bubbles:true,...init}));
const ev2=w.eval; // for reading lets
const out=[];const toasts=[];
const report=(step)=>{
  const r={step,
    addNoteBtnListeners:active($("addNoteBtn"),"click"),
    searchInputListeners:active($("searchInput"),"input"),
    gridDropListeners:active($("grid"),"drop"),
    docKeydownListeners:listeners.filter(l=>l.t===w.document&&l.type==="keydown"&&l.signal&&!l.signal.aborted).length,
    resizeListeners:listeners.filter(l=>l.t===w&&l.type==="resize"&&l.signal&&!l.signal.aborted).length,
    liveIntervals:liveIntervals.size,
    particleLoops:pendingRaf.size};
  out.push(r);return r;
};
const _t=w.toast;w.toast=function(m){toasts.push(m);return _t.apply(this,arguments);};
async function login(n){
  w.setCurrentUid(1,"tester");
  w.initMainApp();
  await new Promise(r=>setTimeout(r,150));
}
let saveToasts=[];
async function notesProbe(){
  // 1) "+ Note" button must OPEN the form on one click (two toggle listeners would open then close it)
  $("noteForm").classList.remove("show");
  ev($("addNoteBtn"),"click");
  const opens=$("noteForm").classList.contains("show");
  // 2) Ctrl+Enter must save once: one "Note saved", never a stray "Note is empty"
  $("noteTitle").value="ctrl"+Math.random();$("noteBody").value="b";
  toasts.length=0;
  $("noteForm").dispatchEvent(new w.KeyboardEvent("keydown",{key:"Enter",ctrlKey:true,bubbles:true}));
  return{opens,ctrlEnterToasts:[...toasts]};
}
async function saveOneNote(){
  const before=w.eval("notes.length");
  $("noteTitle").value="t"+Math.random();$("noteBody").value="b";
  toasts.length=0;ev($("saveNoteBtn"),"click");
  saveToasts=[...toasts];
  return w.eval("notes.length")-before;
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const E=x=>w.eval(x);
const res=[];const chk=(n,c)=>res.push({check:n,result:c?"PASS":"FAIL"});
w.fetch=u=>{stats.fetch++;return Promise.resolve({ok:true,json:()=>Promise.resolve({current_weather:{weathercode:0,temperature:21.4}})});};
const strip=()=>$("weatherStrip").style.display;
const toggle=on=>{$("toggleWeather").checked=on;ev($("toggleWeather"),"change");};
(async()=>{
  // user #1 has the weather widget OFF
  w.localStorage.setItem("md_showweather_v4_1","false");
  w.setCurrentUid(1,"tester");w.initMainApp();await sleep(100);
  chk("W1 widget off at login → strip hidden",strip()==="none");
  chk("W2 widget off at login → no geolocation / fetch",stats.geo===0&&stats.fetch===0);
  toggle(true);await sleep(60);
  chk("W3 toggled ON later (Settings) → strip shown",strip()==="flex");
  chk("W4 …and weather is actually fetched + displayed",stats.fetch===1&&$("weatherTemp").textContent==="21°C");
  toggle(false);toggle(true);await sleep(40);
  chk("W5 off→on again within 30 min → no re-fetch",stats.geo===1&&stats.fetch===1);
  w.updateWebsiteSetting("showWeather",false);w.updateWebsiteSetting("showWeather",true);await sleep(40);
  chk("W6 same via AI tool → still no re-fetch",stats.geo===1&&stats.fetch===1);
  // loading race + failure + retry
  // (state names differ in the old code, so only run these on the new code)
  if(E("typeof loadWeather")==="function"){
    E("_weather.state='idle'");stats.geoDelay=80;stats.geo=0;
    w.updateWebsiteSetting("showWeather",true);w.updateWebsiteSetting("showWeather",true);toggle(true);
    chk("W7 rapid toggles while loading → ONE request",stats.geo===1);await sleep(150);stats.geoDelay=0;
    E("_weather.state='idle'");stats.geoMode="denied";stats.geo=0;toggle(false);toggle(true);await sleep(40);
    chk("W8 denied → 'Location denied' shown",$("weatherDesc").textContent==="Location denied");
    stats.geoMode="ok";toggle(false);toggle(true);await sleep(60);
    chk("W9 failed load retries on next toggle-on",stats.geo===2&&$("weatherDesc").textContent==="Clear");
  }
  // second account logs in with widget ON after the first left the strip hidden
  w.localStorage.setItem("md_showweather_v4_2","true");
  w.updateWebsiteSetting("showWeather",false);
  w.signOut();w.setCurrentUid(2,"other");w.initMainApp();await sleep(80);
  chk("W10 next account (widget ON) → strip shown (was left hidden)",strip()==="flex");

  // ───────── wallpaper perf ─────────
  const resizeCount=()=>listeners.filter(l=>l.t===w&&l.type==="resize"&&!(l.signal&&l.signal.aborted)).length;
  const base=resizeCount();
  for(const scope of ["full","hero","particle"]){
    E(`wallScope='${scope}'`);
    for(let i=0;i<5;i++)w.startLiveWall("matrix");
    chk(`P1 [${scope}] 5× startLiveWall → ≤1 extra resize listener`,resizeCount()-base<=1);
    w.stopLiveWall();
    chk(`P2 [${scope}] stopLiveWall removes its resize listener`,resizeCount()-base===0);
  }
  E("wallScope='hero'");stats.toDataURL=0;w.startLiveWall("aurora");await sleep(350);
  const heroCanvas=$("heroWallLayer").querySelector("canvas");
  chk("P3 hero live wall → NO toDataURL() per frame",stats.toDataURL===0);
  chk("P4 hero live wall draws into a <canvas> in the hero layer",!!heroCanvas);
  w.stopLiveWall();
  chk("P5 stop → hero canvas removed",$("heroWallLayer").querySelector("canvas")===null);
  E("wallScope='full'");w.startLiveWall("stars");w.applyWallpaper("none");
  chk("P6 choosing a photo stops the live loop",E("_liveWallRaf")===null);

  // preview thumbnails: only while Settings is open
  const frames=()=>[...pendingAll].length;
  w.stopLiveWall();await sleep(60);
  ev($("settingsBtn"),"click");await sleep(250);
  const open1=pendingAll.size;
  w.closePanel("settingsPanel");await sleep(120);
  const closed1=pendingAll.size;
  ev($("settingsBtn"),"click");await sleep(250);
  const open2=pendingAll.size;
  ev($("settingsBtn"),"click");await sleep(250);  // clicking again must not double the loops
  const open3=pendingAll.size;
  w.closePanel("settingsPanel");await sleep(120);
  chk("P7 Settings open → 5 preview loops run",open1>=5&&open1<=6);
  chk("P8 Settings CLOSED → preview loops stopped",closed1===0);
  chk("P9 re-open works, repeated opens don't stack loops",open2===open1&&open3===open1);
  console.table(res);
  console.log(res.every(r=>r.result==="PASS")?"ALL PASS":"SOME FAILED: "+res.filter(r=>r.result==="FAIL").length);
  process.exit(0);
})();
