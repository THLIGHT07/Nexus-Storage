/* ============================================================
   BOOT.JS — Boot sequence animation + Login/Lock screen
   ============================================================ */
(window.__nexusParts=window.__nexusParts||{})["boot.js"]="2026-10-02-xss1";


/* ═══════════════════════════════════════════════════
   BOOT SEQUENCE
═══════════════════════════════════════════════════ */
(function bootSequence(){
  // ── Canvas particles (optional — won't block boot if it fails) ──
  try{
    const bc=document.getElementById("bootCanvas");
    if(bc){
      const bctx=bc.getContext("2d");
      let bW=0,bH=0,bPts=[],bAnim=true;
      function bResize(){
        bW=bc.width=window.innerWidth||bc.offsetWidth||800;
        bH=bc.height=window.innerHeight||bc.offsetHeight||600;
      }
      function bInit(){
        bPts=Array.from({length:50},()=>({
          x:Math.random()*bW,y:Math.random()*bH,
          vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:Math.random()*1.4+.4
        }));
      }
      function bDraw(){
        if(!bAnim)return;
        try{
          bctx.clearRect(0,0,bW,bH);
          bPts.forEach(p=>{
            p.x+=p.vx;p.y+=p.vy;
            if(p.x<0||p.x>bW)p.vx*=-1;
            if(p.y<0||p.y>bH)p.vy*=-1;
            bctx.beginPath();bctx.arc(p.x,p.y,p.r,0,Math.PI*2);
            bctx.fillStyle="rgba(124,111,255,0.4)";bctx.fill();
          });
          for(let i=0;i<bPts.length;i++)for(let j=i+1;j<bPts.length;j++){
            const d=Math.hypot(bPts[i].x-bPts[j].x,bPts[i].y-bPts[j].y);
            if(d<110){
              bctx.beginPath();bctx.moveTo(bPts[i].x,bPts[i].y);bctx.lineTo(bPts[j].x,bPts[j].y);
              bctx.strokeStyle=`rgba(124,111,255,${.07*(1-d/110)})`;bctx.lineWidth=.7;bctx.stroke();
            }
          }
        }catch(e){}
        requestAnimationFrame(bDraw);
      }
      bResize();bInit();bDraw();
      window.addEventListener("resize",()=>{bResize();bInit();});
      // expose stopper for later
      window._stopBootAnim=()=>{bAnim=false;};
    }
  }catch(e){ console.warn("Boot canvas error:",e); }

  // ── Boot steps — always run regardless of canvas ──
  const steps=[
    "Initializing systems…",
    "Loading neural matrix…",
    "Scanning credentials…",
    "Decrypting domain…",
    "Mounting app registry…",
    "ACCESS GRANTED"
  ];
  const bar=document.getElementById("bootBar");
  const status=document.getElementById("bootStatus");
  let i=0;

  function nextStep(){
    try{
      if(i>=steps.length-1){
        if(status)status.textContent=steps[i];
        if(bar)bar.style.width="100%";
        setTimeout(()=>{
          const bootMain=document.getElementById("bootMain");
          if(bootMain)bootMain.style.display="none";
          const g=document.getElementById("bootGranted");
          if(g)g.style.display="flex";
          setTimeout(()=>{
            if(window._stopBootAnim)window._stopBootAnim();
            const bs=document.getElementById("bootScreen");
            if(bs){
              bs.style.transition="opacity .7s";
              bs.style.opacity="0";
              setTimeout(()=>{
                bs.style.display="none";
                showLoginScreen();
              },700);
            }else{
              showLoginScreen();
            }
          },900);
        },400);
        return;
      }
      if(status)status.textContent=steps[i];
      if(bar)bar.style.width=(((i+1)/steps.length)*100)+"%";
      i++;
      setTimeout(nextStep, 420+Math.random()*160);
    }catch(e){
      console.error("Boot step error:",e);
      // Even if something crashes, force proceed to login
      setTimeout(()=>{
        const bs=document.getElementById("bootScreen");
        if(bs)bs.style.display="none";
        showLoginScreen();
      },500);
    }
  }
  setTimeout(nextStep,500);
})();

