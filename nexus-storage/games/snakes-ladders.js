/* ============================================================
   SNAKES-LADDERS.JS
   ============================================================ */

/* ═══════════════════════════════════════
   SNAKES AND LADDERS
═══════════════════════════════════════ */
const SL_SNAKES={99:78,94:56,87:24,62:18,54:34,17:7};
const SL_LADDERS={4:14,9:31,20:38,28:84,40:59,51:67,63:81,71:91};
let slState={};
function initSL(){
  document.getElementById('slOver').classList.remove('show');
  slState={np:numPlayers,turn:0,pos:Array(numPlayers).fill(0),rolling:false};
  drawSL();
  document.getElementById('slTurn').textContent=`${playerEmojis[0]} ${LUDO_NAMES[0]} — Roll!`;
  showScoreboard('slScore',slState.pos.map((p,i)=>({name:LUDO_NAMES[i],score:p,active:i===slState.turn})));
}
function drawSL(){
  const canvas=document.getElementById('slCanvas');const ctx=canvas.getContext('2d');
  const S=canvas.width,C=S/10;
  ctx.fillStyle='#111118';ctx.fillRect(0,0,S,S);
  // Draw 10x10 board
  for(let row=0;row<10;row++)for(let col=0;col<10;col++){
    const cellNum=cellToNum(row,col);
    const x=col*C,y=row*C;
    ctx.fillStyle=(row+col)%2===0?'#1a1a2e':'#14142a';
    ctx.fillRect(x,y,C,C);
    ctx.strokeStyle='rgba(255,255,255,.06)';ctx.strokeRect(x,y,C,C);
    ctx.fillStyle='rgba(255,255,255,.35)';ctx.font=`${C*.22}px JetBrains Mono`;ctx.textAlign='center';
    ctx.fillText(cellNum,x+C/2,y+C*.32);
    // Mark snakes and ladders
    if(SL_SNAKES[cellNum]){ctx.fillStyle='#ff4d6a';ctx.font=`${C*.4}px serif`;ctx.fillText('🐍',x+C*.6,y+C*.78);}
    if(SL_LADDERS[cellNum]){ctx.fillStyle='#3dffb0';ctx.font=`${C*.4}px serif`;ctx.fillText('🪜',x+C*.15,y+C*.78);}
  }
  // Draw players
  slState.pos.forEach((pos,i)=>{
    if(pos===0)return;
    const[row,col]=numToCell(pos);
    const px=col*C+C/2+(i%2-.5)*C*.28,py=row*C+C*.7+(i>1?C*.28:0);
    ctx.beginPath();ctx.arc(px,py,C*.22,0,Math.PI*2);
    ctx.fillStyle=LUDO_COLORS[i];ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`bold ${C*.22}px Syne`;ctx.textAlign='center';
    ctx.fillText(i+1,px,py+C*.08);
  });
}
function cellToNum(row,col){
  const n=(9-row)*10;
  return (9-row)%2===0?n+col+1:n+(9-col)+1;
}
function numToCell(n){
  const row=9-Math.floor((n-1)/10);
  const colInRow=(n-1)%10;
  const col=Math.floor((n-1)/10)%2===0?colInRow:9-colInRow;
  return[row,col];
}
function slRoll(){
  const s=slState;if(s.rolling)return;
  s.rolling=true;
  const diceEl=document.getElementById('slDice');
  diceEl.classList.add('rolling');
  const faces=['⚀','⚁','⚂','⚃','⚄','⚅'];
  const roll=Math.ceil(Math.random()*6);
  setTimeout(()=>{
    diceEl.classList.remove('rolling');diceEl.textContent=faces[roll-1];
    const i=s.turn;
    let newPos=Math.min(s.pos[i]+roll,100);
    let msg=`${playerEmojis[i]} Rolled ${roll}!`;
    if(SL_SNAKES[newPos]){const old=newPos;newPos=SL_SNAKES[newPos];msg+=` Snake! ${old}→${newPos} 😱`;}
    else if(SL_LADDERS[newPos]){const old=newPos;newPos=SL_LADDERS[newPos];msg+=` Ladder! ${old}→${newPos} 🎉`;}
    s.pos[i]=newPos;
    document.getElementById('slTurn').textContent=msg;
    drawSL();
    showScoreboard('slScore',s.pos.map((p,pi)=>({name:LUDO_NAMES[pi],score:p,active:pi===s.turn})));
    if(newPos>=100){
      document.getElementById('slOverTitle').textContent=`${playerEmojis[i]} ${LUDO_NAMES[i]} Wins!`;
      document.getElementById('slOverMsg').textContent=`Reached cell 100! 🏆`;
      document.getElementById('slOver').classList.add('show');
      s.rolling=false;return;
    }
    s.turn=(s.turn+1)%s.np;
    s.rolling=false;
    setTimeout(()=>{
      document.getElementById('slTurn').textContent=`${playerEmojis[s.turn]} ${LUDO_NAMES[s.turn]} — Roll!`;
      diceEl.textContent='🎲';
      // AI auto-roll for non-human players
      if(s.turn>0&&numPlayers>1)setTimeout(slRoll,800);
    },900);
  },400);
}

