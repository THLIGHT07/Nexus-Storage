const {JSDOM}=require("jsdom"),fs=require("fs"),path=require("path");
const root=process.argv[2], label=process.argv[3];
const files=["js/utils.js","js/ai/ai-core.js","js/apps.js","js/settings.js","js/notes.js","js/wallpapers.js","js/boot.js","js/main.js"];
// the real index.html isn't in the zip → build a stub DOM containing every id the scripts ask for
const ids=new Set();
for(const f of files){for(const m of fs.readFileSync(path.join(root,f),"utf8").matchAll(/getElementById\(["']([^"']+)["']\)/g))ids.add(m[1]);}
["loginEyeBtn","loginEyeIcon","regEyeBtn","regEyeIcon"].forEach(i=>ids.add(i));
const html="<!doctype html><body>"+[...ids].map(i=>{
  const t=/Canvas$/.test(i)||i==="bgCanvas"?"canvas":(/^(searchInput|noteTitle|aiInput|aiModelUrl|aiApiKey|aiModelName|aiUserName|aiPersonaName|aiCustomInstructions|aiProxyUrl|loginUser|loginPass|regUser|regPass|setUsername|wallUrlInput|fieldName|fieldUrl|fieldIcon|fieldCat|overlaySlider)$/.test(i)?"input":(i==="noteBody"?"textarea":"div"));
  return `<${t} id="${i}"></${t}>`}).join("")+'<div class="recent-bar"></div></body>';
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"http://localhost:8080/"});
const w=dom.window;w.structuredClone=structuredClone;
// ---- instrumentation ----
const liveIntervals=new Set(),pendingRaf=new Set(),listeners=[];
const _si=w.setInterval.bind(w),_ci=w.clearInterval.bind(w);
w.setInterval=(f,t)=>{const id=_si(f,t);liveIntervals.add(id);return id;};
w.clearInterval=id=>{liveIntervals.delete(id);_ci(id);};
const _raf=w.requestAnimationFrame.bind(w),_caf=w.cancelAnimationFrame.bind(w);
w.requestAnimationFrame=cb=>{const id=_raf(ts=>{pendingRaf.delete(id);cb(ts);});if(cb.name==="draw")pendingRaf.add(id);return id;};
w.cancelAnimationFrame=id=>{pendingRaf.delete(id);_caf(id);};
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
(async()=>{
  // First login
  await login(1);
  const r1=report("after login #1");
  const p1=await notesProbe();const added1=await saveOneNote();const t1=saveToasts;
  // search input should fire renderGrid once per keystroke
  let grids=0;const rg=w.renderGrid;w.renderGrid=function(){grids++;return rg.apply(this,arguments);};
  $("searchInput").value="x";ev($("searchInput"),"input");const searchCalls1=grids;
  w.renderGrid=rg;$("searchInput").value="";w.eval("searchQuery=''");
  // Sign out via the real boot.js signOut()
  w.signOut();
  const rOut=report("after signOut #1");
  // Second login (and a third, to be sure)
  await login(2);
  const r2=report("after login #2");
  const p2=await notesProbe();const added2=await saveOneNote();const t2=saveToasts;
  grids=0;w.renderGrid=function(){grids++;return rg.apply(this,arguments);};
  $("searchInput").value="y";ev($("searchInput"),"input");const searchCalls2=grids;w.renderGrid=rg;
  w.signOut();await login(3);
  const p3=await notesProbe();const added3=await saveOneNote();const t3=saveToasts;
  const r3=report("after login #3");
  console.log(`\n=== ${label} ===`);
  console.table(out.map(o=>({...o})));
  console.log("\"+ Note\" opens form on 1 click → login#1:",p1.opens," login#2:",p2.opens," login#3:",p3.opens);
  console.log("Ctrl+Enter toasts → login#1:",JSON.stringify(p1.ctrlEnterToasts)," login#2:",JSON.stringify(p2.ctrlEnterToasts)," login#3:",JSON.stringify(p3.ctrlEnterToasts));
  console.log("notes added per single Save click  → login#1:",added1," login#2:",added2," login#3:",added3);
  console.log("toasts fired by ONE Save click → login#1:",JSON.stringify(t1)," login#2:",JSON.stringify(t2)," login#3:",JSON.stringify(t3));
  console.log("renderGrid calls per search keystroke → login#1:",searchCalls1," login#2:",searchCalls2);
  const ok=p1.opens&&p2.opens&&p3.opens&&p2.ctrlEnterToasts.length===1&&p3.ctrlEnterToasts.length===1&&added1===1&&added2===1&&added3===1&&searchCalls1===searchCalls2&&searchCalls2===1&&r2.liveIntervals===1&&r3.liveIntervals===1&&rOut.liveIntervals===0&&r3.particleLoops===1&&r2.particleLoops===1&&JSON.stringify(t2)===JSON.stringify(t1)&&JSON.stringify(t3)===JSON.stringify(t1)&&t1.length===1;
  console.log(ok?"RESULT: PASS":"RESULT: FAIL");
  process.exit(0);
})();