/* ═══════════════════════════════════════════════════
   LOGIN / REGISTER — backed by the real Nexus API
   (API_BASE / API_AUTH / getAuthToken / setAuthToken / authHeaders
   are defined in js/utils.js, which loads before this file)
═══════════════════════════════════════════════════ */

/* ── Screen open/close ── */
function showLoginScreen(){
  const rememberedUser=localStorage.getItem(LS.CURRENT_USER)||"";
  showLoginPanel();
  document.getElementById("loginUser").value=rememberedUser;
  document.getElementById("loginScreen").classList.add("show");
  setTimeout(()=>{
    const target=rememberedUser?document.getElementById("loginPass"):document.getElementById("loginUser");
    target.focus();
  },320);
}

/* ── Login ⇄ Register panel swap (corner links live outside both
   panels — see index.html — so we toggle them here too, in sync) ── */
function showLoginPanel(){
  const login=document.getElementById("loginPanel"),reg=document.getElementById("registerPanel");
  reg.hidden=true;login.hidden=false;
  document.getElementById("forgotPanel").hidden=true;resetForgotFlow();
  login.classList.remove("login-panel-enter");void login.offsetWidth;login.classList.add("login-panel-enter");
  document.getElementById("showRegisterBtn").hidden=false;
  document.getElementById("showForgotBtn").hidden=false;
  document.getElementById("showLoginBtn").hidden=true;
  setLoginError("");
}
function showRegisterPanel(){
  const login=document.getElementById("loginPanel"),reg=document.getElementById("registerPanel");
  login.hidden=true;reg.hidden=false;
  document.getElementById("forgotPanel").hidden=true;resetForgotFlow();
  reg.classList.remove("login-panel-enter");void reg.offsetWidth;reg.classList.add("login-panel-enter");
  document.getElementById("showRegisterBtn").hidden=true;
  document.getElementById("showForgotBtn").hidden=true;
  document.getElementById("showLoginBtn").hidden=false;
  setRegisterError("");setRegisterOk("");
  setTimeout(()=>document.getElementById("regUser").focus(),200);
}
document.getElementById("showRegisterBtn").addEventListener("click",showRegisterPanel);
document.getElementById("showLoginBtn").addEventListener("click",showLoginPanel);
document.getElementById("showForgotBtn").addEventListener("click",showForgotPanel);

/* ── Password visibility toggles ── */
function wireEyeToggle(inputId,btnId,iconId){
  const input=document.getElementById(inputId),icon=document.getElementById(iconId);
  document.getElementById(btnId).addEventListener("click",()=>{
    const show=input.type==="password";
    input.type=show?"text":"password";
    icon.className=show?"ti ti-eye-off":"ti ti-eye";
  });
}
wireEyeToggle("loginPass","loginEyeBtn","loginEyeIcon");
wireEyeToggle("regPass","regEyeBtn","regEyeIcon");
wireEyeToggle("fpNew","fpEyeBtn","fpEyeIcon");

/* ── Small UI helpers ── */
/* ── Login rate-limit UX — same behaviour as the admin panel (backend/admin.html) ──
   • failures 1–2 .......... plain "Invalid username or password."
   • failure 3 onwards ..... "… N attempts left."  (N comes from the server: attemptsLeft)
   • allowance used up ..... server answers 429 + retryAfterSeconds → password field and button
                             lock, button reads "LOCKED MM:SS" until the timer ends. */
const LOGIN_WARN_FROM_FAILURE=3;
let loginLockTimer=null;     // non-null while the form is locked
let loginLockMessage="";     // red text kept on screen for the whole lock

function setLoginError(msg){
  if(!msg&&loginLockTimer!==null)msg=loginLockMessage; // while locked, "clearing" the error keeps the lock message
  const el=document.getElementById("loginErr");
  el.textContent=msg;el.classList.toggle("show",!!msg);
}

