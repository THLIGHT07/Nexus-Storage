/* ============================================================
   FLAPPY.JS — Flappy Bird
   ============================================================ */

/* ═══════════════════════════════════════
   FLAPPY BIRD
═══════════════════════════════════════ */
let flappyState={};
function initFlappy(){
  document.getElementById('flappyOver').classList.remove('show');
  const canvas=document.getElementById('flappyCanvas');
  const W=canvas.width,H=canvas.height;
  flappyState={W,H,bird:{x:80,y:H/2,vy:0,r:14},pipes:[],score:0,running:false,started:false,frame:0};
  const flap=()=>{if(!flappyState.started){flappyState.started=true;flappyState.running=true;}flappyState.bird.vy=-7;};
  canvas.onclick=flap;
  document.removeEventListener('keydown',window._flappyKey);
  window._flappyKey=e=>{if(currentGame==='flappy'&&e.key===' '){flap();e.preventDefault();}};
  document.addEventListener('keydown',window._flappyKey);
  if(gameLoops.flappy)cancelAnimationFrame(gameLoops.flappy);
  flappyLoop();
}
function flappyLoop(){
  const canvas=document.getElementById('flappyCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  function frame(){
    gameLoops.flappy=requestAnimationFrame(frame);
    const s=flappyState;const{W,H,bird}=s;
    if(s.running){
      bird.vy+=0.4;bird.y+=bird.vy;
      s.frame++;
      if(s.frame%80===0){const gap=120,gapY=80+Math.random()*(H-200);s.pipes.push({x:W,top:gapY,bot:gapY+gap,passed:false});}
      s.pipes.forEach(p=>{p.x-=3;if(!p.passed&&p.x+40<bird.x){p.passed=true;s.score++;document.getElementById('flappyScore').innerHTML=`<div class="score-pill active-turn">🐦 Score: ${s.score}</div>`;}});
      s.pipes=s.pipes.filter(p=>p.x>-40);
      // collision
      const hit=bird.y-bird.r<0||bird.y+bird.r>H||s.pipes.some(p=>bird.x+bird.r>p.x&&bird.x-bird.r<p.x+40&&(bird.y-bird.r<p.top||bird.y+bird.r>p.bot));
      if(hit){s.running=false;document.getElementById('flappyOverScore').textContent=`Score: ${s.score}`;document.getElementById('flappyOver').classList.add('show');}
    }
    // Draw
    const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#0a0a1e');grad.addColorStop(1,'#0a1a0a');
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    // Pipes
    s.pipes.forEach(p=>{ctx.fillStyle='#3dffb0';ctx.fillRect(p.x,0,40,p.top);ctx.fillRect(p.x,p.bot,40,H-p.bot);ctx.fillStyle='#2dc290';ctx.fillRect(p.x-3,p.top-20,46,20);ctx.fillRect(p.x-3,p.bot,46,20);});
    // Bird
    ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.min(Math.max(bird.vy*.05,-.5),.5));
    ctx.font=`${bird.r*2}px serif`;ctx.textAlign='center';ctx.fillText('🐦',0,bird.r*.6);
    ctx.restore();
    // Ground
    ctx.fillStyle='#1a3a1a';ctx.fillRect(0,H-20,W,20);
    if(!s.started){ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='14px JetBrains Mono';ctx.textAlign='center';ctx.fillText('Tap / Space to start',W/2,H/2-30);}
  }
  frame();
}

