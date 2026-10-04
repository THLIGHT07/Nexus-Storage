/* ============================================================
   AI-INTENT.JS — Client-side intent & emotion detection
   (regex pattern matching, keyword extraction, app scoring)
   ============================================================ */

/* ── Intent Detection (client-side fast pre-check) ── */
/* ── Intent & Emotion Detection (fully rewritten) ── */
const INTENT_PATTERNS={
  wants_music:     /\b(music|song|songs|playlist|spotify|listen|gaana|gana|gane|sunna|sunne|beat|beats|track|tracks|album|baj|bajao|play.*music|music.*play|sad.*song|happy.*song|lo.?fi|chill.*music)\b/i,
  wants_video:     /\b(video|watch|youtube|movie|movies|show|shows|film|films|reel|reels|shorts|dekh|dekhna|episode|series|stream)\b/i,
  wants_email:     /\b(email|mail|gmail|inbox|compose|send.*mail|check.*mail|mails|emails)\b/i,
  wants_social:    /\b(instagram|whatsapp|social|post|story|stories|reel|dm|message|chat|talk|connect|friends|feed)\b/i,
  wants_ai:        /\b(chatgpt|chat gpt|gpt|gemini|grok|claude|ai|ask ai|ai tool|language model|llm|generate|write.*ai)\b/i,
  wants_code:      /\b(github|code|git|repo|repository|programming|deploy|project|commit|pull request|dev|develop)\b/i,
  wants_drive:     /\b(drive|file|files|document|documents|upload|storage|folder|folders|gdrive|google drive)\b/i,
  wants_research:  /\b(research|notes|notebook|study|read|learn|document|note|notebooklm)\b/i,
};

const EMOTION_TO_INTENT={
  sad:    ["wants_music","wants_video"],      // sad → comfort with music/video
  bored:  ["wants_video","wants_music","wants_social"],  // bored → entertainment
  happy:  ["wants_music","wants_social"],     // happy → share the joy
  stressed:["wants_music","wants_video"],     // stressed → relax
  excited:["wants_social","wants_video"],
};

const EMOTION_PATTERNS={
  sad:      /\b(sad|down|low|depressed|unhappy|upset|dukhi|dil nahi|feel bad|bad mood|lonely|alone|missing|cry|crying|hurt|pain|heartbreak)\b/i,
  happy:    /\b(happy|great|awesome|excited|joy|amazing|loving|khush|fantastic|wonderful|celebrate|good mood|feeling good)\b/i,
  stressed: /\b(stressed|anxious|anxiety|overwhelmed|tired|exhausted|thaka|tension|pressure|worried|worry|nervous|panic|burden)\b/i,
  bored:    /\b(bored|boring|bore|kya karu|nothing to do|bakwas|time pass|timepass|kuch nahi|maan nahi|empty|dull|monoton)\b/i,
  excited:  /\b(excited|thrilled|pumped|hyped|cant wait|amazing news|great news)\b/i,
};

/* Map intent → specific app ids (exact match from DEFAULT_APPS ids) */
const INTENT_TO_APP_IDS={
  wants_music:    ["youtube_music","youtube","spotify"],
  wants_video:    ["youtube","vidbox"],
  wants_email:    ["gmail"],
  wants_social:   ["instagram","whatsapp"],
  wants_ai:       ["chatgpt","gemini","grok","notebook_lm"],
  wants_code:     ["github"],
  wants_drive:    ["google_drive"],
  wants_research: ["notebook_lm","google_drive"],
};

/* Universal keyword extractor */
function extractKeywords(text){
  const stop=/\b(i|me|my|want|to|a|an|the|is|it|in|on|of|for|and|or|please|can|you|hi|hey|bhai|bro|yaar|kar|karo|chahta|chahti|hu|hoon|mujhe|muje|thoda|kuch|abhi|bas|sirf|wala|wali|dekhna|sunna|chalao|open|karo|dedo)\b/gi;
  return text.replace(/[^\w\s]/g,'').replace(stop,'').trim().split(/\s+/).filter(w=>w.length>2);
}

/* Score how well an app matches user message */
function scoreAppMatch(app, text, keywords){
  const tl=text.toLowerCase(), nl=app.name.toLowerCase(), cl=app.cat.toLowerCase(), ul=app.url.toLowerCase();
  let score=0;
  const nameEsc=app.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(new RegExp('\\b'+nameEsc+'\\b','i').test(text)) score+=100;
  else if(tl.includes(nl)) score+=80;
  keywords.forEach(kw=>{
    const kl=kw.toLowerCase();
    if(nl.includes(kl)||kl.includes(nl)) score+=40;
    if(ul.includes(kl)) score+=30;
    if(cl.includes(kl)) score+=20;
    if(nl.startsWith(kl)||kl.startsWith(nl.split(' ')[0])) score+=25;
  });
  return score;
}

function clientDetectIntent(text){
  let intent="none", emotion="neutral", matchedApps=[];

  for(const[key,re] of Object.entries(EMOTION_PATTERNS)){ if(re.test(text)){emotion=key;break;} }
  for(const[key,re] of Object.entries(INTENT_PATTERNS)){  if(re.test(text)){intent=key;break;} }

  if(!getAiConfig().allowApps) return{intent,emotion,matchedApps};

  const matchedIds=new Set();
  const keywords=extractKeywords(text);

  // PASS 1: Intent/category based
  const intentsToMatch=intent!=="none"?[intent]:(EMOTION_TO_INTENT[emotion]||[]);
  const catFallback={wants_music:["Media"],wants_video:["Media"],wants_email:["Communication"],wants_social:["Social","Communication"],wants_ai:["AI Assistant"],wants_code:["Development"],wants_drive:["Storage"],wants_research:["Research"]};
  intentsToMatch.forEach(ik=>{
    if(ik==="none")return;
    (INTENT_TO_APP_IDS[ik]||[]).forEach(id=>{ const f=apps.find(a=>a.id===id); if(f&&!matchedIds.has(f.id)){matchedIds.add(f.id);matchedApps.push(f);} });
    (catFallback[ik]||[]).forEach(cat=>{ apps.forEach(a=>{ if(!matchedIds.has(a.id)&&a.cat===cat){matchedIds.add(a.id);matchedApps.push(a);} }); });
  });

  // PASS 2: Universal name/URL scan — ALWAYS runs, catches ANY manually added app
  if(keywords.length>0){
    apps.filter(a=>!matchedIds.has(a.id))
      .map(a=>({app:a,score:scoreAppMatch(a,text,keywords)}))
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score)
      .forEach(({app})=>{ matchedIds.add(app.id);matchedApps.push(app); });
  }

  // PASS 3: Broad fallback — any keyword appears anywhere in app data
  if(matchedApps.length===0 && keywords.length>0){
    apps.forEach(a=>{ if(matchedIds.has(a.id))return; const c=(a.name+" "+a.url+" "+a.cat).toLowerCase(); if(keywords.some(kw=>c.includes(kw.toLowerCase()))){matchedIds.add(a.id);matchedApps.push(a);} });
  }

  matchedApps=matchedApps.slice(0,5);
  return{intent,emotion,matchedApps};
}
