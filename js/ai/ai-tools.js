/* ============================================================
   AI-TOOLS.JS — Tool-calling definitions (add_app, edit_app,
   suggest_delete_app, save_note, update_ai_setting,
   update_website_setting) + allow/deny confirmation cards
   ============================================================ */

/* ════════════════════════════════════════════════════
   AI TOOL CALLING — let the AI add apps, notes, settings
════════════════════════════════════════════════════ */
const AI_TOOLS=[
  {
    type:"function",
    function:{
      name:"add_app",
      description:"Add a new website/app to the user's vault. Use this whenever the user asks to add, save, or create a shortcut for a website.",
      parameters:{
        type:"object",
        properties:{
          name:{type:"string",description:"Display name of the app/website, e.g. 'Netflix'"},
          url:{type:"string",description:"Full URL including https://, e.g. 'https://netflix.com'"},
          cat:{type:"string",description:"A short category label, e.g. 'Entertainment', 'Productivity', 'Social'. Pick a sensible one yourself if the user doesn't specify."},
          icon:{type:"string",description:"Optional tabler-icons name (without 'ti-' prefix) that fits the site, e.g. 'movie' for Netflix. If unsure, omit and 'globe' will be used."}
        },
        required:["name","url"]
      }
    }
  },
  {
    type:"function",
    function:{
      name:"edit_app",
      description:"Edit an existing app in the user's vault (change its name, URL, category, or icon). Use the appName to identify which app, you do not need its internal id.",
      parameters:{
        type:"object",
        properties:{
          appName:{type:"string",description:"The current name (or close match) of the app to edit"},
          name:{type:"string",description:"New name, only if changing"},
          url:{type:"string",description:"New URL, only if changing"},
          cat:{type:"string",description:"New category, only if changing"},
          icon:{type:"string",description:"New icon name, only if changing"}
        },
        required:["appName"]
      }
    }
  },
  {
    type:"function",
    function:{
      name:"suggest_delete_app",
      description:"Use this when the user wants to remove/delete an app from their vault. This does NOT delete it directly — it only shows the user a confirmation card, because deletion is irreversible and must be manually confirmed by the user.",
      parameters:{
        type:"object",
        properties:{
          appName:{type:"string",description:"The name (or close match) of the app the user wants to delete"}
        },
        required:["appName"]
      }
    }
  },
  {
    type:"function",
    function:{
      name:"save_note",
      description:"Create and save a note for the user. Use this whenever the user asks you to write down, remember, or save something as a note.",
      parameters:{
        type:"object",
        properties:{
          title:{type:"string",description:"A short title for the note. Generate a sensible one if the user doesn't give one."},
          body:{type:"string",description:"The note content/body."}
        },
        required:["body"]
      }
    }
  },
  {
    type:"function",
    function:{
      name:"update_ai_setting",
      description:"Change one of the AI assistant's own settings — its persona name, tone, the user's display name, or behavior toggles.",
      parameters:{
        type:"object",
        properties:{
          setting:{type:"string",enum:["persona","tone","userName","autoSearch","webSearch","emotionDetect","allowApps","autoOpen","customInstructions"],description:"Which AI setting to change"},
          value:{type:"string",description:"The new value. For tone use one of: friendly, professional, casual, witty, concise. For boolean toggles use 'true' or 'false'."}
        },
        required:["setting","value"]
      }
    }
  },
  {
    type:"function",
    function:{
      name:"update_website_setting",
      description:"Change one of the website's own visual/behavior settings — theme, clock format, showing/hiding widgets, wallpaper overlay darkness.",
      parameters:{
        type:"object",
        properties:{
          setting:{type:"string",enum:["theme","clockFormat","clockSeconds","showRecent","showWeather","showParticles","overlay"],description:"Which website setting to change"},
          value:{type:"string",description:"The new value, e.g. theme name, '12h'/'24h', 'true'/'false', or a 0-100 number for overlay."}
        },
        required:["setting","value"]
      }
    }
  }
];

/* Render a small inline "Allow?" confirmation card for a pending non-destructive AI action.
   Returns a Promise that resolves true/false based on the user's click. */
function renderAllowCard(container,label,detail){
  return new Promise(resolve=>{
    const status=h("span"); // verdict goes here as TEXT (was insertAdjacentHTML)
    const yes=h("button",{class:"ai-allow-yes",style:"flex:1;padding:6px 10px;border:none;border-radius:7px;background:var(--accent2);color:#fff;font-size:12px;font-weight:600;cursor:pointer;"},"Allow");
    const no=h("button",{class:"ai-allow-no",style:"flex:1;padding:6px 10px;border:1px solid rgba(255,255,255,.15);border-radius:7px;background:transparent;color:var(--text);font-size:12px;cursor:pointer;"},"Deny");
    const head=h("div",{style:"font-size:12.5px;line-height:1.4;"},
      h("strong",null,String(label)),
      detail?h("div",{style:"opacity:.75;margin-top:2px;"},String(detail)):null,
      status);
    const card=h("div",{class:"ai-allow-card",style:"margin-top:8px;padding:10px 12px;border:1px solid var(--accent2);border-radius:10px;background:rgba(124,111,255,.08);display:flex;flex-direction:column;gap:8px;"},
      head,h("div",{style:"display:flex;gap:8px;"},yes,no));
    container.appendChild(card);
    const finish=(txt,ok)=>{status.textContent=txt;card.querySelectorAll("button").forEach(b=>b.remove());resolve(ok);};
    yes.onclick=()=>finish(" ✅",true);
    no.onclick=()=>finish(" ❌ denied",false);
    document.getElementById("aiMessages").scrollTop=99999;
  });
}

