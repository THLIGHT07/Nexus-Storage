/* ============================================================
   APPS.JS — App management: recent apps, stats, ticker,
   favourites, filters, sort & view mode, grid rendering & tiles,
   drag & drop reorder, 3-dot menu, search system, add/edit/
   delete modal + AI-callable data functions
   ============================================================ */

/* ═══════════════════════════════════════════════════
   RECENT APPS
═══════════════════════════════════════════════════ */
function addToRecent(app){
  recent=recent.filter(id=>id!==app.id);
  recent.unshift(app.id);
  recent=recent.slice(0,8);
  p(LS.RECENT,recent);
  renderRecent();
}
function renderRecent(){
  const bar=document.querySelector(".recent-bar");
  if(bar)bar.style.display=showRecent?"block":"none";
  const chips=document.getElementById("recentChips");
  if(!chips)return;
  chips.replaceChildren();
  if(recent.length===0){chips.appendChild(h("span",{class:"recent-empty"},"No recent apps"));return;}
  recent.forEach((id,i)=>{
    const app=apps.find(a=>a.id===id);if(!app)return;
    const pal=appPalette(app);
    const chip=h("a",{class:"recent-chip",href:app.url,target:"_blank",rel:"noopener noreferrer"},
      h("div",{class:"recent-chip-icon",style:{background:pal.bg+"44"}},h("i",{class:"ti ti-"+safeIconName(app.icon),style:{color:pal.c}})),
      h("span",{class:"recent-chip-name"},app.name));
    chip.style.animationDelay=`${i*0.05}s`;
    chip.addEventListener("click",()=>addToRecent(app));
    chips.appendChild(chip);
  });
}

/* ═══════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════ */
function updateStats(){
  const cats=new Set(apps.map(a=>a.cat));
  const ai=apps.filter(a=>a.cat==="AI Assistant").length;
  document.getElementById("stat-apps").textContent=apps.length;
  document.getElementById("stat-cats").textContent=cats.size;
  document.getElementById("stat-ai").textContent=ai;
  document.getElementById("stat-favs").textContent=favs.size;
  document.getElementById("stat-notes").textContent=notes.length;
}

/* ═══════════════════════════════════════════════════
   TICKER
═══════════════════════════════════════════════════ */
function renderTicker(){
  const names=apps.map(a=>a.name);
  const frag=document.createDocumentFragment();
  [...names,...names].forEach(n=>frag.appendChild(h("span",null,"◆ "+n))); // text node — app names are never parsed as HTML
  document.getElementById("tick").replaceChildren(frag);
}

/* ═══════════════════════════════════════════════════
   FAVOURITES
═══════════════════════════════════════════════════ */
function toggleFav(id,btn){
  if(favs.has(id)){favs.delete(id);toast("Removed from favourites","ti-star");}
  else{favs.add(id);toast("Added to favourites ★","ti-star-filled",true);}
  if(btn){btn.classList.add("pop");setTimeout(()=>btn.classList.remove("pop"),400);}
  p(LS.FAVS,[...favs]);renderFavs();renderGrid();updateStats();
}
function removeFav(id){favs.delete(id);p(LS.FAVS,[...favs]);renderFavs();renderGrid();updateStats();toast("Removed from favourites","ti-star");}
function renderFavs(){
  const sec=document.getElementById("favsSection"),strip=document.getElementById("favsStrip");
  if(favs.size===0){sec.classList.remove("visible");return;}
  sec.classList.add("visible");strip.replaceChildren();
  apps.filter(a=>favs.has(a.id)).forEach(app=>{
    const pal=appPalette(app);
    const rm=h("button",{class:"fav-chip-remove",title:"Remove"},h("i",{class:"ti ti-x"}));
    const chip=h("div",{class:"fav-chip"},
      h("div",{class:"fav-chip-icon",style:{background:pal.bg+"44"}},h("i",{class:"ti ti-"+safeIconName(app.icon),style:{color:pal.c,fontSize:"12px"}})),
      h("span",{class:"fav-chip-name"},app.name),
      rm);
    chip.addEventListener("click",e=>{if(e.target.closest(".fav-chip-remove")){e.stopPropagation();removeFav(app.id);return;}openSafe(app.url);});
    rm.addEventListener("click",e=>{e.stopPropagation();removeFav(app.id);});
    strip.appendChild(chip);
  });
}
document.getElementById("favsClearBtn").addEventListener("click",()=>{favs.clear();p(LS.FAVS,[]);renderFavs();renderGrid();updateStats();toast("All favourites cleared","ti-star");});

