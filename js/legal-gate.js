/* ============================================================
   LEGAL-GATE.JS — Terms of Use + Privacy Policy acceptance UX
   ------------------------------------------------------------
   Self-contained on purpose, so it can be added to any version of the app (including the cloud build)
   without replacing index.html / boot.js / settings.js / CSS files. It:

   1. Adds the small notice "By continuing you agree to our Terms of Use and Privacy Policy."
      to the Login and Register panels (links to terms.html / privacy.html).
   2. Provides  ensureTermsAccepted(user)  → Promise<boolean>  for the login handler in boot.js.
      If user.terms_accepted_at is empty it shows the "Before you continue" gate (summary + links +
      "Accept & Continue"), saves the acceptance on the server (POST /api/auth/accept-terms →
      users.terms_accepted_at) and resolves true. "Decline & sign out" resolves false.
      Accepted accounts resolve true immediately, on every device.
   3. Adds Settings → "Privacy & Policy" (buttons to privacy.html / terms.html) after the Settings layout is built.

   Where it is called (boot.js, login submit handler) — AFTER the cloud session is started and BEFORE the
   dashboard is shown, so nothing is uploaded (cloudAfterLogin runs later) and nothing is visible until accepted:

       if(!(await ensureTermsAccepted(data.user)))return;
   Uses only existing globals, all optional: API_AUTH / API_BASE, getAuthToken, signOut, cloudEndSession,
   openSettingsTab + the settings layout helpers. Does not touch window.__nexusParts or cloud.js.
   ============================================================ */
