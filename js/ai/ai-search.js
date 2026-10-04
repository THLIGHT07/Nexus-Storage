/* ============================================================
   AI-SEARCH.JS — DuckDuckGo web search integration: trigger
   detection, query extraction, fetch, web-context builder,
   and search-result card rendering
   ============================================================ */

const SEARCH_TRIGGERS=/\b(latest|recent|news|today|2024|2025|2026|current|now|update|price|score|weather|who is|what is|when did|how to|tell me about|search|find|look up|aaj ka|kya hua|abhi|naya|taaza|batao|khabar|abhi ka|aaj)\b/i;

function needsWebSearch(text){
  const c=getAiConfig();
  if(!c.webSearch)return false;
  return SEARCH_TRIGGERS.test(text);
}

function extractSearchQuery(text){
  // Clean up the message into a good search query
  return text
    .replace(/^(hey|hi|hello|bhai|bro|yaar|please|plz|can you|could you|tell me|show me|find me|search for|look up|what is|who is|kya he|kya hai|batao|bata do|mujhe batao)/gi,"")
    .replace(/\?+$/,"")
    .trim()
    .slice(0,120);
}

async function fetchDDGSearch(query){
  const c=getAiConfig();
  // Strategy 1: DDG Instant Answer API (no-cors via proxy)
  const proxyBase=(c.proxyUrl||"https://corsproxy.io/?").replace(/\/?$/,"");
  const ddgUrl=`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1&t=nexus-storage`;
  const proxiedUrl=`${proxyBase}${encodeURIComponent(ddgUrl)}`;

  const results={
    abstract:"",abstractUrl:"",abstractTitle:"",
    answer:"",answerType:"",
    relatedTopics:[],
    infobox:null,
    query,
    source:"DuckDuckGo"
  };

  try{
    const res=await fetch(proxiedUrl,{headers:{"Accept":"application/json"}});
    if(!res.ok)throw new Error(`DDG HTTP ${res.status}`);
    const data=await res.json();

    results.abstract=data.Abstract||"";
    results.abstractUrl=data.AbstractURL||"";
    results.abstractTitle=data.AbstractSource||data.Heading||"";
    results.answer=data.Answer||"";
    results.answerType=data.AnswerType||"";

    if(data.RelatedTopics){
      results.relatedTopics=data.RelatedTopics
        .filter(t=>t.Text&&t.FirstURL)
        .slice(0,5)
        .map(t=>({
          title:t.Text.split(" - ")[0]||t.Text.slice(0,80),
          snippet:t.Text,
          url:t.FirstURL,
          icon:t.Icon?.URL||""
        }));
    }

    if(data.Infobox){
      results.infobox=data.Infobox;
    }

    return results;
  }catch(e){
    console.warn("[DDG Search error]",e.message);
    // Strategy 2: Fallback — return query as Wikipedia URL suggestion
    results.abstract="";
    results.fallback=true;
    results.fallbackUrl=`https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g,"_"))}`;
    return results;
  }
}

function buildWebContext(results,query){
  let ctx=`Search query: "${query}"\n\n`;
  if(results.answer) ctx+=`Quick Answer: ${results.answer}\n\n`;
  if(results.abstract){
    ctx+=`Summary (${results.abstractTitle||"Web"}): ${results.abstract}\n`;
    if(results.abstractUrl)ctx+=`Source: ${results.abstractUrl}\n\n`;
  }
  if(results.relatedTopics.length>0){
    ctx+=`Related Results:\n`;
    results.relatedTopics.forEach((t,i)=>{
      ctx+=`${i+1}. ${t.title} — ${t.url}\n`;
    });
  }
  if(!results.abstract&&!results.answer&&results.relatedTopics.length===0){
    ctx+=`No direct results found for "${query}". Answer from your knowledge.`;
  }
  return ctx;
}

function renderSearchResults(results,container){
  if(!results)return;
  // Everything in `results` comes from a third-party API (reached through a public CORS proxy) — treat it as hostile:
  // text → text nodes only, URLs → safeUrl() (http/https only) before they are shown or opened.
  const str=v=>typeof v==="string"?v:"";
  const wrap=h("div",{class:"ai-search-results"});
  wrap.appendChild(h("div",{class:"ai-search-header"},h("i",{class:"ti ti-search","aria-hidden":"true"}),h("span",null,"Web results"),h("span",{class:"ai-search-badge"},"DuckDuckGo")));

  const abstract=str(results.abstract);
  if(abstract){
    const wiki=h("div",{class:"ai-wiki-card"},
      h("div",{class:"ai-wiki-card-top"},h("span",{class:"ai-wiki-icon"},"🌐"),h("span",{class:"ai-wiki-title"},str(results.abstractTitle)||"Result"),h("span",{class:"ai-wiki-badge"},"INSTANT")),
      h("div",{class:"ai-wiki-body"},abstract.slice(0,320)+(abstract.length>320?"…":"")));
    const abstractUrl=safeUrl(str(results.abstractUrl));
    if(abstractUrl){
      const readBtn=h("button",{class:"ai-wiki-read"},h("i",{class:"ti ti-external-link","aria-hidden":"true"})," Read full article");
      readBtn.addEventListener("click",e=>{e.stopPropagation();openSafe(abstractUrl);});
      wiki.appendChild(readBtn);
    }
    wrap.appendChild(wiki);
  }

  const answer=str(results.answer);
  if(answer){
    const ans=h("div",{style:"background:rgba(61,255,176,.06);border:1px solid rgba(61,255,176,.15);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--green);margin-bottom:4px;display:flex;align-items:center;gap:7px;"},
      h("i",{class:"ti ti-bolt",style:"font-size:14px;","aria-hidden":"true"}),
      h("strong",{style:"color:var(--text);"},answer));
    wrap.appendChild(ans);
  }

  (Array.isArray(results.relatedTopics)?results.relatedTopics:[]).slice(0,4).forEach(topic=>{
    const url=safeUrl(str(topic&&topic.url));
    if(!url)return; // unsafe / malformed link → skip the whole card
    const snippet=str(topic.snippet);
    const domain=new URL(url).hostname.replace("www.","");
    const favicon=h("img",{class:"ai-src-favicon",alt:""});
    favicon.src=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`;
    favicon.addEventListener("error",()=>{favicon.style.display="none";});
    const card=h("div",{class:"ai-src-card"},
      h("div",{class:"ai-src-card-top"},favicon,h("span",{class:"ai-src-title"},str(topic.title)),h("i",{class:"ti ti-external-link ai-src-open","aria-hidden":"true"})),
      h("div",{class:"ai-src-snippet"},snippet.slice(0,140)+(snippet.length>140?"…":"")),
      h("div",{class:"ai-src-url"},url));
    card.addEventListener("click",e=>{e.stopPropagation();openSafe(url);});
    wrap.appendChild(card);
  });

  const fbUrl=safeUrl(str(results.fallbackUrl));
  if(results.fallback&&fbUrl){
    const fb=h("div",{class:"ai-src-card"},
      h("div",{class:"ai-src-card-top"},h("span",{class:"ai-src-title"},`🔍 Search "${str(results.query)}" on Wikipedia`),h("i",{class:"ti ti-external-link ai-src-open","aria-hidden":"true"})),
      h("div",{class:"ai-src-url"},fbUrl));
    fb.addEventListener("click",e=>{e.stopPropagation();openSafe(fbUrl);});
    wrap.appendChild(fb);
  }

  container.appendChild(wrap);
}
