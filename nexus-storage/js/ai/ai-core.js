/* ============================================================
   AI-CORE.JS — Main ARIA engine: config/state, system-prompt
   builder, message rendering (markdown/streaming/bubbles),
   thinking indicator, orb/status, the callAI conversation +
   tool-calling loop, send/connect/clear/search handlers,
   audio visualizer, and AI panel init wiring
   ============================================================ */
(window.__nexusParts=window.__nexusParts||{})["ai-core.js"]="2026-10-02-xss1";


/* ═══════════════════════════════════════════════════════════════
   AI ASSISTANT ENGINE
═══════════════════════════════════════════════════════════════ */

/* ── State ── */
const LS_AI="md_ai_v4";
let aiState={}; /* placeholder — loadUserState() in utils.js populates this per user after login */
let aiConnected=false;
let aiConversation=[]; // {role, content}
let aiIsTyping=false;
let aiMicActive=false;
let aiSpeechRecog=null;
let aiVizRaf=null;
let aiVizAnalyser=null;

/* ── Config helpers ── */
function getAiConfig(){
  ensureAiPanelForCurrentUser(); // never read form values that belong to a different account
  /* The config form lives ONLY in Settings → AI Assistant. If a field is on the page its value is
     the truth (so clearing the API key really clears it); if it isn't there, fall back to the saved aiState. */
  const txt=(id,key,def)=>{const el=document.getElementById(id);return el?(el.value.trim()||def):((aiState&&aiState[key])||def);};
  const chk=(id,key)=>{const el=document.getElementById(id);return el?el.checked:(aiState&&typeof aiState[key]==="boolean"?aiState[key]:AI_DEFAULTS[key]);};
  return{
    url: txt("aiModelUrl","url",""),
    key: txt("aiApiKey","key",""),
    model: txt("aiModelName","model","gpt-4o-mini"),
    userName: txt("aiUserName","userName","User"),
    persona: txt("aiPersonaName","persona","ARIA"),
    tone: txt("aiTone","tone","friendly"),
    allowApps: chk("aiAllowApps","allowApps"),
    emotionDetect: chk("aiEmotionDetect","emotionDetect"),
    autoOpen: chk("aiAutoOpen","autoOpen"),
    webSearch: chk("aiWebSearch","webSearch"),
    autoSearch: chk("aiAutoSearch","autoSearch"),
    proxyUrl: txt("aiProxyUrl","proxyUrl","https://corsproxy.io/?"),
    customInstructions: txt("aiCustomInstructions","customInstructions","")
  };
}
function saveAiConfig(){
  const c=getAiConfig();aiState={...aiState,...c};p(LS_AI,aiState);
}
/* ── Per-user AI panel: defaults, reset, and load ──
   The AI form fields live in the DOM, which survives a lock/logout. Without
   an explicit reset, the NEXT account to log in would still see (and even
   save into its own storage) the previous account's API URL / key / model.
   So: resetAiPanel() wipes everything on lock/logout/block, and
   loadAiConfig() always starts from blank defaults and then overlays ONLY
   the logged-in user's own saved aiState. */
const AI_TEXT_FIELDS={aiModelUrl:"url",aiApiKey:"key",aiModelName:"model",aiUserName:"userName",aiPersonaName:"persona",aiCustomInstructions:"customInstructions",aiProxyUrl:"proxyUrl"};
const AI_SELECT_FIELDS={aiTone:"tone"};
const AI_CHECK_FIELDS={aiAllowApps:"allowApps",aiEmotionDetect:"emotionDetect",aiAutoOpen:"autoOpen",aiWebSearch:"webSearch",aiAutoSearch:"autoSearch"};
const AI_DEFAULTS=Object.freeze({url:"",key:"",model:"",userName:"",persona:"",proxyUrl:"",customInstructions:"",tone:"friendly",allowApps:true,emotionDetect:true,autoOpen:false,webSearch:true,autoSearch:true});
const _aiWelcomeNodes=document.getElementById("aiMessages")?[...document.getElementById("aiMessages").childNodes].map(n=>n.cloneNode(true)):[];

