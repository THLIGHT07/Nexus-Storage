/* ============================================================
   SNAKE.JS
   ============================================================ */

/* ═══════════════════════════════════════
   SNAKE GAME
═══════════════════════════════════════ */
let snakeState={};
function initSnake(){
  document.getElementById('snakeOver').classList.remove('show');
  const canvas=document.getElementById('snakeCanvas'),ctx=canvas.getContext('2d');
  const S=20,W=canvas.width/S,H=canvas.height/S;
  let snake=[{x:10,y:10}],dir={x:1,y:0},nextDir={x:1,y:0},food={},score=0,running=true;
  function placeFood(){do{food={x:Math.floor(Math.random()*W),y:Math.floor(Math.random()*H)};}while(snake.some(s=>s.x===food.x&&s.y===food.y));}
  placeFood();
  function draw(){
    ctx.fillStyle='#0a0a0f';ctx.fillRect(0,0,canvas.width,canvas.height);
    // grid
    ctx.strokeStyle='rgba(255,255,255,.03)';
    for(let i=0;i<W;i++){ctx.beginPath();ctx.moveTo(i*S,0);ctx.lineTo(i*S,canvas.height);ctx.stroke();}
    for(let j=0;j<H;j++){ctx.beginPath();ctx.moveTo(0,j*S);ctx.lineTo(canvas.width,j*S);ctx.stroke();}
    // food
    ctx.fillStyle='#ff4d6a';ctx.beginPath();ctx.arc(food.x*S+S/2,food.y*S+S/2,S/2-2,0,Math.PI*2);ctx.fill();
    // glow on food
    ctx.shadowColor='#ff4d6a';ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;
    // snake
    snake.forEach((seg,i)=>{
      const alpha=i===0?1:0.85-i/snake.length*0.5;
      ctx.fillStyle=i===0?'#7c6fff':`rgba(124,111,255,${Math.max(0.2,alpha)})`;
      ctx.beginPath();ctx.roundRect(seg.x*S+1,seg.y*S+1,S-2,S-2,4);ctx.fill();
      if(i===0){ctx.shadowColor='#7c6fff';ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;}
    });
    // score
    ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='12px JetBrains Mono,monospace';ctx.fillText(`Score: ${score}`,8,16);
  }
  function step(){
    if(!running)return;
    dir={...nextDir};
    const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
    if(head.x<0||head.x>=W||head.y<0||head.y>=H||snake.some(s=>s.x===head.x&&s.y===head.y)){
      running=false;
      document.getElementById('snakeOverScore').textContent=`Score: ${score} · Length: ${snake.length}`;
      document.getElementById('snakeOver').classList.add('show');return;
    }
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y){score+=10;placeFood();}
    else snake.pop();
    draw();
    document.getElementById('snakeScore').innerHTML=`<div class="score-pill active-turn">🐍 Score: ${score}</div>`;
  }
  const interval=setInterval(step,120);gameLoops.snake=interval;draw();
  // controls
  const keyH=e=>{const m={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};const n=m[e.key];if(n&&!(n.x===-dir.x&&dir.x!==0)&&!(n.y===-dir.y&&dir.y!==0)){nextDir=n;e.preventDefault();}};
  document.removeEventListener('keydown',window._snakeKey);window._snakeKey=keyH;document.addEventListener('keydown',keyH);
  // touch swipe
  let tx=0,ty=0;
  canvas.ontouchstart=e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;};
  canvas.ontouchend=e=>{const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;if(Math.abs(dx)>Math.abs(dy)){nextDir=dx>0?{x:1,y:0}:{x:-1,y:0};}else{nextDir=dy>0?{x:0,y:1}:{x:0,y:-1};}};
}