/* Render a delete-suggestion card with a real Delete button (still requires explicit user click) */
function renderDeleteSuggestCard(container,app){
  const status=h("span");
  const yes=h("button",{class:"ai-del-yes",style:"flex:1;padding:6px 10px;border:none;border-radius:7px;background:var(--red);color:#fff;font-size:12px;font-weight:600;cursor:pointer;"},"Delete");
  const no=h("button",{class:"ai-del-no",style:"flex:1;padding:6px 10px;border:1px solid rgba(255,255,255,.15);border-radius:7px;background:transparent;color:var(--text);font-size:12px;cursor:pointer;"},"Keep it");
  const card=h("div",{style:"margin-top:8px;padding:10px 12px;border:1px solid var(--red);border-radius:10px;background:rgba(255,77,106,.08);display:flex;flex-direction:column;gap:8px;"},
    h("div",{style:"font-size:12.5px;line-height:1.4;"},
      h("strong",null,`🗑️ Delete "${app.name}"?`),
      h("div",{style:"opacity:.75;margin-top:2px;"},"The AI suggested removing this app. This cannot be undone."),
      status),
    h("div",{style:"display:flex;gap:8px;"},yes,no));
  container.appendChild(card);
  yes.onclick=()=>{
    apps=apps.filter(a=>a.id!==app.id);p(LS.APPS,apps);
    if(favs.has(app.id)){favs.delete(app.id);p(LS.FAVS,[...favs]);}
    renderAll();toast(`"${app.name}" deleted`,"ti-trash");
    status.textContent=" ✅ deleted";card.querySelectorAll("button").forEach(b=>b.remove());
  };
  no.onclick=()=>{status.textContent=" kept";card.querySelectorAll("button").forEach(b=>b.remove());};
  document.getElementById("aiMessages").scrollTop=99999;
}

/* Execute a single AI tool call. For non-destructive actions, shows an Allow/Deny card and
   awaits the user's choice before actually performing the action. Delete is never auto-performed —
   it only renders a manual delete-suggestion card and immediately returns "suggested" to the AI. */
async function executeAiTool(name,args,uiContainer){
  try{
    if(!args||typeof args!=="object"||Array.isArray(args))args={}; // model-supplied → never trust the shape
    if(name==="suggest_delete_app"){
      const app=findAppByName(args.appName);
      if(!app)return{ok:false,error:`No app found matching "${args.appName}"`};
      renderDeleteSuggestCard(uiContainer,app);
      return{ok:true,message:`Showed the user a delete-confirmation card for "${app.name}". The user must click Delete themselves — it has not been deleted.`};
    }

    let label,detail,run;
    if(name==="add_app"){
      label=`➕ Add app: ${args.name}`;detail=args.url;
      run=()=>addAppData(args);
    }else if(name==="edit_app"){
      const app=findAppByName(args.appName);
      if(!app)return{ok:false,error:`No app found matching "${args.appName}"`};
      label=`✏️ Edit app: ${app.name}`;detail=Object.entries(args).filter(([k])=>k!=="appName").map(([k,v])=>`${k} → ${v}`).join(", ");
      run=()=>editAppData(app.id,args);
    }else if(name==="save_note"){
      label=`📝 Save note: ${args.title||"Untitled"}`;detail=(args.body||"").slice(0,80);
      run=()=>saveNoteData(args.title,args.body);
    }else if(name==="update_ai_setting"){
      label=`🤖 Change AI setting: ${args.setting}`;detail=`New value: ${args.value}`;
      run=()=>updateAiSetting(args.setting,args.value==="true"?true:args.value==="false"?false:args.value);
    }else if(name==="update_website_setting"){
      label=`⚙️ Change website setting: ${args.setting}`;detail=`New value: ${args.value}`;
      run=()=>updateWebsiteSetting(args.setting,args.value==="true"?true:args.value==="false"?false:args.value);
    }else{
      return{ok:false,error:`Unknown tool: ${name}`};
    }

    const allowed=await renderAllowCard(uiContainer,label,detail);
    if(!allowed)return{ok:false,error:"The user denied this action."};
    return run();
  }catch(e){
    return{ok:false,error:e.message};
  }
}