/* ═══════════════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════════════ */
function renderFilters(){
  const fr=document.getElementById("filters");
  const cats=["All",...new Set(apps.map(a=>a.cat))];
  if(favs.size>0)cats.splice(1,0,"★ Favourites");
  fr.innerHTML="";
  cats.forEach(cat=>{
    const btn=document.createElement("button");
    btn.className="pill"+(cat===activeFilter?" active":"");btn.textContent=cat;
    btn.onclick=()=>{activeFilter=cat;renderFilters();renderGrid();};
    fr.appendChild(btn);
  });
}

/* ═══════════════════════════════════════════════════
   SORT & VIEW
═══════════════════════════════════════════════════ */
function updateSortBtn(){
  const lbls={"default":"Default","az":"A–Z","za":"Z–A"};
  document.getElementById("sortBtn").replaceChildren(h("i",{class:"ti ti-arrows-sort"})," "+(lbls[sortMode]||lbls["default"]));
}
function cycleSort(){
  const modes=["default","az","za"];
  sortMode=modes[(modes.indexOf(sortMode)+1)%modes.length];
  p(LS.SORT,sortMode);
  updateSortBtn();
  renderGrid();
}
function getSorted(list){
  if(sortMode==="az")return[...list].sort((a,b)=>a.name.localeCompare(b.name));
  if(sortMode==="za")return[...list].sort((a,b)=>b.name.localeCompare(a.name));
  return list;
}
document.getElementById("viewGrid").addEventListener("click",()=>{viewMode="grid";p(LS.VIEW,"grid");updateViewBtns();renderGrid();});
document.getElementById("viewList").addEventListener("click",()=>{viewMode="list";p(LS.VIEW,"list");updateViewBtns();renderGrid();});
function updateViewBtns(){document.getElementById("viewGrid").classList.toggle("active",viewMode==="grid");document.getElementById("viewList").classList.toggle("active",viewMode==="list");}
document.getElementById("sortBtn").addEventListener("click",cycleSort);

