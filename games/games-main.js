/* ============================================================
   GAMES-MAIN.JS — Arcade router/lobby: screen switching,
   player-count selection, restart, toast, scoreboard, and
   the page-load bootstrap. Loads FIRST — every game file
   below depends on its shared helpers/state.
   ============================================================ */

/* ═══════════════════════════════════════
   GLOBAL STATE
═══════════════════════════════════════ */
let currentGame="lobby";
let numPlayers=2;
let gameLoops={};

function stopAllLoops(){
  Object.values(gameLoops).forEach(id=>{cancelAnimationFrame(id);clearInterval(id);});
  gameLoops={};
}

function showGame(id){
  stopAllLoops();
  currentGame=id;
  document.querySelectorAll('.game-screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.game-nav-btn').forEach(b=>b.classList.remove('active'));
  const screen=document.getElementById('screen-'+id);
  if(screen)screen.classList.add('active');
  const navBtns=document.querySelectorAll('.game-nav-btn');
  navBtns.forEach(b=>{if(b.getAttribute('onclick')?.includes(`'${id}'`))b.classList.add('active');});
  const titles={lobby:'🏠 Game Lobby',snake:'🐍 Snake',chess:'♟️ Chess',ludo:'🎲 Ludo',snakeladder:'🪜 Snakes & Ladders',ttt:'⭕ Tic Tac Toe','2048':'🔢 2048',memory:'🃏 Memory Match',tetris:'🟦 Tetris',pong:'🏓 Pong',flappy:'🐦 Flappy Bird',carrom:'🎯 Carrom'};
  document.getElementById('gameTitle').textContent=titles[id]||id;
  updatePlayerSelect(id);
  if(id!=='lobby')setTimeout(()=>restartGame(),50);
}

const playerCounts={snake:[1],chess:[1,2],ludo:[2,3,4],snakeladder:[2,3,4],ttt:[1,2],memory:[1,2],'2048':[1],tetris:[1],pong:[1,2],flappy:[1],carrom:[1,2]};
const playerColors=["#7c6fff","#ff4d6a","#3dffb0","#ffd166"];
const playerNames=["Purple","Red","Green","Gold"];
const playerEmojis=["🟣","🔴","🟢","🟡"];

function updatePlayerSelect(id){
  const wrap=document.getElementById('playerSelectWrap');
  wrap.innerHTML='';
  const counts=playerCounts[id];
  if(!counts||counts.length<=1){numPlayers=counts?counts[0]:1;return;}
  const sel=document.createElement('select');sel.className='player-select';
  counts.forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=`${n} Players`;if(n===numPlayers)o.selected=true;sel.appendChild(o);});
  sel.onchange=e=>{numPlayers=+e.target.value;restartGame();};
  wrap.appendChild(sel);
}

function restartGame(){
  const g=currentGame;
  if(g==='snake')initSnake();
  else if(g==='chess')initChess();
  else if(g==='ludo')initLudo();
  else if(g==='snakeladder')initSL();
  else if(g==='ttt')initTTT();
  else if(g==='2048')init2048();
  else if(g==='memory')initMemory();
  else if(g==='tetris')initTetris();
  else if(g==='pong')initPong();
  else if(g==='flappy')initFlappy();
  else if(g==='carrom')initCarrom();
}

function toggleScores(){toast('High scores coming soon! 🏆');}

let toastTimer;
function toast(msg,dur=2000){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),dur);
}

function showScoreboard(containerId,players){
  const el=document.getElementById(containerId);if(!el)return;
  const hex=c=>/^#[0-9a-fA-F]{6}$/.test(c)?c:"#888888";
  el.replaceChildren(...players.map((p,i)=>{
    const pill=document.createElement("div");
    pill.className="score-pill"+(p.active?" active-turn":"")+(p.winner?" winner":"");
    pill.style.borderColor=hex(playerColors[i])+"44";pill.style.color=hex(playerColors[i]);
    pill.textContent=`${playerEmojis[i]} ${p.name}: ${p.score}`; // textContent — names/scores are never parsed as HTML
    return pill;
  }));
}


/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
window.addEventListener('load',()=>{
  // Start with lobby visible
  document.getElementById('screen-lobby').classList.add('active');
});