function startLoginLock(seconds,message){
  clearInterval(loginLockTimer);
  let left=Math.max(1,Math.ceil(Number(seconds)||900));
  loginLockMessage=message||"Too many attempts. Please try again later.";
  const pass=document.getElementById("loginPass"),btn=document.getElementById("loginBtn");
  const label=btn.querySelector(".login-btn-label");
  pass.disabled=true;btn.disabled=true;
  const tick=()=>{
    const m=String(Math.floor(left/60)).padStart(2,"0"),sec=String(left%60).padStart(2,"0");
    label.textContent=`LOCKED ${m}:${sec}`;
    if(left--<=0){
      clearInterval(loginLockTimer);loginLockTimer=null;
      pass.disabled=false;btn.disabled=false;
      label.textContent="AUTHENTICATE";
      setLoginError("");
      if(!document.getElementById("loginPanel").hidden)pass.focus();
    }
  };
  loginLockTimer=setInterval(tick,1000); // set BEFORE the first tick so setLoginError() sees the lock
  tick();
  setLoginError(loginLockMessage);
}
function setRegisterError(msg){
  const el=document.getElementById("registerErr");
  el.textContent=msg;el.classList.toggle("show",!!msg);
}
function setRegisterOk(msg){
  const el=document.getElementById("registerOk");
  el.textContent=msg;el.classList.toggle("show",!!msg);
}
function setBtnLoading(btnId,loading){
  const btn=document.getElementById(btnId);
  btn.classList.toggle("loading",loading);
  // finishing a request must never re-enable the login button while the lock countdown is running
  btn.disabled=loading||(btnId==="loginBtn"&&loginLockTimer!==null);
}
function shakeInput(id){
  const el=document.getElementById(id);
  el.classList.remove("input-shake");void el.offsetWidth;el.classList.add("input-shake");
}

/* ── Turns a fetch() failure/response into one friendly error string ──
   Handles: network/CORS errors (backend not running), and every JSON
   { error: "..." } shape the Nexus backend returns (400/401/409/500). */
async function readApiError(res,fallback){
  try{
    const data=await res.json();
    if(data&&data.error)return data.error;
  }catch(e){/* body wasn't JSON — fall through to generic message */}
  return fallback;
}

/* ── POST /api/auth/login ── */
async function apiLogin(username,password){
  let res;
  try{
    res=await fetch(API_AUTH.LOGIN,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username,password})
    });
  }catch(networkErr){
    throw new Error(`Can't reach the Nexus server at ${API_BASE}. Is the backend running?`);
  }
  if(!res.ok){
    let data={};
    try{data=await res.json()||{};}catch(e){/* body wasn't JSON — generic message below */}
    const err=new Error(data.error||(res.status===401?"Invalid username or password.":"Login failed. Please try again."));
    err.status=res.status;err.data=data; // used by the submit handler: attemptsLeft (401), retryAfterSeconds (429)
    throw err;
  }
  return res.json(); // { message, token, expiresIn, user }
}

/* ── POST /api/auth/register ── */
async function apiRegister(username,password){
  let res;
  try{
    res=await fetch(API_AUTH.REGISTER,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username,password})
    });
  }catch(networkErr){
    throw new Error(`Can't reach the Nexus server at ${API_BASE}. Is the backend running?`);
  }
  if(!res.ok){
    const msg=await readApiError(res,res.status===409?"Username already exists":"Registration failed. Please try again.");
    throw new Error(msg);
  }
  return res.json(); // { message, user }
}


/* ═══════════════════════════════════════════════════
   FORGOT PASSWORD — email one-time code (backend: routes/authOtp.js)
   Step 1  username or email  → POST /forgot-password   (server answers the same for every account)
   Step 2  6-digit code       → POST /verify-otp        (checks the code, does not use it up)
   Step 3  new password ×2    → POST /reset-password    (sets the password, code is used up)
   "Back to login" is the corner link (showLoginBtn), shown whenever this panel is open.
═══════════════════════════════════════════════════ */
const FP_SUBS={1:"Enter your username or email",2:"Enter the 6-digit code we emailed you",3:"Choose a new password"};
const fp={ident:"",otp:"",step:1,resendTimer:null,resendLeft:0};
const fpEl=id=>document.getElementById(id);
function fpMsg(id,msg){const el=fpEl(id);el.textContent=msg||"";el.classList.toggle("show",!!msg);}
function fpClearMsgs(){["fpErr1","fpErr2","fpErr3","fpOk2"].forEach(id=>fpMsg(id,""));}