/** Sets every AI form control to `values[field]`, falling back to AI_DEFAULTS. */
function fillAiFields(values){
  const v=values||{};
  Object.entries(AI_TEXT_FIELDS).forEach(([id,k])=>{const el=document.getElementById(id);if(el)el.value=(typeof v[k]==="string"?v[k]:AI_DEFAULTS[k]);});
  Object.entries(AI_SELECT_FIELDS).forEach(([id,k])=>{const el=document.getElementById(id);if(el)el.value=(typeof v[k]==="string"&&v[k]?v[k]:AI_DEFAULTS[k]);});
  Object.entries(AI_CHECK_FIELDS).forEach(([id,k])=>{const el=document.getElementById(id);if(el)el.checked=(typeof v[k]==="boolean"?v[k]:AI_DEFAULTS[k]);});
}
/** Reflects "has URL + key saved" on the Connect button and status line. */
function syncAiConnectedUi(){
  const connected=!!(aiState&&aiState.url&&aiState.key);
  aiConnected=connected;
  const btn=document.getElementById("aiConnectBtn");
  if(btn){btn.textContent=connected?"✓ Connected":"Connect";btn.classList.toggle("connected",connected);}
  const badge=document.getElementById("aiBadge");if(badge)badge.style.display="none";
  setAiStatus("idle",connected?"Online · Ready":"Open Settings → AI Assistant to add your API key");
}
/** Loads the CURRENT user's AI config into the panel (blank for a new user). */
function loadAiConfig(){
  fillAiFields(aiState);
  syncAiConnectedUi();
  updateAiNames((aiState&&aiState.persona)||"ARIA");
  const panel=document.getElementById("aiPanel");
  if(panel)panel.dataset.uid=CURRENT_UID==null?"":String(CURRENT_UID); // "this form shows account #N's settings"
}
/** The panel carries a stamp saying whose settings it is showing. If that ever
 * disagrees with who is logged in (browser autofill, form restore, a stale
 * session…), reload it from the logged-in account's own storage — or blank it
 * when nobody is logged in — before anything reads or saves it. */
function ensureAiPanelForCurrentUser(){
  const panel=document.getElementById("aiPanel");
  if(!panel)return;
  const owner=panel.dataset.uid||"",want=CURRENT_UID==null?"":String(CURRENT_UID);
  if(owner===want)return;
  if(CURRENT_UID==null){aiState={};resetAiPanel();}
  else loadAiConfig();
}
/** Blanks the AI panel (form fields, chat, status) and the in-memory chat.
 * Touches NO storage, so the account's saved config is untouched and returns
 * at its next login. It does NOT change aiState — whoever calls it decides
 * (lock/logout clears it; login has just loaded the new user's). */
function resetAiPanel(){
  aiConversation=[];aiIsTyping=false;
  document.getElementById("aiPanel")?.removeAttribute("data-uid");
  fillAiFields(null);
  const msgs=document.getElementById("aiMessages");
  if(msgs&&_aiWelcomeNodes.length)msgs.replaceChildren(..._aiWelcomeNodes.map(n=>n.cloneNode(true)));
  resetContextBar();
  const inp=document.getElementById("aiInput");if(inp){inp.value="";inp.style.height="42px";}
  const send=document.getElementById("aiSendBtn");if(send)send.disabled=false;
  document.getElementById("aiThinking")?.remove();
  document.getElementById("aiPanel")?.classList.remove("open");
  document.getElementById("aiBtn")?.classList.remove("active");
  syncAiConnectedUi();
  updateAiNames("ARIA");
}
function updateAiNames(name){
  const n=name||"ARIA";
  const dn=document.getElementById("aiDisplayName");
  const wn=document.getElementById("aiWelcomeName");
  const inp=document.getElementById("aiInput");
  if(dn)dn.textContent=n;
  if(wn)wn.textContent=n;
  if(inp)inp.placeholder=`Message ${n}… (Enter to send)`;
  // If elements not found yet (panel not rendered), retry once
  if(!dn||!wn){
    setTimeout(()=>{
      const dn2=document.getElementById("aiDisplayName");
      const wn2=document.getElementById("aiWelcomeName");
      if(dn2)dn2.textContent=n;
      if(wn2)wn2.textContent=n;
    },800);
  }
}

