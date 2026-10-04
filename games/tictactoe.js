/* ============================================================
   TICTACTOE.JS
   ============================================================ */

/* ═══════════════════════════════════════
   TIC TAC TOE
═══════════════════════════════════════ */
let tttState={};
function setTTTMode(m){tttState.mode=m;initTTT();}
function initTTT(){
  document.getElementById('tttOver').classList.remove('show');
  tttState={board:Array(9).fill(null),turn:'X',mode:tttState.mode||'ai',scores:{X:0,O:0,D:0},...(tttState.scores?{scores:tttState.scores}:{})};
  renderTTT();
  document.getElementById('tttStatus').textContent="X's turn";
  showScoreboard('tttScore',[{name:'X',score:tttState.scores.X,active:tttState.turn==='X'},{name:'O',score:tttState.scores.O,active:tttState.turn==='O'}]);
}
function renderTTT(){
  const board=document.getElementById('tttBoard');board.innerHTML='';
  tttState.board.forEach((v,i)=>{
    const cell=document.createElement('div');cell.className='ttt-cell'+(v?' filled':'')+(v==='X'?' x-cell':'')+(v==='O'?' o-cell':'');
    cell.textContent=v||'';
    cell.onclick=()=>tttClick(i);
    board.appendChild(cell);
  });
}
function tttClick(i){
  const s=tttState;if(s.board[i]||s.gameOver)return;
  s.board[i]=s.turn;
  const win=checkTTTWin(s.board,s.turn);
  if(win){highlightTTTWin(win);endTTT(`${s.turn} Wins! 🎉`);return;}
  if(s.board.every(c=>c)){endTTT("Draw! 🤝");return;}
  s.turn=s.turn==='X'?'O':'X';
  document.getElementById('tttStatus').textContent=`${s.turn}'s turn`;
  renderTTT();
  if(s.mode==='ai'&&s.turn==='O')setTimeout(tttAI,300);
}
function tttAI(){
  const s=tttState;
  let move=minimax(s.board,'O').idx;
  if(move==null)move=s.board.findIndex(c=>!c);
  tttClick(move);
}
function minimax(board,player,depth=0){
  const win=checkTTTWin(board,'X');const winO=checkTTTWin(board,'O');
  if(winO)return{score:10-depth};if(win)return{score:depth-10};
  if(board.every(c=>c))return{score:0};
  const moves=[];
  board.forEach((c,i)=>{if(!c){const nb=[...board];nb[i]=player;const res=minimax(nb,player==='O'?'X':'O',depth+1);moves.push({idx:i,score:res.score});}});
  if(player==='O')return moves.reduce((b,m)=>m.score>b.score?m:b);
  return moves.reduce((b,m)=>m.score<b.score?m:b);
}
function checkTTTWin(board,p){
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return lines.find(l=>l.every(i=>board[i]===p))||null;
}
function highlightTTTWin(line){
  const cells=document.querySelectorAll('.ttt-cell');
  line.forEach(i=>cells[i].classList.add('win-cell'));
}
function endTTT(msg){
  tttState.gameOver=true;
  if(msg.includes('X Wins'))tttState.scores.X++;
  else if(msg.includes('O Wins'))tttState.scores.O++;
  else tttState.scores.D++;
  document.getElementById('tttOverTitle').textContent=msg;
  document.getElementById('tttOverMsg').textContent=`X:${tttState.scores.X} O:${tttState.scores.O} Draw:${tttState.scores.D}`;
  document.getElementById('tttOver').classList.add('show');
}