(function nexusLegalGate(){
  "use strict";
  if(window.__nexusLegalGate)return; // never run twice
  window.__nexusLegalGate=true;

  var doc=document;
  var $=function(id){return doc.getElementById(id);};

  /* ── styles (injected, so no CSS file has to be replaced) ───────────────── */
  var CSS=[
    /* notice on login / register */
    '.login-legal{margin:14px 4px 0;font-size:10px;line-height:1.6;color:var(--text3);font-family:"JetBrains Mono",monospace;letter-spacing:.01em;text-align:center;}',
    '.login-legal a{color:var(--accent2);text-decoration:none;border-bottom:1px dashed rgba(168,156,255,.4);transition:color .2s,border-color .2s;}',
    '.login-legal a:hover,.login-legal a:focus-visible{color:#fff;border-bottom-color:var(--accent2);outline:none;}',
    /* gate overlay */
    '#termsGate{position:fixed;inset:0;z-index:9500;display:none;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;',
    ' background:radial-gradient(ellipse at 50% 30%,rgba(124,111,255,.12),rgba(0,0,0,.95) 65%);backdrop-filter:blur(22px) saturate(140%);-webkit-backdrop-filter:blur(22px) saturate(140%);}',
    '#termsGate.show{display:flex;animation:tgBackdropIn .4s ease both;}',
    '@keyframes tgBackdropIn{from{opacity:0;}to{opacity:1;}}',
    '.terms-box{max-width:520px;margin:auto;padding:36px 32px 24px;}',
    '.terms-box .login-title{font-size:20px;}.terms-box .login-sub{margin-bottom:18px;}',
    '.tg-scroll-wrap{position:relative;margin:0 0 12px;text-align:left;}',
    '.tg-scroll{max-height:min(40vh,320px);overflow-y:auto;padding:14px 16px 26px;border:1px solid var(--border2);border-radius:14px;background:rgba(10,10,15,.5);scrollbar-width:thin;scrollbar-color:var(--border3) transparent;overscroll-behavior:contain;}',
    '.tg-scroll:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}',
    '.tg-scroll::-webkit-scrollbar{width:6px;}.tg-scroll::-webkit-scrollbar-thumb{background:var(--border3);border-radius:6px;}',
    '.tg-sec{opacity:0;transform:translateY(12px);animation:tgItemIn .6s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(.3s + var(--i,0)*.15s);}',
    '@keyframes tgItemIn{to{opacity:1;transform:none;}}',
    '.tg-sec+.tg-sec{margin-top:16px;}',
    '.tg-sec h3{display:flex;align-items:center;gap:8px;margin:0 0 9px;font-size:12.5px;font-weight:700;letter-spacing:.02em;color:var(--text);}',
    '.tg-sec h3 i{font-size:16px;color:var(--accent2);}',
    '.tg-sec ul{list-style:none;display:grid;gap:7px;margin:0;padding:0;}',
    '.tg-sec li{position:relative;padding-left:17px;font-size:12px;line-height:1.55;color:var(--text2);}',
    '.tg-sec li::before{content:"";position:absolute;left:3px;top:.55em;width:6px;height:6px;border-radius:2px;transform:rotate(45deg);background:linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 0 8px rgba(124,111,255,.6);}',
    '.tg-sec li b{color:var(--text);font-weight:600;}',
    '.tg-fine{font-size:10.5px;color:var(--text3);font-family:"JetBrains Mono",monospace;}',
    '.tg-fade{position:absolute;left:1px;right:1px;bottom:1px;height:46px;border-radius:0 0 13px 13px;display:flex;align-items:flex-end;justify-content:center;gap:5px;padding-bottom:7px;',
    ' background:linear-gradient(rgba(17,17,24,0),rgba(17,17,24,.97) 70%);font:500 10px "JetBrains Mono",monospace;letter-spacing:.06em;color:var(--accent2);pointer-events:none;transition:opacity .25s;}',
    '.tg-fade i{animation:tgBounce 1.4s ease-in-out infinite;}.tg-fade.hide{opacity:0;}',
    '@keyframes tgBounce{0%,100%{transform:translateY(-2px);}50%{transform:translateY(2px);}}',
    '.tg-links{margin:0 0 12px;text-align:center;font-size:10.5px;color:var(--text3);font-family:"JetBrains Mono",monospace;}',
    '.tg-links a{color:var(--accent2);text-decoration:none;border-bottom:1px dashed rgba(168,156,255,.4);}.tg-links a:hover{color:#fff;}',
    '.terms-box .login-err{text-align:center;margin-bottom:8px;}',
    '.terms-box .login-text-btn{margin-top:10px;color:var(--text3);}',
    '.terms-box .login-text-btn:hover:not(:disabled){color:var(--text2);}',
    '.terms-box .login-text-btn:disabled{opacity:.4;cursor:not-allowed;}',
    '.terms-box .login-btn-label{letter-spacing:.06em;}',
    '@media (max-width:520px){#termsGate{padding:12px;}.terms-box{padding:28px 18px 18px;border-radius:18px;}.tg-scroll{max-height:38vh;padding:12px 13px 26px;}}',
    '@media (prefers-reduced-motion:reduce){.tg-sec{animation:none;opacity:1;transform:none;}.tg-fade i,#termsGate.show{animation:none;}}',
    /* Settings → Privacy & Policy buttons (anchors that look like the other .sx-btn actions) */
    'a.sx-btn{text-decoration:none;}',
    '.sx-legal-actions{flex-direction:column;}',
    '.sx-legal-link{justify-content:flex-start;padding:11px 14px;}',
    '.sx-legal-link>span{flex:1;text-align:left;}',
    '.sx-legal-link .sx-legal-ext{font-size:13px;opacity:.5;transition:opacity .15s,transform .15s;}',
    '.sx-legal-link:hover .sx-legal-ext{opacity:1;transform:translate(1px,-1px);}'
  ].join("\n");
  function injectStyles(){
    if($("nxLegalStyles"))return;
    var st=doc.createElement("style");st.id="nxLegalStyles";st.textContent=CSS;(doc.head||doc.documentElement).appendChild(st);
  }

  /* ── 1. notice under the Login + Register forms ─────────────────────────── */
  function makeNotice(){
    var p=doc.createElement("p");p.className="login-legal";
    p.appendChild(doc.createTextNode("By continuing you agree to our "));
    var a=doc.createElement("a");a.href="terms.html";a.target="_blank";a.rel="noopener";a.textContent="Terms of Use";p.appendChild(a);
    p.appendChild(doc.createTextNode(" and "));
    var b=doc.createElement("a");b.href="privacy.html";b.target="_blank";b.rel="noopener";b.textContent="Privacy Policy";p.appendChild(b);
    p.appendChild(doc.createTextNode("."));
    return p;
  }
  function addNotices(){
    ["loginPanel","registerPanel"].forEach(function(id){
      var panel=$(id);if(!panel||panel.querySelector(".login-legal"))return;
      var anchor=panel.querySelector(".login-hint-row")||panel.querySelector("form");
      if(anchor&&anchor.parentNode===panel)anchor.insertAdjacentElement("afterend",makeNotice());else panel.appendChild(makeNotice());
    });
  }

  /* ── 2. the gate ────────────────────────────────────────────────────────── */
  var GATE_HTML=
    '<div class="login-box terms-box">'+
      '<div class="login-glow login-glow-a"></div><div class="login-glow login-glow-b"></div>'+
      '<div class="login-panel">'+
        '<div class="login-icon-ring"><i class="ti ti-file-certificate"></i></div>'+
        '<div class="login-title" id="tgTitle">BEFORE YOU CONTINUE</div>'+
        '<div class="login-sub" id="tgSub">Review how Nexus handles your data and the rules of use</div>'+
        '<div class="tg-scroll-wrap">'+
          '<div class="tg-scroll" id="tgScroll" tabindex="0" role="region" aria-label="Summary of the Privacy Policy and Terms of Use">'+
            '<section class="tg-sec" style="--i:0"><h3><i class="ti ti-shield-lock"></i>Privacy Policy — in short</h3><ul>'+
              '<li>We store your username, a bcrypt <b>hash</b> of your password (never the password itself) and, if you add one, a verified email.</li>'+
              '<li>Your apps, notes, profile and settings belong to your account and are saved to it in the cloud. We <b>don\'t sell</b> your data and use no advertising trackers.</li>'+
              '<li>The AI assistant is optional: you bring your <b>own API key</b>, and chats go straight to the provider you choose.</li>'+
              '<li>Password-reset and email-verification codes are sent through Brevo.</li>'+
              '<li>An admin can block or delete accounts that break the rules. You can delete your own account any time in <b>Settings → Danger Zone</b>.</li>'+
            '</ul></section>'+
            '<section class="tg-sec" style="--i:1"><h3><i class="ti ti-file-text"></i>Terms of Use — in short</h3><ul>'+
              '<li>Keep your password private. You\'re responsible for what happens under your account.</li>'+
              '<li>No abuse: no hacking, spam, malware or illegal content, and no bypassing rate limits or lockouts.</li>'+
              '<li>AI answers can be wrong — check anything important yourself.</li>'+
              '<li>The service is provided <b>"as is"</b>, can change or go down, so keep your own copy of anything important.</li>'+
              '<li>We may block or end accounts that break these rules. You can leave at any time.</li>'+
            '</ul></section>'+
            '<p class="tg-fine tg-sec" style="--i:2">This is only a summary — the full documents apply.</p>'+
          '</div>'+
          '<div class="tg-fade" id="tgFade" aria-hidden="true"><i class="ti ti-chevrons-down"></i> Scroll to read</div>'+
        '</div>'+
        '<div class="tg-links">Read the full <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a></div>'+
        '<div class="login-err" id="tgErr" role="alert"></div>'+
        '<button type="button" class="login-btn" id="tgAcceptBtn"><span class="login-btn-label">Accept &amp; Continue</span><span class="login-btn-spinner"></span></button>'+
        '<button type="button" class="login-text-btn" id="tgDeclineBtn">Decline &amp; sign out</button>'+
      '</div>'+
    '</div>';
  function ensureGateDom(){
    var g=$("termsGate");if(g)return g;
    g=doc.createElement("div");g.id="termsGate";g.setAttribute("role","dialog");g.setAttribute("aria-modal","true");
    g.setAttribute("aria-labelledby","tgTitle");g.setAttribute("aria-describedby","tgSub");
    g.innerHTML=GATE_HTML; // static markup only — no user data is ever interpolated
    doc.body.appendChild(g);return g;
  }

  function hasAccepted(user){return !!(user&&user.terms_accepted_at);}
  function acceptUrl(){
    if(typeof API_AUTH==="object"&&API_AUTH&&API_AUTH.ME)return String(API_AUTH.ME).replace(/\/me$/,"/accept-terms");
    return String(typeof API_BASE==="string"?API_BASE:"").replace(/\/+$/,"")+"/api/auth/accept-terms";
  }
  function authToken(){
    try{if(typeof getAuthToken==="function"){var t=getAuthToken();if(t)return t;}}catch(e){/* fall through */}
    try{return localStorage.getItem("nexus_jwt_token");}catch(e){return null;}
  }
  async function postAccept(){
    var res;
    try{res=await fetch(acceptUrl(),{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken()},body:"{}"});}
    catch(e){var ne=new Error("Can't reach the Nexus server. Check your connection and try again.");ne.network=true;throw ne;}
    var data=null;try{data=await res.json();}catch(e){/* non-JSON body */}
    if(!res.ok){var er=new Error((data&&data.error)||("Request failed (HTTP "+res.status+")."));er.status=res.status;throw er;}
    return data||{};
  }

  var openPromise=null;
  function openGate(){
    if(openPromise)return openPromise;
    openPromise=new Promise(function(resolve){
      var gate=ensureGateDom(),scroll=$("tgScroll"),fade=$("tgFade"),err=$("tgErr"),acceptBtn=$("tgAcceptBtn"),declineBtn=$("tgDeclineBtn"),loginScreen=$("loginScreen");
      var busy=false,done=false,observer=null;
      function setErr(m){err.textContent=m||"";err.classList.toggle("show",!!m);}
      function setLoading(on){acceptBtn.classList.toggle("loading",on);acceptBtn.disabled=on;}
      function updateFade(){ // the "Scroll to read" hint disappears once everything is visible
        var noMore=scroll.scrollHeight<=scroll.clientHeight+6||scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-6;
        fade.classList.toggle("hide",noMore);
      }
      function onKey(e){
        if(e.key==="Escape"){e.preventDefault();e.stopPropagation();return;} // can't be dismissed: accept or decline
        if(e.key!=="Tab")return;
        var items=[].slice.call(gate.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]'));
        if(!items.length)return;
        var first=items[0],last=items[items.length-1],cur=doc.activeElement;
        if(!gate.contains(cur)){e.preventDefault();first.focus();}
        else if(e.shiftKey&&cur===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&cur===last){e.preventDefault();first.focus();}
      }
      function finish(result,signOutAfter){
        if(done)return;done=true;
        doc.removeEventListener("keydown",onKey,true);
        window.removeEventListener("resize",updateFade);
        scroll.removeEventListener("scroll",updateFade);
        if(observer)observer.disconnect();
        acceptBtn.onclick=null;declineBtn.onclick=null;
        gate.classList.remove("show");
        setErr("");setLoading(false);declineBtn.disabled=false;
        openPromise=null;
        if(signOutAfter){
          // Declined: nothing may leave this device. End the cloud session WITHOUT flushing unsaved changes
          // (they stay marked and are kept locally), then do the normal sign-out.
          try{if(typeof cloudEndSession==="function")cloudEndSession({flush:false});}catch(e){console.warn("[legal] cloudEndSession failed",e);}
          try{if(typeof signOut==="function")signOut();}catch(e){console.warn("[legal] signOut failed",e);}
        }
        resolve(result);
      }
      acceptBtn.onclick=async function(){
        if(busy)return;
        busy=true;setErr("");setLoading(true);declineBtn.disabled=true;
        try{await postAccept();finish(true);}
        catch(e){
          busy=false;setLoading(false);declineBtn.disabled=false;
          if(e.status===401||e.status===403)setErr(e.message||"Your session is no longer valid. Please decline and sign in again.");
          else if(e.status===404)setErr("The server hasn't been updated for this step yet. Please try again later.");
          else setErr(e.message||"Could not save your choice. Please try again.");
        }
      };
      declineBtn.onclick=function(){if(busy)return;finish(false,true);};
      doc.addEventListener("keydown",onKey,true);
      window.addEventListener("resize",updateFade);
      scroll.addEventListener("scroll",updateFade,{passive:true});
      // Session ended while the gate was open (expired token, signed out in another tab…): close it, never leave it over the login screen.
      if(loginScreen&&window.MutationObserver){
        observer=new MutationObserver(function(){if(loginScreen.classList.contains("show"))finish(false,false);});
        observer.observe(loginScreen,{attributes:true,attributeFilter:["class"]});
      }
      setErr("");scroll.scrollTop=0;
      gate.classList.add("show");
      requestAnimationFrame(updateFade);
      setTimeout(function(){if(done)return;try{scroll.focus({preventScroll:true});}catch(e){/* ignore */}updateFade();},450); // focus the text, not the button, so arrow keys scroll it
    });
    return openPromise;
  }

  /** Called by the login handler. Resolves true → continue into the app; false → the user declined / the session ended. */
  window.hasAcceptedTerms=hasAccepted;
  window.ensureTermsAccepted=function(user){return hasAccepted(user)?Promise.resolve(true):openGate();};

  /* ── 3. Settings → Privacy & Policy tab (added after settings.js has built its tabbed layout) ── */
  function addSettingsTab(){
    try{
      if($("sxtab-privacy"))return true;
      if(typeof _sxBuilt==="undefined"||!_sxBuilt||typeof SX_TABS==="undefined"||typeof sxEl!=="function"||typeof sxCard!=="function"||typeof sxIcon==="undefined"||typeof openSettingsTab!=="function")return false;
      var tabs=doc.querySelector("#settingsPanel .sx-tabs"),body=doc.querySelector("#settingsPanel .sx-body");
      if(!tabs||!body)return false;

      var link=function(text,icon,href){
        return sxEl("a",{class:"sx-btn sx-btn-wide sx-legal-link",href:href,target:"_blank",rel:"noopener"},sxIcon(icon),sxEl("span",{text:text}),sxIcon("ti-external-link sx-legal-ext"));
      };
      var pane=sxEl("div",{class:"sx-pane","data-pane":"privacy",id:"sxpane-privacy",role:"tabpanel","aria-labelledby":"sxtab-privacy"},
        sxCard("Privacy & Policy","ti-shield-check","How Nexus handles your account and data, and the rules for using it. Opens in a new tab.",
          sxEl("div",{class:"sx-actions sx-legal-actions"},link("Privacy Policy","ti-shield-lock","privacy.html"),link("Terms of Use","ti-file-text","terms.html"))));
      pane.hidden=true;

      var tab=sxEl("button",{type:"button",class:"sx-tab",role:"tab","data-tab":"privacy",id:"sxtab-privacy","aria-controls":"sxpane-privacy","aria-selected":"false"},sxIcon("ti-shield-check"),sxEl("span",{text:"Privacy & Policy"}));
      tab.tabIndex=-1;

      var di=-1;SX_TABS.forEach(function(t,i){if(t.id==="danger")di=i;});
      var entry={id:"privacy",label:"Privacy & Policy",icon:"ti-shield-check"};
      if(di>=0)SX_TABS.splice(di,0,entry);else SX_TABS.push(entry);

      tab.addEventListener("click",function(){openSettingsTab("privacy");});
      tab.addEventListener("keydown",function(e){ // same arrow-key navigation as the built-in tabs
        var i=SX_TABS.findIndex(function(x){return x.id==="privacy";}),n=null;
        if(e.key==="ArrowRight")n=(i+1)%SX_TABS.length;else if(e.key==="ArrowLeft")n=(i-1+SX_TABS.length)%SX_TABS.length;
        else if(e.key==="Home")n=0;else if(e.key==="End")n=SX_TABS.length-1;
        if(n!==null){e.preventDefault();openSettingsTab(SX_TABS[n].id);var b=$("sxtab-"+SX_TABS[n].id);if(b)b.focus();}
      });
      var dTab=$("sxtab-danger"),dPane=$("sxpane-danger");
      if(dTab&&dTab.parentNode===tabs)tabs.insertBefore(tab,dTab);else tabs.appendChild(tab);
      if(dPane&&dPane.parentNode===body)body.insertBefore(pane,dPane);else body.appendChild(pane);
      return true;
    }catch(e){console.warn("[legal] could not add the Settings tab",e);return true;} // don't retry a broken attempt forever
  }
  function startSettingsTab(){
    var tries=0;
    (function attempt(){
      if(addSettingsTab())return;
      if(++tries<80)setTimeout(attempt,100);
      else console.warn("[legal] Settings → Privacy & Policy was not added: the Settings layout was not found.");
    })();
  }

  /* ── boot ── */
  function init(){injectStyles();addNotices();ensureGateDom();startSettingsTab();}
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",init);else init();
})();