/* ── System Prompt Builder ── */
function buildSystemPrompt(webContext){
  const c=getAiConfig();
  const appList=apps.map(a=>`- ${a.name} (${a.cat}): ${a.url}`).join("\n");
  const toneMap={
    friendly:"Be warm, friendly, and supportive.",
    professional:"Be professional, precise, and formal.",
    casual:"Be casual, relaxed, and conversational.",
    witty:"Be witty, clever, and occasionally humorous.",
    concise:"Be extremely concise. Short answers only."
  };
  const webSection=webContext?`\nWEB SEARCH RESULTS (real-time data — use these to give accurate, current answers):\n${webContext}\nIMPORTANT: Summarise key facts from the search results above. Be accurate and cite what you found.\n`:"";
  return `You are ${c.persona}, a highly advanced AI assistant embedded in "${document.querySelector(".topbar-brand")?.textContent||"NEXUS STORAGE"}" — a personal web dashboard.

USER CONTEXT:
- The user's name is: ${c.userName}
- Current time: ${new Date().toLocaleString()}

PERSONA & TONE:
- Your name is ${c.persona}
- ${toneMap[c.tone]||toneMap.friendly}
${webSection}
${c.allowApps?`VAULT (User's App Collection - you have access to these):\n${appList}\n\nWhen the user expresses intent related to any of these apps, suggest them. Format as JSON: [APPS:{"suggestions":[{"id":"app_id","reason":"why"}]}]`:""}

${c.emotionDetect?`EMOTION & INTENT DETECTION:\nAnalyze every message for:\n1. EMOTION: (happy/sad/stressed/excited/neutral/bored/anxious)\n2. INTENT: (wants_music/wants_video/wants_chat/wants_help/wants_email/wants_social/wants_info/wants_ai/none)\n3. ACTION: (suggest_app/open_link/give_info/none)\nAlways include at the end: [META:{"emotion":"neutral","intent":"none","action":"none"}]`:""}

${c.customInstructions?`CUSTOM INSTRUCTIONS:\n${c.customInstructions}`:""}

TOOLS:
You have tool access to actually perform actions in this app: adding/editing apps in the vault, suggesting app deletion, saving notes, and changing AI or website settings. Use these tools whenever the user clearly asks for one of these actions (e.g. "add Netflix to my vault", "save a note about X", "change your name to Jarvis", "switch to dark theme"). Never claim you did something unless you actually called the matching tool. Deletion always goes through suggest_delete_app — you cannot delete directly.

IMPORTANT: Never say you are GPT or made by OpenAI. You are ${c.persona}. Be helpful and contextual.`;
}

/* ── Context Tag Renderer ── */
/* META comes from the model, so treat it as hostile: only short plain words are accepted,
   and they are rendered as text — never as HTML. */
const _CTX_WORD=/^[a-z][a-z_ ]{0,31}$/i;
function cleanMeta(m){
  const o={};
  if(m&&typeof m==="object"){
    for(const k of ["emotion","intent","action"]){
      if(typeof m[k]==="string"&&_CTX_WORD.test(m[k].trim()))o[k]=m[k].trim().toLowerCase();
    }
  }
  return o;
}
function resetContextBar(){
  const bar=document.getElementById("aiContextBar");
  if(bar)bar.replaceChildren(h("span",{style:"font-size:10px;color:var(--text3);font-family:JetBrains Mono,monospace;letter-spacing:.06em;"},"Context tags appear here as you chat"));
}
function renderContextTags(rawMeta){
  const bar=document.getElementById("aiContextBar");
  bar.replaceChildren();
  const meta=cleanMeta(rawMeta);
  if(!meta.intent&&!meta.emotion)return;
  if(meta.emotion&&meta.emotion!=="neutral"){
    const emojiMap={sad:"😔",happy:"😊",stressed:"😰",bored:"😑",excited:"🤩"};
    const emoji=Object.prototype.hasOwnProperty.call(emojiMap,meta.emotion)?emojiMap[meta.emotion]:"💭";
    bar.appendChild(h("span",{class:"ctx-tag emotion"},`${emoji} ${meta.emotion}`));
  }
  if(meta.intent&&meta.intent!=="none")bar.appendChild(h("span",{class:"ctx-tag intent"},`🎯 ${meta.intent.replace(/_/g," ")}`));
  if(meta.action&&meta.action!=="none")bar.appendChild(h("span",{class:"ctx-tag action"},`⚡ ${meta.action.replace(/_/g," ")}`));
}

/* ── App Suggestion Renderer ── */
function renderAppSuggestions(suggestedApps,container){
  if(!suggestedApps||suggestedApps.length===0)return;
  const wrap=h("div",{class:"ai-suggestions"},h("div",{class:"ai-suggest-label"},"✦ Apps from your vault:"));
  const chips=h("div",{class:"ai-suggest-chips"});
  suggestedApps.forEach(app=>{
    const pal=appPalette(app);
    const chip=h("div",{class:"ai-suggest-chip"},
      h("div",{class:"ai-suggest-chip-icon",style:{background:pal.bg+"33"}},h("i",{class:"ti ti-"+safeIconName(app.icon),style:{color:pal.c}})),
      h("div",{class:"ai-suggest-chip-info"},h("div",{class:"ai-suggest-chip-name"},app.name),h("div",{class:"ai-suggest-chip-cat"},app.url)),
      h("i",{class:"ti ti-external-link",style:{fontSize:"12px",color:"var(--text3)",marginLeft:"auto",flexShrink:"0"}}));
    chip.style.cursor="pointer";
    chip.addEventListener("click",e=>{
      e.stopPropagation();
      openSafe(app.url);
      addToRecent(app);
      toast(`Opening ${app.name}…`,"ti-external-link");
    });
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);
  if(suggestedApps.length>1&&getAiConfig().autoOpen){
    const openAll=h("button",{class:"ai-open-all"},`Open all ${suggestedApps.length} apps`);
    openAll.onclick=()=>{suggestedApps.forEach(a=>openSafe(a.url));toast(`Opened ${suggestedApps.length} apps`,"ti-external-link");};
    wrap.appendChild(openAll);
  }
  container.appendChild(wrap);
}

/* ── Message Renderer ── */
/* ── Markdown renderer with code blocks + copy button ── */
/* Markdown → DocumentFragment of REAL NODES (no HTML string is ever built or parsed).
   • model/user text only ever becomes text nodes, so "<img onerror=…>" is shown literally
   • links are accepted only if safeUrl() says http(s); href is set as a property (can't break out of
     an attribute) with target=_blank + rel=noopener noreferrer nofollow
   • supported: **bold**, *italic*, `code`, [text](https://…), #/##/### headings, - / * / 1. lists, ``` code blocks */
const _MD_INLINE_SRC="`([^`\\n]+)`|\\[([^\\]\\n]+)\\]\\(((?:[^\\s()]|\\([^\\s()]*\\))+)\\)|\\*\\*(.+?)\\*\\*|\\*(.+?)\\*";
function mdInline(text,parent,allowLinks=true){
  const re=new RegExp(_MD_INLINE_SRC,"g");
  let last=0,m;
  while((m=re.exec(text))!==null){
    if(m.index>last)parent.appendChild(document.createTextNode(text.slice(last,m.index)));
    if(m[1]!==undefined){
      parent.appendChild(h("code",{class:"inline-code"},m[1]));
    }else if(m[2]!==undefined){
      const url=allowLinks?safeUrl(m[3]):"";
      if(url){
        const a=h("a",{class:"md-link",href:url,target:"_blank",rel:"noopener noreferrer nofollow"});
        mdInline(m[2],a,false); // no links inside links
        parent.appendChild(a);
      }else{
        parent.appendChild(document.createTextNode(m[0])); // not a safe link → show it as plain text
      }
    }else if(m[4]!==undefined){
      const el=h("strong");mdInline(m[4],el,allowLinks);parent.appendChild(el);
    }else{
      const el=h("em");mdInline(m[5],el,allowLinks);parent.appendChild(el);
    }
    last=re.lastIndex;
  }
  if(last<text.length)parent.appendChild(document.createTextNode(text.slice(last)));
}
function renderMarkdown(rawText){
  const clean=String(rawText==null?"":rawText).replace(/\[META:\{.*?\}\]/gs,"").replace(/\[APPS:\{.*?\}\]/gs,"").trim();
  const frag=document.createDocumentFragment();
  let inCode=false,codeLang="",codeLines=[];
  function flushCode(){
    const pre=h("pre",null,h("code",null,codeLines.join("\n")));
    const copyBtn=h("button",{class:"code-copy-btn",type:"button"},h("i",{class:"ti ti-copy"})," Copy");
    copyBtn.addEventListener("click",()=>copyCodeText(pre.textContent));
    frag.appendChild(h("div",{class:"code-block"},
      h("div",{class:"code-header"},codeLang?h("span",{class:"code-lang"},codeLang):null,copyBtn),
      pre));
    codeLines=[];codeLang="";
  }
  clean.split("\n").forEach(line=>{
    if(line.startsWith("```")){
      if(!inCode){inCode=true;codeLang=line.slice(3).trim();}
      else{inCode=false;flushCode();}
      return;
    }
    if(inCode){codeLines.push(line);return;}
    let m;
    if(/^### /.test(line)){const el=h("h4",{class:"md-h4"});mdInline(line.slice(4),el);frag.appendChild(el);}
    else if(/^## /.test(line)){const el=h("h3",{class:"md-h3"});mdInline(line.slice(3),el);frag.appendChild(el);}
    else if(/^# /.test(line)){const el=h("h2",{class:"md-h2"});mdInline(line.slice(2),el);frag.appendChild(el);}
    else if(/^[*\-] /.test(line)){
      const body=h("span");mdInline(line.slice(2),body);
      frag.appendChild(h("div",{class:"md-li"},h("span",{class:"md-li-dot"},"•"),body));
    }
    else if((m=/^(\d+)\. (.*)$/.exec(line))){
      const body=h("span");mdInline(m[2],body);
      frag.appendChild(h("div",{class:"md-li"},h("span",{class:"md-li-num"},m[1]+"."),body));
    }
    else if(line.trim()==="")frag.appendChild(h("div",{class:"md-br"}));
    else{const sp=h("span");mdInline(line,sp);frag.appendChild(sp);frag.appendChild(h("br"));}
  });
  if(inCode)flushCode();
  return frag;
}

function copyCodeText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(()=>toast("✓ Code copied!","ti-check")).catch(()=>fallbackCopy(t));
  }else{fallbackCopy(t);}
}
function fallbackCopy(text){
  const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand("copy");toast("✓ Code copied!","ti-check");}catch(e){toast("Copy failed — select manually","ti-alert-circle");}
  document.body.removeChild(ta);
}

/* ── Streaming typewriter ── */
function streamText(bubble,fullText,onDone){
  bubble.replaceChildren();bubble.classList.add("streaming");
  const msgs=document.getElementById("aiMessages");
  // Render once into real nodes, then "type" their text. Blocks that haven't been reached yet stay out of the DOM,
  // so the bubble grows as it types — and no half-written markup is ever parsed.
  const plan=[];let total=0;
  [...renderMarkdown(fullText).childNodes].forEach(block=>{
    const texts=[];
    const tw=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
    let n;while((n=tw.nextNode())){texts.push({node:n,full:n.nodeValue});n.nodeValue="";}
    const len=texts.reduce((a,t)=>a+t.full.length,0);
    plan.push({block,texts,len,before:total});
    total+=len;
  });
  const cursor=h("span",{class:"stream-cursor"},"▋");
  const chunkSize=Math.max(3,Math.floor(total/90));
  let shown=0;
  function paint(){
    for(const b of plan){
      if(b.before>shown)break;
      if(b.block.parentNode!==bubble)bubble.appendChild(b.block);
      let left=shown-b.before;
      for(const t of b.texts){const take=Math.max(0,Math.min(left,t.full.length));t.node.nodeValue=t.full.slice(0,take);left-=take;}
    }
    bubble.appendChild(cursor); // (re)append → always last
  }
  function step(){
    if(shown>=total){
      plan.forEach(b=>{if(b.block.parentNode!==bubble)bubble.appendChild(b.block);b.texts.forEach(t=>{t.node.nodeValue=t.full;});});
      cursor.remove();
      bubble.classList.remove("streaming");
      if(onDone)onDone();
      msgs.scrollTop=99999;
      return;
    }
    shown=Math.min(shown+chunkSize,total);
    paint();
    msgs.scrollTop=99999;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function addAiMessage(role,text,meta,suggestedApps){
  role=role==="ai"?"ai":"user";
  const msgs=document.getElementById("aiMessages");
  const wrap=h("div",{class:"ai-msg "+role});
  const avatar=h("div",{class:"ai-msg-avatar"},h("i",{class:"ti "+(role==="ai"?"ti-brain":"ti-user"),style:{fontSize:"13px"}}));
  const body=document.createElement("div");
  const bubble=h("div",{class:"ai-msg-bubble"});
  const now=new Date();
  const timeEl=h("div",{class:"ai-msg-time"},`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);

  if(role==="ai"){
    body.appendChild(bubble);
    // suggestionsSlot: placeholder div BETWEEN bubble and timeEl
    const suggestionsSlot=document.createElement("div");
    body.appendChild(suggestionsSlot);
    body.appendChild(timeEl);
    wrap.appendChild(avatar);wrap.appendChild(body);
    msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;
    if(meta)renderContextTags(meta);
    // Start streaming — when done, inject suggestion chips into slot
    streamText(bubble,text,()=>{
      if(suggestedApps&&suggestedApps.length>0){
        renderAppSuggestions(suggestedApps,suggestionsSlot);
        msgs.scrollTop=msgs.scrollHeight;
      }
    });
  }else{
    bubble.appendChild(renderMarkdown(text));
    body.appendChild(bubble);body.appendChild(timeEl);
    wrap.appendChild(body);wrap.appendChild(avatar);
    msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;
  }
  return{wrap,bubble,timeEl};
}

/* ── Thinking indicator ── */
function showThinking(){
  const msgs=document.getElementById("aiMessages");
  const el=h("div",{class:"ai-msg ai",id:"aiThinking"},
    h("div",{class:"ai-msg-avatar"},h("i",{class:"ti ti-brain",style:{fontSize:"13px",animation:"orbPulse .7s infinite"}})),
    h("div",{class:"ai-thinking"},h("span"),h("span"),h("span")));
  msgs.appendChild(el);msgs.scrollTop=msgs.scrollHeight;
  setAiOrb("thinking");setAiStatus("thinking","Thinking…");
}
function hideThinking(){
  document.getElementById("aiThinking")?.remove();
  setAiOrb("idle");setAiStatus("idle","Online · Ready");
}

/* ── Orb / Status ── */
function setAiOrb(state){
  const orb=document.getElementById("aiOrb");
  orb.className="ai-orb";
  if(state==="thinking")orb.classList.add("thinking");
  if(state==="listening")orb.classList.add("listening");
}
function setAiStatus(state,text){
  const el=document.getElementById("aiStatus");
  el.textContent=text;el.className="ai-status";
  if(state==="thinking")el.classList.add("thinking");
  if(state==="listening")el.classList.add("listening");
}

async function callAI(userMessage, forceSearch){
  const c=getAiConfig();
  if(!c.url||!c.key){
    addAiSetupPrompt();return;
  }
  saveAiConfig();

  // Client-side fast intent detection
  const clientMeta=clientDetectIntent(userMessage);
  if(clientMeta.emotion!=="neutral"||clientMeta.intent!=="none"){
    renderContextTags({...clientMeta,action:clientMeta.matchedApps.length>0?"suggest_app":"none"});
  }

  // ── WEB SEARCH (DuckDuckGo) ──
  let searchResults=null;
  let webContext="";
  const shouldSearch=forceSearch||(c.autoSearch&&needsWebSearch(userMessage));
  if(shouldSearch&&c.webSearch){
    setAiStatus("thinking","🔍 Searching web…");
    setAiOrb("thinking");
    const query=extractSearchQuery(userMessage);
    try{
      searchResults=await fetchDDGSearch(query);
      webContext=buildWebContext(searchResults,query);
      const ctxBar=document.getElementById("aiContextBar");
      ctxBar.replaceChildren();
      const stag=document.createElement("span");stag.className="ctx-tag action";
      stag.textContent=`🔍 Searched: "${query.slice(0,30)}${query.length>30?"…":""}"`;
      ctxBar.appendChild(stag);
    }catch(e){
      console.warn("[Search]",e);
    }
  }

  const systemPrompt=buildSystemPrompt(webContext);
  aiConversation.push({role:"user",content:userMessage});
  showThinking();aiIsTyping=true;setAiSendDisabled(true);

  try{
    let baseUrl=c.url.trim().replace(/\/$/,"");
    const endpoint=baseUrl.endsWith("/chat/completions")?baseUrl:baseUrl+"/chat/completions";

    // Tool-calling loop: keep calling the API while the model requests tool calls,
    // executing each tool (with user confirmation for non-destructive actions),
    // feeding results back, until it returns a normal text reply.
    let finalRaw=null;
    let toolRoundsLeft=5; // safety cap to avoid infinite loops
    let messagesForApi=[{role:"system",content:systemPrompt},...aiConversation];

    // Lightweight container for tool-confirmation cards while we loop (not a streamed bubble)
    const msgsEl=document.getElementById("aiMessages");
    const toolUiContainer=document.createElement("div");
    toolUiContainer.className="ai-tool-ui-container";
    msgsEl.appendChild(toolUiContainer);
    msgsEl.scrollTop=msgsEl.scrollHeight;

    while(toolRoundsLeft-->0){
      const payload={
        model:c.model||"gpt-4o-mini",
        messages:messagesForApi,
        tools:AI_TOOLS,
        tool_choice:"auto",
        max_tokens:1200,
        temperature:0.75
      };
      let res;
      try{
        res=await fetch(endpoint,{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":`Bearer ${c.key}`},
          body:JSON.stringify(payload)
        });
      }catch(networkErr){
        throw new Error(`Network error: ${networkErr.message}. Check your API URL and ensure CORS is enabled.`);
      }
      if(!res.ok){
        let errMsg=`HTTP ${res.status}`;
        try{const errBody=await res.json();errMsg=errBody?.error?.message||errMsg;}catch(e){}
        // If the API doesn't support tools at all, retry once without tools as a fallback
        if(/tool/i.test(errMsg)&&payload.tools){
          delete payload.tools;delete payload.tool_choice;
          res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${c.key}`},body:JSON.stringify(payload)});
          if(!res.ok)throw new Error(errMsg);
        }else{
          throw new Error(errMsg);
        }
      }

      const data=await res.json();
      const choice=data?.choices?.[0];
      const msg=choice?.message;
      const toolCalls=msg?.tool_calls;

      if(toolCalls&&toolCalls.length>0){
        messagesForApi.push(msg); // assistant's tool_call request
        for(const tc of toolCalls){
          let args={};
          try{args=JSON.parse(tc.function.arguments||"{}");}catch(e){}
          const result=await executeAiTool(tc.function.name,args,toolUiContainer);
          messagesForApi.push({role:"tool",tool_call_id:tc.id,content:JSON.stringify(result)});
        }
        continue; // loop again so the model can respond to the tool results
      }

      finalRaw=msg?.content||data?.message?.content||data?.response||"(No response received)";
      break;
    }
    if(finalRaw===null)finalRaw="⚠️ Tool calling loop limit reached. Please try a simpler request.";

    const raw=finalRaw;

    let meta={...clientMeta};
    const metaMatch=raw.match(/\[META:\{(.*?)\}\]/s);
    if(metaMatch){try{const parsed=JSON.parse("{"+metaMatch[1]+"}");meta={...meta,...cleanMeta(parsed)};}catch(e){}}

    let appsFromAI=[...clientMeta.matchedApps];
    const appsMatch=raw.match(/\[APPS:\{(.*?)\}\]/s);
    if(appsMatch){
      try{
        const parsed=JSON.parse("{"+appsMatch[1]+"}");
        const ids=(parsed.suggestions||[]).map(s=>s.id);
        const matched=apps.filter(a=>ids.includes(a.id));
        if(matched.length>0)appsFromAI=matched;
      }catch(e){}
    }

    aiConversation.push({role:"assistant",content:raw});
    hideThinking();
    if(!toolUiContainer.hasChildNodes())toolUiContainer.remove();
    const msgResult=addAiMessage("ai",raw,meta,appsFromAI);

    // Search results: append after streaming finishes (use MutationObserver on streaming class removal)
    if(searchResults&&msgResult&&msgResult.bubble){
      const bubble=msgResult.bubble;
      const body=bubble.parentElement;
      function appendSearchWhenReady(){
        if(!bubble.classList.contains("streaming")){
          if(body)renderSearchResults(searchResults,body);
        }else{
          const obs=new MutationObserver(()=>{
            if(!bubble.classList.contains("streaming")){
              obs.disconnect();
              if(body)renderSearchResults(searchResults,body);
              document.getElementById("aiMessages").scrollTop=99999;
            }
          });
          obs.observe(bubble,{attributes:true,attributeFilter:["class"]});
        }
      }
      appendSearchWhenReady();
    }

    pulseViz();
    if(getAiConfig().autoOpen&&appsFromAI.length===1){
      setTimeout(()=>{openSafe(appsFromAI[0].url);addToRecent(appsFromAI[0]);},700);
    }

  }catch(err){
    aiConversation.pop();
    hideThinking();
    document.getElementById("aiThinking")?.remove();
    document.querySelectorAll(".ai-tool-ui-container").forEach(el=>{if(!el.hasChildNodes())el.remove();});
    const errText=`⚠️ **Error:** ${err.message}\n\n**Troubleshooting:**\n- Check your API URL\n- Verify your API key\n- Some APIs block browser requests due to CORS`;
    addAiMessage("ai",errText);
    console.error("[AI Error]",err);
  }finally{
    aiIsTyping=false;setAiSendDisabled(false);
    setAiStatus("idle","Online · Ready");
  }
}