/* ═══════════════════════════════════════════════════
   GRID
═══════════════════════════════════════════════════ */
function getFiltered(){
  let list=apps;
  if(activeFilter==="★ Favourites")list=apps.filter(a=>favs.has(a.id));
  else if(activeFilter!=="All")list=apps.filter(a=>a.cat===activeFilter);
  if(searchQuery){const q=searchQuery.toLowerCase();list=list.filter(a=>a.name.toLowerCase().includes(q)||a.cat.toLowerCase().includes(q)||a.url.toLowerCase().includes(q));}
  return getSorted(list);
}
function renderGrid(){
  const g=document.getElementById("grid");
  g.className="app-grid"+(viewMode==="list"?" list-view":"");
  g.replaceChildren();
  const list=getFiltered();
  const title=searchQuery?`Results for "${searchQuery}"`:"All systems"; // textContent below — never HTML
  if(list.length===0){
    g.appendChild(h("div",{class:"no-results"},h("i",{class:"ti ti-search no-results-icon"}),h("h3",null,"No apps found"),h("p",null,"Try a different search or filter")));
    addPlusTile(g);
    document.getElementById("appsTitle").textContent=title;
    return;
  }
  list.forEach((app,i)=>{const tile=buildTile(app,i);g.appendChild(tile);requestAnimationFrame(()=>requestAnimationFrame(()=>{tile.style.opacity="1";tile.style.transform="translateY(0) scale(1)";}));});
  addPlusTile(g);
  document.getElementById("appsTitle").textContent=title;
}
function buildTile(app,i){
  const pal=appPalette(app);
  const isFav=favs.has(app.id);
  const menuBtn=h("button",{class:"tile-menu-btn","aria-label":"Options"},h("i",{class:"ti ti-dots-vertical"}));
  const editBtn=h("button",{"data-action":"edit"},h("i",{class:"ti ti-pencil"})," Edit App");
  const favBtnDd=h("button",{"data-action":"fav",class:"fav-btn-dd"},h("i",{class:"ti ti-"+(isFav?"star-off":"star")}),isFav?" Unfavourite":" Favourite");
  const delBtn=h("button",{"data-action":"delete",class:"danger"},h("i",{class:"ti ti-trash"})," Delete App");
  const link=h("a",{class:"tile-link",href:app.url,target:"_blank",rel:"noopener noreferrer"},
    h("div",{class:"tile-icon-wrap",style:{background:pal.bg+"33"}},h("i",{class:"ti ti-"+safeIconName(app.icon),style:{color:pal.c,fontSize:"22px"},"aria-hidden":"true"})),
    h("div",{class:"tile-info"},h("span",{class:"tile-name"},app.name),h("span",{class:"tile-cat"},app.cat)));
  const fb=h("button",{class:"tile-fav-btn"+(isFav?" starred":""),"aria-label":isFav?"Unfavourite":"Favourite"},h("i",{class:"ti "+(isFav?"ti-star-filled":"ti-star")}));
  const tile=h("div",{class:"app-tile"+(isFav?" fav-tile":""),dataset:{id:app.id}},
    h("span",{class:"cat-dot",style:{background:catColorFor(app.cat)}}),
    h("span",{class:"drag-handle",title:"Drag to reorder"},h("i",{class:"ti ti-grip-vertical"})),
    menuBtn,
    h("div",{class:"tile-dropdown",id:"menu-"+app.id},editBtn,favBtnDd,h("div",{class:"sep"}),delBtn),
    link,
    fb);
  tile.draggable=true;
  tile.style.cssText=`opacity:0;transform:translateY(10px) scale(.97);transition:opacity .28s ${i*0.038}s,transform .28s ${i*0.038}s,border-color .22s,background .22s;`;
  menuBtn.addEventListener("click",e=>{e.stopPropagation();toggleMenu(app.id);});
  editBtn.addEventListener("click",e=>{e.stopPropagation();openEdit(app.id);});
  delBtn.addEventListener("click",e=>{e.stopPropagation();openDelete(app.id);});
  favBtnDd.addEventListener("click",e=>{e.stopPropagation();closeAllMenus();toggleFav(app.id);});
  fb.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();toggleFav(app.id,fb);});
  link.addEventListener("click",()=>{addToRecent(app);});
  return tile;
}
function addPlusTile(g){
  const add=h("div",{class:"add-tile",role:"button",tabindex:"0","aria-label":"Add new app"},
    h("div",{class:"add-tile-icon"},h("i",{class:"ti ti-plus"})),
    h("span",{class:"add-tile-label"},"Add App"));
  add.addEventListener("click",openAdd);add.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAdd();}});
  g.appendChild(add);
}

/* ═══════════════════════════════════════════════════
   DRAG & DROP
═══════════════════════════════════════════════════ */
let _dndAbort=null; // init guard: non-null while the grid drag & drop listeners are attached
function initDnd(){
  if(_dndAbort)return; // already wired for this login session
  _dndAbort=new AbortController();
  const opt={signal:_dndAbort.signal};
  const g=document.getElementById("grid");
  g.addEventListener("dragstart",e=>{
    const tile=e.target.closest(".app-tile");if(!tile)return;
    dragSrcId=tile.dataset.id;tile.classList.add("dragging");
    e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",dragSrcId);
  },opt);
  g.addEventListener("dragend",e=>{
    const tile=e.target.closest(".app-tile");if(tile)tile.classList.remove("dragging");
    g.querySelectorAll(".drag-over").forEach(t=>t.classList.remove("drag-over"));
  },opt);
  g.addEventListener("dragover",e=>{
    e.preventDefault();e.dataTransfer.dropEffect="move";
    const tile=e.target.closest(".app-tile");
    g.querySelectorAll(".drag-over").forEach(t=>t.classList.remove("drag-over"));
    if(tile&&tile.dataset.id&&tile.dataset.id!==dragSrcId)tile.classList.add("drag-over");
  },opt);
  g.addEventListener("drop",e=>{
    e.preventDefault();
    const tile=e.target.closest(".app-tile");if(!tile||!tile.dataset.id||tile.dataset.id===dragSrcId)return;
    const srcIdx=apps.findIndex(a=>a.id===dragSrcId);
    const tgtIdx=apps.findIndex(a=>a.id===tile.dataset.id);
    if(srcIdx<0||tgtIdx<0)return;
    const [moved]=apps.splice(srcIdx,1);apps.splice(tgtIdx,0,moved);
    p(LS.APPS,apps);renderGrid();toast("App reordered","ti-arrows-sort");
  },opt);
}
function teardownDnd(){
  if(_dndAbort){_dndAbort.abort();_dndAbort=null;}
}