function fpSetStep(n,focus=true){
  fp.step=n;fpClearMsgs();
  [1,2,3].forEach(i=>{fpEl("forgotForm"+i).hidden=i!==n;});
  fpEl("fpSub").textContent=FP_SUBS[n];
  const p=fpEl("forgotPanel");p.classList.remove("login-panel-enter");void p.offsetWidth;p.classList.add("login-panel-enter");
  if(focus)setTimeout(()=>fpEl(["","fpUser","fpOtp","fpNew"][n]).focus(),180);
}
/* Resend button: disabled with a countdown (the server enforces the same gap). */
function fpStartCooldown(seconds){
  clearInterval(fp.resendTimer);
  fp.resendLeft=Math.max(1,Math.ceil(Number(seconds)||60));
  const btn=fpEl("fpResend");
  const tick=()=>{
    if(fp.resendLeft<=0){clearInterval(fp.resendTimer);fp.resendTimer=null;btn.disabled=false;btn.textContent="Resend code";return;}
    btn.disabled=true;btn.textContent=`Resend code in ${fp.resendLeft}s`;fp.resendLeft--;
  };
  fp.resendTimer=setInterval(tick,1000);tick();
}
function resetForgotFlow(){
  clearInterval(fp.resendTimer);fp.resendTimer=null;fp.ident="";fp.otp="";fp.step=1;
  ["forgotForm1","forgotForm2","forgotForm3"].forEach(id=>fpEl(id).reset());
  [1,2,3].forEach(i=>{fpEl("forgotForm"+i).hidden=i!==1;});
  fpEl("fpSub").textContent=FP_SUBS[1];fpClearMsgs();
  ["fpBtn1","fpBtn2","fpBtn3"].forEach(id=>setBtnLoading(id,false));
  const r=fpEl("fpResend");r.disabled=true;r.textContent="Resend code";
  const pw=fpEl("fpNew");if(pw.type!=="password"){pw.type="password";fpEl("fpEyeIcon").className="ti ti-eye";}
}
function showForgotPanel(){
  const typed=document.getElementById("loginUser").value.trim();
  document.getElementById("loginPanel").hidden=true;document.getElementById("registerPanel").hidden=true;
  resetForgotFlow();
  fpEl("forgotPanel").hidden=false;
  document.getElementById("showRegisterBtn").hidden=true;
  document.getElementById("showForgotBtn").hidden=true;
  document.getElementById("showLoginBtn").hidden=false;
  if(typed)fpEl("fpUser").value=typed; // carry over what they already typed on the login form
  fpSetStep(1);
}

/* step 1 — ask for a code */
fpEl("forgotForm1").addEventListener("submit",async(e)=>{
  e.preventDefault();
  if(fpEl("fpBtn1").disabled)return;
  const ident=fpEl("fpUser").value.trim().toLowerCase();
  fpMsg("fpErr1","");
  if(!ident){fpMsg("fpErr1","Enter your username or email.");shakeInput("fpUser");return;}
  setBtnLoading("fpBtn1",true);
  try{
    const data=await apiJson(API_AUTH.FORGOT,{body:{username:ident}});
    fp.ident=ident;
    fpSetStep(2);
    fpMsg("fpOk2",data.message||"If that account has a verified email, a code is on its way.");
    fpStartCooldown(data.cooldownSeconds);
  }catch(err){
    fpMsg("fpErr1",err.message||"Could not send the code.");
    shakeInput("fpUser");
  }finally{setBtnLoading("fpBtn1",false);}
});

/* step 2 — enter the code (digits only; paste-friendly) */
fpEl("fpOtp").addEventListener("input",(e)=>{e.target.value=e.target.value.replace(/\D/g,"").slice(0,6);});
fpEl("forgotForm2").addEventListener("submit",async(e)=>{
  e.preventDefault();
  if(fpEl("fpBtn2").disabled)return;
  const otp=fpEl("fpOtp").value.replace(/\D/g,"");
  fpMsg("fpErr2","");
  if(otp.length!==6){fpMsg("fpErr2","Enter the 6-digit code from your email.");shakeInput("fpOtp");return;}
  setBtnLoading("fpBtn2",true);
  try{
    await apiJson(API_AUTH.VERIFY_OTP,{body:{username:fp.ident,otp,purpose:"reset"}});
    fp.otp=otp;
    fpSetStep(3);
  }catch(err){
    fpMsg("fpErr2",err.message||"That code didn't work.");
    fpEl("fpOtp").value="";shakeInput("fpOtp");fpEl("fpOtp").focus();
  }finally{setBtnLoading("fpBtn2",false);}
});
fpEl("fpResend").addEventListener("click",async()=>{
  const btn=fpEl("fpResend");
  if(btn.disabled||!fp.ident)return;
  btn.disabled=true;btn.textContent="Sending…";fpMsg("fpErr2","");
  try{
    const data=await apiJson(API_AUTH.FORGOT,{body:{username:fp.ident}});
    fpMsg("fpOk2",data.message||"A new code is on its way.");
    fpEl("fpOtp").value="";
    fpStartCooldown(data.cooldownSeconds);
  }catch(err){
    fpMsg("fpOk2","");fpMsg("fpErr2",err.message||"Could not resend the code.");
    fpStartCooldown(err.data&&err.data.retryAfterSeconds||10);
  }
});