/* ── Send handler ── */
function sendAiMessage(){
  // Ensure panel fully inited (loads saved API config)
  if(!window._aiFullInited){
    window._aiFullInited=true;
    try{initAiPanel();}catch(e){console.warn(e);}
  }
  const inp=document.getElementById("aiInput");
  const text=inp.value.trim();
  if(!text||aiIsTyping)return;
  addAiMessage("user",text);
  inp.value="";inp.style.height="42px";
  callAI(text);
}

/* ── AI panel is CHAT ONLY: configuration lives in Settings → AI Assistant ── */
/** Opens the main Settings panel on its AI Assistant tab (and closes the chat panel). */
function openAiSettings(){
  document.getElementById("aiPanel")?.classList.remove("open");
  document.getElementById("aiBtn")?.classList.remove("active");
  const open=document.getElementById("settingsPanel");
  if(open&&!open.classList.contains("open"))document.getElementById("settingsBtn")?.click();
  if(typeof openSettingsTab==="function")openSettingsTab("ai");
}
/** The one message shown when no API is configured. */
function addAiSetupPrompt(){
  const m=addAiMessage("ai","⚠️ Open **Settings → AI Assistant** to add your API key.");
  const btn=h("button",{type:"button",class:"ai-setup-btn"},h("i",{class:"ti ti-settings"})," Open AI Settings");
  btn.addEventListener("click",openAiSettings);
  m.bubble.after(btn); // sits under the bubble (streamText only rewrites the bubble itself)
}
/** Deletes what is left of the OLD config UI inside #aiPanel once Settings has taken over its fields:
 *  the header `.ai-config-row`s, the whole `#aiRestrictions` Behavior Settings block and the bottom
 *  "⚙️ Settings" hint button (its inline onclick toggled #aiRestrictions). Never removes anything that
 *  still contains a chat control; if it would, that element is only hidden and a warning is logged. */
