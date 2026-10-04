/* ============================================================
   LUDO.JS
   ============================================================ */

/* ═══════════════════════════════════════
   LUDO
═══════════════════════════════════════ */
let ludoState={};
const LUDO_COLORS=['#7c6fff','#ff4d6a','#3dffb0','#ffd166'];
const LUDO_NAMES=['Purple','Red','Green','Gold'];
// Simple Ludo: each player has 4 tokens, board is 52 steps
function initLudo(){
  document.getElementById('ludoOver').classList.remove('show');
  const np=numPlayers;
  ludoState={
    numPlayers:np,turn:0,dice:0,rolled:false,
    tokens:Array.from({length:np},(_,i)=>Array.from({length:4},()=>-1)), // -1 = home
    scores:Array(np).fill(0),
    finished:Array(np).fill(false)
  };
  drawLudo();
  document.getElementById('ludoTurn').textContent=`${playerEmojis[0]} ${LUDO_NAMES[0]}'s turn — Roll!`;
  document.getElementById('ludoMoveBtn').disabled=true;
  showScoreboard('ludoScore',ludoState.scores.map((s,i)=>({name:LUDO_NAMES[i],score:s,active:i===ludoState.turn})));
}
function drawLudo(){
  const canvas=document.getElementById('ludoCanvas');
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#1a1a2a';ctx.fillRect(0,0,W,H);
  // Draw simple board representation
  const cs=W/13;
  // Center
  ctx.fillStyle='rgba(124,111,255,.15)';ctx.fillRect(5*cs,5*cs,3*cs,3*cs);
  ctx.strokeStyle='rgba(124,111,255,.3)';ctx.strokeRect(5*cs,5*cs,3*cs,3*cs);
  ctx.fillStyle='rgba(255,255,255,.6)';ctx.font=`${cs*.5}px Syne`;ctx.textAlign='center';ctx.fillText('🏠',W/2,H/2+cs*.2);
  // Draw colored home areas
  const corners=[[0,0],[10,0],[0,10],[10,10]];
  corners.slice(0,numPlayers).forEach(([cx,cy],i)=>{
    ctx.fillStyle=LUDO_COLORS[i]+'33';ctx.fillRect(cx*cs,cy*cs,3*cs,3*cs);
    ctx.strokeStyle=LUDO_COLORS[i]+'66';ctx.strokeRect(cx*cs,cy*cs,3*cs,3*cs);
    // tokens
    ludoState.tokens[i].forEach((pos,ti)=>{
      const tx=cx*cs+(ti%2+.5)*1.4*cs,ty=cy*cs+(Math.floor(ti/2)+.5)*1.4*cs;
      ctx.beginPath();ctx.arc(tx,ty,cs*.35,0,Math.PI*2);
      ctx.fillStyle=pos>=0?LUDO_COLORS[i]:LUDO_COLORS[i]+'66';ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
      if(pos>=0){ctx.fillStyle='#fff';ctx.font=`bold ${cs*.3}px JetBrains Mono`;ctx.fillText(pos,tx,ty+cs*.1);}
    });
  });
  // Path cells
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;
  for(let i=0;i<13;i++)for(let j=0;j<13;j++){
    if((i<3||i>9)&&(j<3||j>9))continue;
    if(i>=5&&i<=7&&j>=5&&j<=7)continue;
    ctx.strokeRect(i*cs,j*cs,cs,cs);
  }
}
function ludoRollDice(){
  if(ludoState.rolled)return;
  const dice=Math.ceil(Math.random()*6);
  ludoState.dice=dice;ludoState.rolled=true;
  const diceEl=document.getElementById('ludoDice');
  diceEl.classList.add('rolling');
  const faces=['⚀','⚁','⚂','⚃','⚄','⚅'];
  setTimeout(()=>{diceEl.classList.remove('rolling');diceEl.textContent=faces[dice-1];
    document.getElementById('ludoTurn').textContent=`${playerEmojis[ludoState.turn]} Rolled ${dice}! Move a token.`;
    document.getElementById('ludoMoveBtn').disabled=false;
  },400);
}
function ludoAutoMove(){
  const s=ludoState;if(!s.rolled)return;
  const i=s.turn;
  // Find token to move: prefer token already on board, or bring one out on 6
  let moved=false;
  for(let ti=0;ti<4;ti++){
    if(s.tokens[i][ti]===-1&&s.dice===6){s.tokens[i][ti]=0;moved=true;break;}
    else if(s.tokens[i][ti]>=0&&s.tokens[i][ti]+s.dice<=51){s.tokens[i][ti]+=s.dice;moved=true;break;}
  }
  if(!moved)toast(`${LUDO_NAMES[i]}: No valid move, turn skipped`);
  // Check win
  const wins=s.tokens[i].filter(t=>t>=51).length;
  if(wins===4){
    document.getElementById('ludoOverTitle').textContent=`🎉 ${LUDO_NAMES[i]} Wins!`;
    document.getElementById('ludoOverMsg').textContent=`${playerEmojis[i]} ${LUDO_NAMES[i]} finished all tokens!`;
    document.getElementById('ludoOver').classList.add('show');return;
  }
  s.rolled=false;document.getElementById('ludoMoveBtn').disabled=true;
  document.getElementById('ludoDice').textContent='🎲';
  s.turn=(s.turn+1)%s.numPlayers;
  document.getElementById('ludoTurn').textContent=`${playerEmojis[s.turn]} ${LUDO_NAMES[s.turn]}'s turn — Roll!`;
  showScoreboard('ludoScore',s.tokens.map((tk,pi)=>({name:LUDO_NAMES[pi],score:tk.filter(t=>t>=0).length,active:pi===s.turn})));
  drawLudo();
  // AI auto-play for AI players
  if(numPlayers>1&&s.turn>0){
    setTimeout(()=>{ludoRollDice();setTimeout(ludoAutoMove,600);},700);
  }
}