/* step 3 — new password + confirmation */
fpEl("forgotForm3").addEventListener("submit",async(e)=>{
  e.preventDefault();
  if(fpEl("fpBtn3").disabled)return;
  const pw=fpEl("fpNew").value,pw2=fpEl("fpConfirm").value;
  fpMsg("fpErr3","");
  if(pw.length<8||pw.length>72){fpMsg("fpErr3","Password must be between 8 and 72 characters.");shakeInput("fpNew");return;}
  if(pw!==pw2){fpMsg("fpErr3","The two passwords don't match.");shakeInput("fpConfirm");return;}
  setBtnLoading("fpBtn3",true);
  try{
    await apiJson(API_AUTH.RESET,{body:{username:fp.ident,otp:fp.otp,newPassword:pw}});
    const name=fp.ident.includes("@")?"":fp.ident; // an email isn't a login name — leave the username box as it was
    showLoginPanel();
    if(name)document.getElementById("loginUser").value=name;
    document.getElementById("loginPass").value="";
    document.getElementById("loginPass").focus();
    toast("Password updated — sign in with your new password","ti-check");
  }catch(err){
    if(err.status===400&&/code/i.test(err.message)){ // code expired / used up while typing the password
      fpSetStep(2);fpEl("fpOtp").value="";fpMsg("fpErr2",err.message+" Request a new one below.");
      if(fp.resendLeft<=0)fpStartCooldown(1);
    }else{
      fpMsg("fpErr3",err.message||"Could not reset the password.");
    }
  }finally{setBtnLoading("fpBtn3",false);}
});

/* ── Login form submit ── */
document.getElementById("loginForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  if(loginLockTimer!==null||document.getElementById("loginBtn").disabled)return; // locked (or a request is already running) — Enter key can't bypass the disabled button
  const username=normalizeUsername(document.getElementById("loginUser").value); // lowercase, trimmed (the server matches case-insensitively)
  const password=document.getElementById("loginPass").value;
  setLoginError("");
  if(!username||!password){
    setLoginError("Enter your username and password.");
    if(!username)shakeInput("loginUser");
    if(!password)shakeInput("loginPass");
    return;
  }
  setBtnLoading("loginBtn",true);
  try{
    const data=await apiLogin(username,password);
    const accountName=data.user?.username||username;
    const accountId=resolveUserId(data); // throws → login stops; we never fall back to a shared namespace
    setAuthToken(data.token);
    localStorage.setItem(LS.CURRENT_USER,accountName);
    setCurrentUid(accountId,accountName); // must run before any p()/g() call below — opens THIS account's own namespace (id e.g. 3 → md_*_v4_3)
    /* Cloud storage: the server is the source of truth. Fetch this account's data now (the login button keeps
       spinning meanwhile) and let it replace the local cache. If the cloud can't be reached we do NOT enter the
       app with stale local data — we undo the sign-in and say why. */
    let cloudPlan;
    try{cloudPlan=await cloudStartSession({uid:accountId,username:accountName,token:data.token});}
    catch(cloudFail){
      clearCurrentUid();setAuthToken(null);wipeLoggedInState();aiState={};
      throw cloudFail;
    }
    cloudQuiet(()=>{
      loadUserState(); // re-read the cache, which now holds the cloud copy (or the browser's own data awaiting an import decision)
      if(g(LS.USER)===null)p(LS.USER,accountName); // default display name only — never overwrite one the user already set
    });
    document.getElementById("loginScreen").classList.remove("show");
    const app=document.getElementById("mainApp");
    app.style.display="block";
    setTimeout(()=>{
      app.classList.add("show");
      cloudQuiet(()=>initMainApp()); // startup re-applies saved values (theme, overlay…): none of that is an edit to upload
      cloudAfterLogin(cloudPlan);    // import offer / push of leftover unsaved changes
    },50);
  }catch(err){
    document.getElementById("loginPass").value="";
    if(err.status===429){
      startLoginLock(err.data&&err.data.retryAfterSeconds,err.message); // allowance used up → LOCKED MM:SS
    }else{
      let msg=err.message||"Login failed.";
      if(err.status===401&&err.data&&Number.isInteger(err.data.attemptsLeft)){
        const left=err.data.attemptsLeft,max=Number(err.data.maxAttempts)||7;
        if(max-left>=LOGIN_WARN_FROM_FAILURE)msg=`${msg} ${left} attempt${left===1?"":"s"} left.`; // from the 3rd failure on
      }
      setLoginError(msg);
      shakeInput("loginPass");
      document.getElementById("loginPass").focus();
    }
  }finally{
    setBtnLoading("loginBtn",false);
  }
});