function removeLegacyAiConfigUi(){
  const panel=document.getElementById("aiPanel");if(!panel)return 0;
  const KEEP=["aiMessages","aiInput","aiSendBtn","aiMicBtn","aiPanelClose","aiVizCanvas","aiOrb","aiContextBar","aiDisplayName","aiStatus","aiBadge"];
  const keepEls=KEEP.map(id=>document.getElementById(id)).filter(Boolean);
  const buttonText=el=>(el.textContent||"").replace(/[\u2699\uFE0F\s]/g,"").toLowerCase();
  const targets=new Set([...panel.querySelectorAll(".ai-config-row"),document.getElementById("aiRestrictions")].filter(Boolean));
  panel.querySelectorAll("button,a,span,div,[onclick],[role=button]").forEach(el=>{ // the bottom "⚙️ Settings" hint
    const oc=el.getAttribute("onclick")||"";
    if(/aiRestrictions/.test(oc)||(el.children.length<=1&&buttonText(el)==="settings"&&!/aiSearchNow|aiClearChat/.test(oc)))targets.add(el);
  });
  let removed=0;
  targets.forEach(el=>{
    if(!el.isConnected)return;
    if(keepEls.some(k=>el.contains(k))){el.style.setProperty("display","none","important");console.warn("[ai] legacy config element still contains a chat control — hidden, not removed",el);return;}
    el.remove();removed++;
  });
  return removed;
}