/* ═══════════════════════════════════════════════════
   3-DOT MENU
═══════════════════════════════════════════════════ */
function toggleMenu(id){
  if(openMenuId&&openMenuId!==id){const p=document.getElementById("menu-"+openMenuId);if(p)p.classList.remove("open");}
  const m=document.getElementById("menu-"+id);if(!m)return;
  m.classList.toggle("open");openMenuId=m.classList.contains("open")?id:null;
}
document.addEventListener("click",()=>{if(openMenuId){const m=document.getElementById("menu-"+openMenuId);if(m)m.classList.remove("open");openMenuId=null;}});
function closeAllMenus(){if(openMenuId){const m=document.getElementById("menu-"+openMenuId);if(m)m.classList.remove("open");openMenuId=null;}}

/* ═══════════════════════════════════════════════════
   ULTRA SEARCH SYSTEM
═══════════════════════════════════════════════════ */
const LS_SEARCH_HIST="md_searchhist_v4";
let searchHistory=[]; /* placeholder — loadUserState() in utils.js populates this per user after login */

function addSearchHistory(q){
  if(!q||q.length<2)return;
  searchHistory=searchHistory.filter(h=>h!==q);
  searchHistory.unshift(q);searchHistory=searchHistory.slice(0,8);
  p(LS_SEARCH_HIST,searchHistory);
}
function clearSearchHistory(){searchHistory=[];rm(LS_SEARCH_HIST);}