/* ── Register form submit ── */
/* Username rules (see utils.js): a–z, 0–9 and "-", at least 5 letters + 1 digit, lowercase, no spaces.
   Both the register and the login field lowercase as you type and turn spaces into hyphens. Login never
   VALIDATES the format — only register / username change do — so accounts made under older rules still log in. */
(function(){
  [["regUser","username"],["loginUser","username"]].forEach(([id,ac])=>{
    const el=document.getElementById(id);if(!el)return;
    el.setAttribute("autocapitalize","off");el.setAttribute("autocomplete",ac);el.setAttribute("spellcheck","false");el.setAttribute("maxlength",String(USERNAME_MAX));
    wireUsernameInput(el);
  });
})();
document.getElementById("registerForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const username=normalizeUsername(document.getElementById("regUser").value);
  const password=document.getElementById("regPass").value;
  setRegisterError("");setRegisterOk("");
  if(!username||!password){
    setRegisterError("Choose a username and password.");
    if(!username)shakeInput("regUser");
    if(!password)shakeInput("regPass");
    return;
  }
  const badName=usernameError(username); // every broken rule, one message
  if(badName){setRegisterError(badName);shakeInput("regUser");return;}
  setBtnLoading("registerBtn",true);
  try{
    await apiRegister(username,password);
    setRegisterOk("Account created — you can log in now.");
    setTimeout(()=>{
      showLoginPanel();
      document.getElementById("loginUser").value=username;
      document.getElementById("loginPass").focus();
      document.getElementById("registerForm").reset();
    },900);
  }catch(err){
    setRegisterError(err.message||"Registration failed.");
    shakeInput("regPass");
  }finally{
    setBtnLoading("registerBtn",false);
  }
});

/* ── Lock screen: re-prompt for the password without a full page reset.
   The token stays put — locking just hides the app until the same
   user re-authenticates against the backend.
   NOTE: nothing in the UI triggers this any more (the profile icon now opens Settings);
   it is only the safety net initMainApp() uses when it starts without a user id. ── */
function lockScreen(){
  stopAccountStatusPolling(); // no need to poll while logged out
  cloudEndSession({flush:true}); // send unsaved changes, then wipe this account's cache (background)
  clearCurrentUid(); // requirement 5: end this account's storage session cleanly
  resetUserSession(); // …then wipe this account's AI key/chat/wallpaper from memory + DOM (storage untouched)
  document.getElementById("mainApp").classList.remove("show");
  setTimeout(()=>{document.getElementById("mainApp").style.display="none";},500);
  document.getElementById("loginPass").value="";
  setLoginError("");
  showLoginScreen();
}