/* ── Global onclick handlers (no listener dependency) ── */
function aiConnectNow(){
  if(!window._aiFullInited){window._aiFullInited=true;try{initAiPanel();}catch(e){}}
  ensureAiPanelForCurrentUser();
  const url  =document.getElementById("aiModelUrl")?.value.trim()||"";
  const key  =document.getElementById("aiApiKey")?.value.trim()||"";
  const model=document.getElementById("aiModelName")?.value.trim()||"gpt-4o-mini";
  const persona=document.getElementById("aiPersonaName")?.value.trim()||"ARIA";
  const userName=document.getElementById("aiUserName")?.value.trim()||"User";
  const tone=document.getElementById("aiTone")?.value||"friendly";
  const proxyUrl=document.getElementById("aiProxyUrl")?.value.trim()||"https://corsproxy.io/?";
  const customInstructions=document.getElementById("aiCustomInstructions")?.value.trim()||"";
  if(!url||!key){toast("Enter API URL and Key first","ti-alert-circle");return;}
  // Save everything to aiState + localStorage
  aiState={...aiState,url,key,model,persona,userName,tone,proxyUrl,customInstructions};
  p(LS_AI,aiState);
  aiConnected=true;
  const btn=document.getElementById("aiConnectBtn");
  if(btn){btn.textContent="✓ Connected";btn.classList.add("connected");}
  setAiStatus("idle","Online · Ready");
  updateAiNames(persona);
  toast(`${persona} connected! ✦`,"ti-brain",true);
  const badge=document.getElementById("aiBadge");
  if(badge)badge.style.display="block";
}

