/* ============================================================
   AI-VOICE.JS — Microphone / Speech recognition + mic
   network-error help modal
   ============================================================ */

function initVoice(){
  const SpeechRecog=window.SpeechRecognition||window.webkitSpeechRecognition;
  const micBtn=document.getElementById("aiMicBtn");
  if(!SpeechRecog){
    micBtn.style.opacity=".35";micBtn.style.cursor="not-allowed";
    micBtn.title="Needs Chrome or Edge browser";
    micBtn.addEventListener("click",()=>toast("🎙️ Voice needs Chrome or Edge","ti-microphone-off"));
    return;
  }
  let isRec=false,rec=null,accumulated="";

  function buildRec(){
    const r=new SpeechRecog();
    r.continuous=false;   // false avoids "network" error
    r.interimResults=true;
    r.lang="en-US";
    r.maxAlternatives=1;
    return r;
  }

  function attachHandlers(r){
    r.onstart=()=>{
      isRec=true;aiMicActive=true;
      micBtn.classList.add("recording");
      micBtn.replaceChildren(h("i",{class:"ti ti-microphone-off"}));
      micBtn.title="Tap to stop";
      setAiOrb("listening");setAiStatus("listening","🎙️ Listening… tap again to stop");
      document.getElementById("aiInput").placeholder="Speak now…";
    };
    r.onresult=e=>{
      const inp=document.getElementById("aiInput");
      let interimTxt="",finalTxt="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal)finalTxt+=e.results[i][0].transcript+" ";
        else interimTxt+=e.results[i][0].transcript;
      }
      if(finalTxt){accumulated=(accumulated+finalTxt).trim();inp.value=accumulated;}
      else inp.value=(accumulated+" "+interimTxt).trim();
      autoResizeAiInput();
    };
    r.onend=()=>{
      isRec=false;aiMicActive=false;
      micBtn.classList.remove("recording");
      micBtn.replaceChildren(h("i",{class:"ti ti-microphone"}));
      micBtn.title="Voice input";
      setAiOrb("idle");
      const c=getAiConfig();
      setAiStatus("idle","Online · Ready");
      document.getElementById("aiInput").placeholder=`Message ${c.persona||"ARIA"}… (Enter to send)`;
      const cap=document.getElementById("aiInput").value.trim();
      if(cap)toast(`✓ "${cap.slice(0,50)}${cap.length>50?"…":""}" — press Enter to send`,"ti-microphone");
    };
    r.onerror=e=>{
      console.warn("🎙️ Speech:",e.error);
      if(e.error==="aborted")return; // silent — user stopped
      isRec=false;aiMicActive=false;
      micBtn.classList.remove("recording");
      micBtn.replaceChildren(h("i",{class:"ti ti-microphone"}));
      setAiOrb("idle");setAiStatus("idle","Online · Ready");
      const c=getAiConfig();
      document.getElementById("aiInput").placeholder=`Message ${c.persona||"ARIA"}…`;
      if(e.error==="not-allowed"||e.error==="permission-denied")
        toast("🎙️ Mic blocked — click 🔒 in address bar and allow microphone","ti-microphone-off");
      else if(e.error==="network"){
        // Show detailed instructions
        showMicNetworkHelp();
      }
      else if(e.error==="no-speech")
        toast("🎙️ No speech heard — tap mic and speak","ti-microphone");
      else if(e.error==="audio-capture")
        toast("🎙️ No microphone detected","ti-microphone-off");
      else
        toast(`🎙️ ${e.error} — try again`,"ti-microphone-off");
    };
  }

  micBtn.addEventListener("click",e=>{
    e.stopPropagation();
    if(isRec){
      try{rec.stop();}catch(err){}
    }else{
      accumulated=document.getElementById("aiInput").value.trim()||"";
      rec=buildRec();attachHandlers(rec);
      try{rec.start();}catch(err){
        toast("🎙️ Could not start mic — check permissions","ti-microphone-off");
        console.error(err);
      }
    }

  });

  // Expose globally for HTML onclick
  window._aiMicToggle=()=>{
    if(isRec){try{rec.stop();}catch(e){}}
    else{
      accumulated=document.getElementById("aiInput").value.trim()||"";
      rec=buildRec();attachHandlers(rec);
      try{rec.start();}catch(err){toast("🎙️ Could not start mic","ti-microphone-off");}
    }
  };
}

function showMicNetworkHelp(){
  const modal=document.getElementById("micHelpModal");
  if(modal)modal.classList.add("show");
  toast("🎙️ Mic needs localhost — see popup for steps","ti-alert-circle");
}