/* Fuzzy-ish scoring: exact > starts-with > contains > cat > url */
function scoreApp(app,q){
  if(!q)return 0;
  const ql=q.toLowerCase(),name=app.name.toLowerCase(),cat=app.cat.toLowerCase(),url=app.url.toLowerCase();
  if(name===ql)return 100;
  if(name.startsWith(ql))return 80;
  if(name.includes(ql))return 60;
  if(cat.startsWith(ql))return 40;
  if(cat.includes(ql))return 30;
  if(url.includes(ql))return 10;
  // fuzzy: all chars of q appear in order in name
  let qi=0;for(const ch of name){if(ch===ql[qi])qi++;if(qi===ql.length)return 5;}
  return 0;
}
function searchApps(q){
  return apps.map(a=>({app:a,score:scoreApp(a,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.app);
}

let _searchAbort=null; // init guard: non-null while the search box + Ctrl/Cmd+K / Esc listeners are attached
function initSearch(){
  if(_searchAbort)return; // already wired for this login session
  _searchAbort=new AbortController();
  const opt={signal:_searchAbort.signal};
  const inp=document.getElementById("searchInput"),dd=document.getElementById("searchDropdown"),clr=document.getElementById("searchClear");
  inp.addEventListener("input",()=>{
    searchQuery=inp.value.trim();
    clr.classList.toggle("visible",searchQuery.length>0);
    renderSd();renderGrid();
  },opt);
  inp.addEventListener("focus",()=>renderSd(),opt);
  inp.addEventListener("blur",()=>setTimeout(closeSd,180),opt);
  clr.addEventListener("click",()=>{inp.value="";searchQuery="";clr.classList.remove("visible");closeSd();renderGrid();inp.focus();},opt);
  inp.addEventListener("keydown",e=>{
    const items=[...dd.querySelectorAll(".sd-item")];
    if(e.key==="ArrowDown"){e.preventDefault();sdIdx=Math.min(sdIdx+1,items.length-1);items.forEach((it,i)=>it.classList.toggle("sd-active",i===sdIdx));}
    else if(e.key==="ArrowUp"){e.preventDefault();sdIdx=Math.max(sdIdx-1,0);items.forEach((it,i)=>it.classList.toggle("sd-active",i===sdIdx));}
    else if(e.key==="Enter"){
      if(sdIdx>=0&&items[sdIdx]){items[sdIdx].click();}
      else if(searchQuery){addSearchHistory(searchQuery);closeSd();}
    }
    else if(e.key==="Escape"){inp.blur();}
  },opt);
  document.addEventListener("keydown",e=>{
    const isMac=navigator.platform.toUpperCase().includes("MAC");
    if((isMac?e.metaKey:e.ctrlKey)&&e.key==="k"){e.preventDefault();inp.focus();inp.select();}
    if(e.key==="Escape"){
      closeModal();closeDeleteModal();closeAllMenus();
      // Also close AI panel
      const ap=document.getElementById("aiPanel");
      const ab=document.getElementById("aiBtn");
      if(ap&&ap.classList.contains("open")){ap.classList.remove("open");if(ab)ab.classList.remove("active");}
    }
  },opt);
}
function teardownSearch(){
  if(_searchAbort){_searchAbort.abort();_searchAbort=null;}
}

function renderSd(){
  sdIdx=-1;const dd=document.getElementById("searchDropdown");
  dd.innerHTML="";
  const q=searchQuery;

  if(!q){
    // Show: history + favourites + all apps header
    const favApps=apps.filter(a=>favs.has(a.id)).slice(0,4);
    if(searchHistory.length>0){
      const hdr=mkSdLabel("🕐 Recent Searches");
      const clearBtn=document.createElement("button");
      clearBtn.style.cssText="font-size:10px;color:var(--text3);background:none;border:none;cursor:pointer;margin-left:auto;font-family:JetBrains Mono,monospace;";
      clearBtn.textContent="clear";clearBtn.onclick=e=>{e.stopPropagation();clearSearchHistory();renderSd();};
      hdr.appendChild(clearBtn);dd.appendChild(hdr);
      searchHistory.slice(0,5).forEach(hist=>{
        const item=document.createElement("div");item.className="sd-item sd-hist";
        item.append(
          h("span",{style:"font-size:14px;width:32px;text-align:center;flex-shrink:0;"},"🔍"),
          h("div",{class:"sd-info"},h("div",{class:"sd-name"},hist)),
          h("span",{class:"sd-hist-del",title:"Remove",style:"font-size:11px;color:var(--text3);margin-left:auto;cursor:pointer;"},"✕"));
        item.querySelector(".sd-hist-del").addEventListener("click",e=>{e.stopPropagation();searchHistory=searchHistory.filter(h=>h!==hist);p(LS_SEARCH_HIST,searchHistory);renderSd();});
        item.addEventListener("click",e=>{if(e.target.classList.contains("sd-hist-del"))return;const inp=document.getElementById("searchInput");inp.value=hist;searchQuery=hist;document.getElementById("searchClear").classList.add("visible");renderSd();renderGrid();});
        dd.appendChild(item);
      });
    }
    if(favApps.length>0){
      if(searchHistory.length>0){const div=document.createElement("div");div.className="sd-divider";dd.appendChild(div);}
      dd.appendChild(mkSdLabel("★ Pinned"));
      favApps.forEach(app=>dd.appendChild(buildSdItem(app,"")));
    }
    if(searchHistory.length===0&&favApps.length===0){
      const tip=document.createElement("div");tip.className="sd-empty";
      tip.append(
        h("i",{class:"ti ti-search",style:"display:block;font-size:22px;margin-bottom:8px;"}),
        "Type to search apps",h("br"),
        h("span",{style:"font-size:10px;color:var(--text3);"},"⌘K to focus · ↑↓ to navigate · Enter to open"));
      dd.appendChild(tip);
    }
    // Quick category shortcuts
    const cats=[...new Set(apps.map(a=>a.cat))].slice(0,5);
    if(cats.length>0){
      const div=document.createElement("div");div.className="sd-divider";dd.appendChild(div);
      dd.appendChild(mkSdLabel("Quick Filter"));
      const row=document.createElement("div");row.style.cssText="display:flex;gap:5px;flex-wrap:wrap;padding:4px 8px 6px;";
      cats.forEach(cat=>{
        const btn=document.createElement("button");
        btn.style.cssText="padding:3px 10px;border-radius:20px;font-size:10px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-family:Syne,sans-serif;transition:all .15s;";
        btn.textContent=cat;
        btn.onmouseenter=()=>{btn.style.borderColor="var(--accent)";btn.style.color="var(--accent2)";};
        btn.onmouseleave=()=>{btn.style.borderColor="";btn.style.color="";};
        btn.onclick=e=>{e.stopPropagation();activeFilter=cat;renderFilters();renderGrid();closeSd();document.getElementById("searchInput").blur();toast(`Filtered: ${cat}`,"ti-filter");};
        row.appendChild(btn);
      });
      dd.appendChild(row);
    }
    dd.classList.add("open");return;
  }

  // Search results
  const results=searchApps(q);
  if(results.length===0){
    dd.appendChild(h("div",{class:"sd-empty"},
      h("i",{class:"ti ti-search",style:"display:block;font-size:22px;margin-bottom:8px;"}),
      'No results for "',h("strong",{style:"color:var(--text)"},q),'"',h("br"),
      h("span",{style:"font-size:10px;color:var(--text3);"},"Try a different keyword")));
    dd.classList.add("open");return;
  }
  const favM=results.filter(a=>favs.has(a.id)),restM=results.filter(a=>!favs.has(a.id));
  const total=document.createElement("div");total.className="sd-section-label";
  total.append(`${results.length} result${results.length!==1?"s":""} `,h("span",{style:"margin-left:4px;color:var(--accent2);"},`for "${q}"`));
  dd.appendChild(total);
  if(favM.length>0){dd.appendChild(mkSdLabel("★ Favourites first"));favM.forEach(a=>dd.appendChild(buildSdItem(a,q)));if(restM.length>0){const d=document.createElement("div");d.className="sd-divider";dd.appendChild(d);dd.appendChild(mkSdLabel("Other results"));}}
  restM.forEach(a=>dd.appendChild(buildSdItem(a,q)));
  dd.classList.add("open");
}

function mkSdLabel(text){
  const el=document.createElement("div");el.className="sd-section-label";
  el.style.display="flex";el.style.alignItems="center";el.style.justifyContent="space-between";
  const span=document.createElement("span");span.textContent=text;el.appendChild(span);return el;
}

function buildSdItem(app,q){
  const pal=appPalette(app);
  const score=q?scoreApp(app,q):0;
  const a=h("a",{class:"sd-item",href:app.url,target:"_blank",rel:"noopener noreferrer"},
    h("div",{class:"sd-icon",style:{background:pal.bg+"33"}},h("i",{class:"ti ti-"+safeIconName(app.icon),style:{color:pal.c,fontSize:"15px"}})),
    h("div",{class:"sd-info"},h("div",{class:"sd-name"},highlightText(app.name,q)),h("div",{class:"sd-cat"},app.cat)),
    favs.has(app.id)?h("span",{class:"sd-fav-badge"},"★"):null,
    score>=80?h("span",{style:"font-size:9px;background:rgba(124,111,255,.2);color:var(--accent2);padding:1px 5px;border-radius:10px;margin-left:auto;flex-shrink:0;"},"Best"):null);
  a.addEventListener("click",()=>{addSearchHistory(q||app.name);addToRecent(app);});
  return a;
}
function closeSd(){const dd=document.getElementById("searchDropdown");dd.classList.remove("open");dd.innerHTML="";sdIdx=-1;}

/* ═══════════════════════════════════════════════════
   MODAL ADD/EDIT
═══════════════════════════════════════════════════ */
function openAdd(){editingId=null;document.getElementById("modalEyebrow").textContent="ADD APPLICATION";document.getElementById("modalTitle").textContent="New Web App";document.getElementById("modalSaveBtn").textContent="Add App";clearForm();openModal();}
function openEdit(id){closeAllMenus();const app=apps.find(a=>a.id===id);if(!app)return;editingId=id;document.getElementById("modalEyebrow").textContent="EDIT APPLICATION";document.getElementById("modalTitle").textContent="Modify App";document.getElementById("modalSaveBtn").textContent="Save Changes";document.getElementById("fieldName").value=app.name;document.getElementById("fieldUrl").value=app.url;document.getElementById("fieldIcon").value=(app.icon||"").replace(/^ti-/,"");document.getElementById("fieldCat").value=app.cat||"";openModal();}
function clearForm(){["fieldName","fieldUrl","fieldIcon","fieldCat"].forEach(id=>{const el=document.getElementById(id);el.value="";el.style.borderColor="";el.style.boxShadow="";});}
function openModal(){document.getElementById("appModal").classList.add("open");setTimeout(()=>document.getElementById("fieldName").focus(),260);}
function closeModal(){document.getElementById("appModal").classList.remove("open");editingId=null;}
function saveApp(){
  const name=document.getElementById("fieldName").value.trim(),url=safeUrl(document.getElementById("fieldUrl").value);
  const icon=document.getElementById("fieldIcon").value.trim().replace(/^ti-/,"")||"globe",cat=document.getElementById("fieldCat").value.trim()||"Other";
  let valid=true;if(!name){sf("fieldName");valid=false;}if(!url){sf("fieldUrl");valid=false;}if(!valid)return;
  const res=editingId?editAppData(editingId,{name,url,icon,cat}):addAppData({name,url,icon,cat});
  if(res&&res.ok===false){toast(res.error||"Couldn't save that app","ti-alert-circle");return;}
  closeModal();
}
/* Pure data-driven add/edit, reusable by AI tool calls (no DOM form needed) */
function addAppData({name,url,icon,cat}={}){
  const app=sanitizeApp({name,url,icon,cat}); // validates name + http(s) URL, clamps lengths, whitelists the icon, derives colours, mints a fresh id
  if(!app)return{ok:false,error:"Invalid name or URL (must start with http:// or https://)"};
  apps.push(app);p(LS.APPS,apps);renderAll();toast(`"${app.name}" added ✦`,"ti-check");
  return{ok:true,app};
}
function editAppData(id,changes){
  const idx=apps.findIndex(a=>a.id===id);
  if(idx===-1)return{ok:false,error:"App not found"};
  const c=(changes&&typeof changes==="object")?changes:{};
  const pick=(k)=>(typeof c[k]==="string"&&c[k].trim())?c[k]:apps[idx][k];
  // Whitelist: only name / url / icon / cat can change. id, colours, … can never be set from outside (e.g. by an AI tool call).
  const next=sanitizeApp({name:pick("name"),url:pick("url"),icon:pick("icon"),cat:pick("cat"),id:apps[idx].id});
  if(!next)return{ok:false,error:"Invalid name or URL (must start with http:// or https://)"};
  apps[idx]=next;
  p(LS.APPS,apps);renderAll();toast(`"${next.name}" updated ✦`,"ti-check");
  return{ok:true,app:next};
}
function findAppByName(name){
  if(!name)return null;
  const q=name.toLowerCase().trim();
  return apps.find(a=>a.name.toLowerCase()===q)||apps.find(a=>a.name.toLowerCase().includes(q))||null;
}
function sf(id){const el=document.getElementById(id);el.style.borderColor="var(--red)";el.style.boxShadow="0 0 0 3px rgba(255,77,106,.18)";el.focus();setTimeout(()=>{el.style.borderColor="";el.style.boxShadow="";},900);}

/* DELETE */
function openDelete(id){closeAllMenus();deletingId=id;const app=apps.find(a=>a.id===id);document.getElementById("deleteAppName").textContent=app?app.name:"this app";document.getElementById("deleteModal").classList.add("open");}
function closeDeleteModal(){document.getElementById("deleteModal").classList.remove("open");deletingId=null;}
function confirmDelete(){if(!deletingId)return;if(favs.has(deletingId)){favs.delete(deletingId);p(LS.FAVS,[...favs]);}apps=apps.filter(a=>a.id!==deletingId);p(LS.APPS,apps);closeDeleteModal();renderAll();toast("App removed","ti-trash");}

/* ── renderAll: re-renders every dashboard section, then wires up
   the AI panel button once (see wireAiPanelButton in main.js) ── */
function renderAll(){updateStats();renderTicker();renderFavs();renderFilters();renderGrid();renderRecent();wireAiPanelButton();}