function aiClearChat(){
  aiConversation=[];
  const msgs=document.getElementById("aiMessages");
  if(!msgs)return;
  msgs.replaceChildren();
  const c=getAiConfig();
  const name=c.persona||"ARIA";
  addAiMessage("ai",`Chat cleared! I'm ${name}, ready to help.`);
  resetContextBar();
  toast("Chat cleared","ti-trash");
}

function aiSearchNow(){
  if(!window._aiFullInited){window._aiFullInited=true;try{initAiPanel();}catch(e){}}
  const inp=document.getElementById("aiInput");
  let text=inp?.value.trim();
  if(!text){
    text=prompt("What do you want to search?");
    if(!text)return;
    if(inp)inp.value=text;
  }
  addAiMessage("user",text);
  if(inp){inp.value="";inp.style.height="42px";}
  callAI(text,true);
}

function setAiSendDisabled(v){
  document.getElementById("aiSendBtn").disabled=v;
}

function initAiVisualizer(){
  const canvas=document.getElementById("aiVizCanvas");
  const ctx=canvas.getContext("2d");
  let W,H,phase=0;
  function resize(){W=canvas.width=canvas.offsetWidth;H=canvas.height=canvas.offsetHeight;}
  resize();window.addEventListener("resize",resize);
  let amplitude=0.15,targetAmp=0.15;
  function frame(){
    amplitude+=(targetAmp-amplitude)*.08;
    ctx.clearRect(0,0,W,H);
    const bars=48;const bw=W/bars;
    for(let i=0;i<bars;i++){
      const norm=i/bars;
      const h=(Math.sin(norm*Math.PI*4+phase)*0.5+0.5)*amplitude*H*0.85+2;
      const x=i*bw+bw*.15;const bw2=bw*.7;
      const grad=ctx.createLinearGradient(0,H,0,H-h);
      grad.addColorStop(0,"rgba(124,111,255,0.8)");grad.addColorStop(1,"rgba(168,156,255,0.2)");
      ctx.fillStyle=grad;
      ctx.beginPath();ctx.roundRect(x,H-h,bw2,h,2);ctx.fill();
    }
    phase+=0.04+amplitude*.3;
    aiVizRaf=requestAnimationFrame(frame);
  }
  frame();
  // expose amplitude setter
  window._aiVizSetAmp=amp=>{targetAmp=Math.max(.1,Math.min(1,amp));};
}

