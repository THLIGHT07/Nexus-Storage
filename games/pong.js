/* ============================================================
   PONG.JS
   ============================================================ */

/* ═══════════════════════════════════════
   PONG
═══════════════════════════════════════ */
let pongState={};
function initPong(){
  document.getElementById('pongOver').classList.remove('show');
  const canvas=document.getElementById('pongCanvas');
  const W=canvas.width,H=canvas.height;
  pongState={W,H,ball:{x:W/2,y:H/2,vx:4*(Math.random()>.5?1:-1),vy:3*(Math.random()>.5?1:-1),r:8},
    p1:{y:H/2-40,score:0,h:80,speed:5},p2:{y:H/2-40,score:0,h:80,speed:4},
    running:false,mode:numPlayers===1?'ai':'pvp',keys:{}};
  canvas.onclick=()=>{pongState.running=!pongState.running;};
  if(gameLoops.pong)cancelAnimationFrame(gameLoops.pong);
  pongLoop();
}
function pongLoop(){
  const s=pongState;const canvas=document.getElementById('pongCanvas');
  if(!canvas){return;}const ctx=canvas.getContext('2d');
  function frame(){
    gameLoops.pong=requestAnimationFrame(frame);
    const{W,H,ball,p1,p2}=s;
    // Move paddles
    if(s.keys['w']||s.keys['W'])p1.y=Math.max(0,p1.y-p1.speed);
    if(s.keys['s']||s.keys['S'])p1.y=Math.min(H-p1.h,p1.y+p1.speed);
    if(s.mode==='pvp'){
      if(s.keys['ArrowUp'])p2.y=Math.max(0,p2.y-p2.speed);
      if(s.keys['ArrowDown'])p2.y=Math.min(H-p2.h,p2.y+p2.speed);
    }else{// AI
      const mid=p2.y+p2.h/2;if(mid<ball.y-5)p2.y=Math.min(H-p2.h,p2.y+p2.speed);else if(mid>ball.y+5)p2.y=Math.max(0,p2.y-p2.speed);
    }
    if(s.running){
      ball.x+=ball.vx;ball.y+=ball.vy;
      if(ball.y-ball.r<0||ball.y+ball.r>H)ball.vy*=-1;
      // P1 paddle (left)
      if(ball.x-ball.r<20&&ball.y>p1.y&&ball.y<p1.y+p1.h){ball.vx=Math.abs(ball.vx)*1.05;ball.vy+=(ball.y-(p1.y+p1.h/2))*.05;}
      // P2 paddle (right)
      if(ball.x+ball.r>W-20&&ball.y>p2.y&&ball.y<p2.y+p2.h){ball.vx=-Math.abs(ball.vx)*1.05;ball.vy+=(ball.y-(p2.y+p2.h/2))*.05;}
      ball.vx=Math.min(Math.max(ball.vx,-10),10);ball.vy=Math.min(Math.max(ball.vy,-10),10);
      if(ball.x<0){p2.score++;resetPong();}
      if(ball.x>W){p1.score++;resetPong();}
      if(p1.score>=7||p2.score>=7){
        const winner=p1.score>=7?'Player 1':'Player 2';
        document.getElementById('pongOverTitle').textContent=`🏓 ${winner} Wins!`;
        document.getElementById('pongOverMsg').textContent=`${p1.score} - ${p2.score}`;
        document.getElementById('pongOver').classList.add('show');s.running=false;
      }
    }
    // Draw
    ctx.fillStyle='#0a0a0f';ctx.fillRect(0,0,W,H);
    ctx.setLineDash([8,8]);ctx.strokeStyle='rgba(255,255,255,.1)';ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#7c6fff';ctx.beginPath();ctx.roundRect(10,p1.y,10,p1.h,4);ctx.fill();
    ctx.fillStyle='#ff4d6a';ctx.beginPath();ctx.roundRect(W-20,p2.y,10,p2.h,4);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();
    ctx.shadowColor='#fff';ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;
    ctx.font='bold 24px JetBrains Mono';ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.8)';
    ctx.fillText(p1.score,W/4,36);ctx.fillText(p2.score,3*W/4,36);
    if(!s.running){ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='14px JetBrains Mono';ctx.fillText('Click to '+(p1.score===0&&p2.score===0?'Start':'Resume'),W/2,H/2+4);}
    showScoreboard('pongScore',[{name:'P1',score:p1.score,active:true},{name:s.mode==='ai'?'CPU':'P2',score:p2.score,active:true}]);
  }
  frame();
}
function resetPong(){const{ball,W,H}=pongState;ball.x=W/2;ball.y=H/2;ball.vx=4*(Math.random()>.5?1:-1);ball.vy=3*(Math.random()>.5?1:-1);}
document.addEventListener('keydown',e=>{if(currentGame==='pong')pongState.keys[e.key]=true;});
document.addEventListener('keyup',e=>{if(currentGame==='pong')pongState.keys[e.key]=false;});

