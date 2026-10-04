/* ============================================================
   2048.JS
   ============================================================ */

/* ═══════════════════════════════════════
   2048
═══════════════════════════════════════ */
let g2048={};
function init2048(){
  document.getElementById('g2048Over').classList.remove('show');
  g2048={grid:Array.from({length:4},()=>Array(4).fill(0)),score:0,best:g2048.best||0};
  addTile();addTile();render2048();
}
function addTile(){
  const empty=[];
  g2048.grid.forEach((r,ri)=>r.forEach((c,ci)=>{if(!c)empty.push([ri,ci]);}));
  if(!empty.length)return;
  const[r,c]=empty[Math.floor(Math.random()*empty.length)];
  g2048.grid[r][c]=Math.random()<.9?2:4;
}
function render2048(){
  const board=document.getElementById('g2048Board');board.innerHTML='';
  g2048.grid.forEach(row=>row.forEach(v=>{
    const cell=document.createElement('div');
    cell.className=`g2048-cell ${v?'v'+Math.min(v,2048):'empty'}`;
    cell.textContent=v||'';
    board.appendChild(cell);
  }));
  document.getElementById('g2048Score').innerHTML=`<div class="score-pill active-turn">Score: ${g2048.score}</div><div class="score-pill">Best: ${Math.max(g2048.score,g2048.best)}</div>`;
}
function move2048(dir){
  let moved=false;
  const rotate=(g)=>g[0].map((_,i)=>g.map(r=>r[i]).reverse());
  let grid=g2048.grid;
  const rotations={up:1,down:3,left:0,right:2};
  const rots=rotations[dir]||0;
  for(let i=0;i<rots;i++)grid=rotate(grid);
  // slide left
  grid=grid.map(row=>{
    const r=row.filter(v=>v);
    for(let i=0;i<r.length-1;i++){if(r[i]===r[i+1]){r[i]*=2;g2048.score+=r[i];r.splice(i+1,1);moved=true;}}
    const newRow=[...r,...Array(4-r.length).fill(0)];
    if(newRow.some((v,i)=>v!==row[i]))moved=true;
    return newRow;
  });
  // unrotate
  for(let i=0;i<(4-rots)%4;i++)grid=rotate(grid);
  g2048.grid=grid;
  if(moved){addTile();render2048();if(checkWin2048())toast('🎉 You reached 2048!');}
  else if(isGameOver2048()){document.getElementById('g2048OverTitle').textContent=`Game Over — Score: ${g2048.score}`;document.getElementById('g2048OverScore').textContent='No more moves!';document.getElementById('g2048Over').classList.add('show');}
}
function checkWin2048(){return g2048.grid.some(r=>r.some(v=>v===2048));}
function isGameOver2048(){if(g2048.grid.some(r=>r.some(v=>v===0)))return false;for(let r=0;r<4;r++)for(let c=0;c<4;c++){if(c<3&&g2048.grid[r][c]===g2048.grid[r][c+1])return false;if(r<3&&g2048.grid[r][c]===g2048.grid[r+1][c])return false;}return true;}
document.addEventListener('keydown',e=>{
  if(currentGame!=='2048')return;
  if(e.key==='ArrowLeft'||e.key==='a'){move2048('left');e.preventDefault();}
  else if(e.key==='ArrowRight'||e.key==='d'){move2048('right');e.preventDefault();}
  else if(e.key==='ArrowUp'||e.key==='w'){move2048('up');e.preventDefault();}
  else if(e.key==='ArrowDown'||e.key==='s'){move2048('down');e.preventDefault();}
});
// Touch swipe for 2048
let t2Start={};
document.getElementById('g2048Board')?.addEventListener('touchstart',e=>{t2Start={x:e.touches[0].clientX,y:e.touches[0].clientY};});
document.addEventListener('touchend',e=>{
  if(currentGame!=='2048')return;
  const dx=e.changedTouches[0].clientX-t2Start.x,dy=e.changedTouches[0].clientY-t2Start.y;
  if(Math.abs(dx)>Math.abs(dy)){move2048(dx>0?'right':'left');}else{move2048(dy>0?'down':'up');}
});