function pulseViz(){
  if(!window._aiVizSetAmp)return;
  window._aiVizSetAmp(0.9);setTimeout(()=>window._aiVizSetAmp(0.15),600);
}

/* ── Auto-resize textarea ── */
function autoResizeAiInput(){
  const t=document.getElementById("aiInput");
  t.style.height="42px";t.style.height=Math.min(t.scrollHeight,120)+"px";
}

function initAiPanel(){
  loadAiConfig();
  try{initVoice();}catch(e){console.warn("initVoice error:",e);}
  try{initAiVisualizer();}catch(e){console.warn("initAiVisualizer error:",e);}

  // Persona name live update
  const pnEl=document.getElementById("aiPersonaName");
  if(pnEl)pnEl.addEventListener("input",e=>{updateAiNames(e.target.value);});

  // Close button
  const panelCloseBtn=document.getElementById("aiPanelClose");
  if(panelCloseBtn) panelCloseBtn.addEventListener("click",()=>{
    const panel=document.getElementById("aiPanel");
    const btn=document.getElementById("aiBtn");
    if(panel)panel.classList.remove("open");
    if(btn)btn.classList.remove("active");
  });
  // Stop non-link clicks bubbling (keeps panel open)
  const panelEl=document.getElementById("aiPanel");
  if(panelEl) panelEl.addEventListener("click",e=>{
    if(!e.target.closest("a"))e.stopPropagation();
  });

  // Update welcome time
  const now=new Date();
  const timeEl=document.getElementById("aiWelcomeTime");
  if(timeEl)timeEl.textContent=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}