/* ═══════════════════════════════════════════════════
   PROFILE ICON → opens Settings (it used to lock the screen).
   Goes through the Settings button itself, so it behaves exactly like clicking the cog.
═══════════════════════════════════════════════════ */
(function wireProfileIcon(){
  const avatar=document.getElementById("userAvatar");
  // The profile icon opens the Discord-style profile popup (settings.js). If that file failed to load, fall back to Settings.
  const openProfile=()=>{
    if(typeof toggleProfilePopup==="function")toggleProfilePopup(avatar);
    else{document.getElementById("settingsBtn").click();if(typeof openSettingsTab==="function")openSettingsTab("account");}
  };
  avatar.setAttribute("aria-haspopup","dialog");avatar.setAttribute("aria-expanded","false");
  avatar.addEventListener("click",openProfile);
  avatar.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();openProfile();}
  });
})();

/* ═══════════════════════════════════════════════════
   SIGN OUT — a real logout (Settings → Session → Sign out).
   • JWT removed from localStorage (+ the remembered "current user" name)
   • storage session ended (CURRENT_UID = null → no per-user read/write possible)
   • in-memory account data, AI key/chat, wallpaper layers, open panels wiped
   • app hidden, login screen shown; background status polling stopped
   The account's data lives in the cloud (see cloud.js), so logging in again restores it; this device's cache of it is wiped
   (anything that could not be saved yet is kept and pushed at the next login).
   (The backend uses stateless JWTs, so the token is discarded here; it can't be revoked server-side.)
═══════════════════════════════════════════════════ */
function wipeLoggedInState(){
  try{
    apps=[];favs=new Set();notes=[];recent=[];searchHistory=[];
    activeFilter="All";searchQuery="";editingId=null;deletingId=null;openMenuId=null;
    ["grid","favsStrip","recentChips","tick","notesList","searchDropdown"].forEach(id=>document.getElementById(id)?.replaceChildren());
    document.getElementById("favsSection")?.classList.remove("visible");
  }catch(err){console.warn("[signOut] could not clear in-memory state",err);}
}

function signOut(){
  stopAccountStatusPolling();
  cloudEndSession({flush:true});              // 0. send any unsaved changes (with this session's own token), then wipe this account's cache — in the background
  setAuthToken(null);                         // 1. the JWT is gone from localStorage
  localStorage.removeItem(LS.CURRENT_USER);   //    …and so is the remembered "current user"
  clearCurrentUid();                          // 2. end the storage session (data stays saved, but is unreachable now)
  resetUserSession();                         // 3. wipe AI config/chat, wallpaper, open panels, half-typed forms
  wipeLoggedInState();                        //    …and the account's data held in memory / rendered in the hidden dashboard
  const main=document.getElementById("mainApp");
  main.classList.remove("show");main.style.display="none"; // 4. hide the app immediately (no fade that could flash data)
  document.getElementById("loginPass").value="";
  setLoginError("");
  showLoginScreen();                          // 5. back to the login page
}
document.getElementById("signOutBtn").addEventListener("click",signOut);

// Signed out in ANOTHER tab/window → sign this one out too (the token key was removed from localStorage).
window.addEventListener("storage",e=>{
  if((e.key===LS.TOKEN||e.key===null)&&!getAuthToken()&&document.getElementById("mainApp").classList.contains("show"))signOut();
});

/* ═══════════════════════════════════════════════════
   BLOCKED ACCOUNT OVERLAY
   Triggered by the periodic GET /api/auth/me check in main.js
   (checkAccountStatus / startAccountStatusPolling) the moment an
   admin blocks this account — no page refresh needed.
═══════════════════════════════════════════════════ */
function showBlockedScreen(){
  stopAccountStatusPolling();
  cloudEndSession({flush:false}); // a blocked account can't save — keep any unsaved areas for later, wipe the rest
  setAuthToken(null); // requirement 5: clear the token so the user can't continue
  clearCurrentUid(); // and end their storage session too
  resetUserSession(); // same wipe as lockScreen
  document.getElementById("mainApp").classList.remove("show");
  document.getElementById("mainApp").style.display="none";
  document.getElementById("loginScreen").classList.remove("show");
  document.getElementById("blockedScreen").classList.add("show");
}
function backToLoginFromBlocked(){
  document.getElementById("blockedScreen").classList.remove("show");
  document.getElementById("loginPass").value="";
  setLoginError("");
  showLoginScreen();
}
document.getElementById("backToLoginBtn").addEventListener("click",backToLoginFromBlocked);
