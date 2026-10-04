/* ============================================================
   TETRIS.JS
   ============================================================ */

/* ═══════════════════════════════════════
   TETRIS
═══════════════════════════════════════ */
const TETROMINOS=[
  {shape:[[1,1,1,1]],color:'#3dffb0'},
  {shape:[[1,1],[1,1]],color:'#ffd166'},
  {shape:[[0,1,0],[1,1,1]],color:'#7c6fff'},
  {shape:[[1,0,0],[1,1,1]],color:'#ff4d6a'},
  {shape:[[0,0,1],[1,1,1]],color:'#a89cff'},
  {shape:[[0,1,1],[1,1,0]],color:'#3dffb0'},
  {shape:[[1,1,0],[0,1,1]],color:'#ff9966'},
];
let tetState={};
function initTetris(){
  document.getElementById('tetrisOver').classList.remove('show');
  tetState={grid:Array.from({length:20},()=>Array(10).fill(0)),score:0,level:1,lines:0,current:null,next:null,running:true,paused:false};
  tetState.next=randomTet();spawnTet();
  if(gameLoops.tetris)clearInterval(gameLoops.tetris);
  gameLoops.tetris=setInterval(tetStep,Math.max(100,600-tetState.level*50));
  drawTetris();
}
function randomTet(){const t=TETROMINOS[Math.floor(Math.random()*TETROMINOS.length)];return{...t,x:3,y:0,shape:t.shape.map(r=>[...r])};}
function spawnTet(){tetState.current=tetState.next?{...tetState.next,x:3,y:0}:randomTet();tetState.next=randomTet();drawNextTet();}
function tetStep(){
  if(!tetState.running||tetState.paused)return;
  if(!moveTet(0,1)){placeTet();clearLines();spawnTet();}
  drawTetris();
}
function moveTet(dx,dy){
  const{current:c,grid}=tetState;
  const nx=c.x+dx,ny=c.y+dy;
  if(checkCollision(c.shape,nx,ny,grid)){return false;}
  c.x=nx;c.y=ny;return true;
}
function rotateTet(){
  const c=tetState.current;
  const rotated=c.shape[0].map((_,i)=>c.shape.map(r=>r[i]).reverse());
  if(!checkCollision(rotated,c.x,c.y,tetState.grid))c.shape=rotated;
}
function checkCollision(shape,x,y,grid){
  return shape.some((row,ri)=>row.some((v,ci)=>{
    if(!v)return false;
    const nx=x+ci,ny=y+ri;
    return nx<0||nx>=10||ny>=20||(ny>=0&&grid[ny][nx]);
  }));
}
function placeTet(){
  const{current:c,grid}=tetState;
  c.shape.forEach((row,ri)=>row.forEach((v,ci)=>{if(v&&c.y+ri>=0)grid[c.y+ri][c.x+ci]=c.color;}));
  if(c.y<=0){
    tetState.running=false;clearInterval(gameLoops.tetris);
    document.getElementById('tetrisOverScore').textContent=`Score: ${tetState.score} · Level: ${tetState.level}`;
    document.getElementById('tetrisOver').classList.add('show');
  }
}
function clearLines(){
  let cleared=0;
  tetState.grid=tetState.grid.filter(row=>{if(row.every(v=>v)){cleared++;return false;}return true;});
  while(tetState.grid.length<20)tetState.grid.unshift(Array(10).fill(0));
  if(cleared){const pts=[0,100,300,500,800];tetState.score+=pts[cleared]*tetState.level;tetState.lines+=cleared;tetState.level=Math.floor(tetState.lines/10)+1;clearInterval(gameLoops.tetris);gameLoops.tetris=setInterval(tetStep,Math.max(100,600-tetState.level*50));}
  document.getElementById('tetrisScoreVal').textContent=tetState.score;
  document.getElementById('tetrisLevel').textContent=tetState.level;
  document.getElementById('tetrisLines').textContent=tetState.lines;
}
function drawTetris(){
  const canvas=document.getElementById('tetrisCanvas');const ctx=canvas.getContext('2d');
  const CW=canvas.width/10,CH=canvas.height/20;
  ctx.fillStyle='#0a0a0f';ctx.fillRect(0,0,canvas.width,canvas.height);
  // Grid
  tetState.grid.forEach((row,ri)=>row.forEach((v,ci)=>{
    if(v){ctx.fillStyle=v;ctx.fillRect(ci*CW+1,ri*CH+1,CW-2,CH-2);ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(ci*CW+1,ri*CH+1,CW-2,4);}
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.strokeRect(ci*CW,ri*CH,CW,CH);
  }));
  // Ghost piece
  const c=tetState.current;if(!c)return;
  let gy=c.y;while(!checkCollision(c.shape,c.x,gy+1,tetState.grid))gy++;
  c.shape.forEach((row,ri)=>row.forEach((v,ci)=>{if(v){ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect((c.x+ci)*CW+1,(gy+ri)*CH+1,CW-2,CH-2);}}));
  // Current piece
  c.shape.forEach((row,ri)=>row.forEach((v,ci)=>{if(v){ctx.fillStyle=c.color;ctx.fillRect((c.x+ci)*CW+1,(c.y+ri)*CH+1,CW-2,CH-2);ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect((c.x+ci)*CW+1,(c.y+ri)*CH+1,CW-2,4);}}));
}
function drawNextTet(){
  const canvas=document.getElementById('nextCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,80,80);
  const n=tetState.next;if(!n)return;
  const cw=80/4;
  n.shape.forEach((row,ri)=>row.forEach((v,ci)=>{if(v){ctx.fillStyle=n.color;ctx.fillRect(ci*cw+1,ri*cw+1,cw-2,cw-2);}}));
}
document.addEventListener('keydown',e=>{
  if(currentGame!=='tetris'||!tetState.running)return;
  if(e.key==='ArrowLeft'||e.key==='a'){moveTet(-1,0);drawTetris();e.preventDefault();}
  else if(e.key==='ArrowRight'||e.key==='d'){moveTet(1,0);drawTetris();e.preventDefault();}
  else if(e.key==='ArrowDown'||e.key==='s'){moveTet(0,1);drawTetris();e.preventDefault();}
  else if(e.key==='ArrowUp'||e.key==='w'){rotateTet();drawTetris();e.preventDefault();}
  else if(e.key===' '){while(moveTet(0,1));placeTet();clearLines();spawnTet();drawTetris();e.preventDefault();}
  else if(e.key==='p'){tetState.paused=!tetState.paused;}
});

