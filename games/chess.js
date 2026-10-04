/* ============================================================
   CHESS.JS
   ============================================================ */

/* ═══════════════════════════════════════
   CHESS ENGINE
═══════════════════════════════════════ */
let chessState={};
const CHESS_PIECES={wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'};
const INIT_BOARD=[
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR']
];
function initChess(){
  document.getElementById('chessOver').classList.remove('show');
  document.getElementById('chessLog').innerHTML='';
  const mode=numPlayers===1?'ai':'pvp';
  chessState={board:INIT_BOARD.map(r=>[...r]),turn:'w',selected:null,possible:[],mode,lastMove:null,log:[]};
  renderChessBoard();
  document.getElementById('chessStatus').textContent="White's turn";
}
function renderChessBoard(){
  const board=document.getElementById('chessBoard');board.innerHTML='';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const cell=document.createElement('div');
    cell.className='chess-cell '+(((r+c)%2===0)?'light':'dark');
    const s=chessState;
    if(s.selected&&s.selected[0]===r&&s.selected[1]===c)cell.classList.add('selected');
    if(s.possible.some(p=>p[0]===r&&p[1]===c))cell.classList.add('possible');
    if(s.lastMove&&((s.lastMove[0][0]===r&&s.lastMove[0][1]===c)||(s.lastMove[1][0]===r&&s.lastMove[1][1]===c)))cell.classList.add('last-move');
    const piece=s.board[r][c];
    if(piece)cell.textContent=CHESS_PIECES[piece]||'';
    cell.onclick=()=>chessClick(r,c);
    board.appendChild(cell);
  }
}
function chessClick(r,c){
  const s=chessState;if(s.gameOver)return;
  if(s.mode==='ai'&&s.turn==='b')return;
  if(s.selected){
    if(s.possible.some(p=>p[0]===r&&p[1]===c)){
      chessMove(s.selected[0],s.selected[1],r,c);return;
    }
  }
  const piece=s.board[r][c];
  if(piece&&piece[0]===s.turn){s.selected=[r,c];s.possible=getChessMoves(r,c,s.board,s.turn);}
  else{s.selected=null;s.possible=[];}
  renderChessBoard();
}
function chessMove(fr,fc,tr,tc){
  const s=chessState;
  const moving=s.board[fr][fc];
  const captured=s.board[tr][tc];
  s.board[tr][tc]=moving;s.board[fr][fc]=null;
  // pawn promotion
  if(moving==='wP'&&tr===0)s.board[tr][tc]='wQ';
  if(moving==='bP'&&tr===7)s.board[tr][tc]='bQ';
  s.lastMove=[[fr,fc],[tr,tc]];s.selected=null;s.possible=[];
  const moveStr=`${moving} ${String.fromCharCode(97+fc)}${8-fr}→${String.fromCharCode(97+tc)}${8-tr}`;
  s.log.push(moveStr);
  const logEl=document.getElementById('chessLog');
  const entry=document.createElement('div');entry.className='chess-log-entry';entry.textContent=moveStr;
  logEl.appendChild(entry);logEl.scrollTop=logEl.scrollHeight;
  // check if king captured
  if(captured==='wK'){s.gameOver=true;endChess('Black wins! ♚');}
  else if(captured==='bK'){s.gameOver=true;endChess('White wins! ♔');}
  else{s.turn=s.turn==='w'?'b':'w';document.getElementById('chessStatus').textContent=`${s.turn==='w'?'White':'Black'}'s turn`;renderChessBoard();if(s.mode==='ai'&&s.turn==='b')setTimeout(chessAiMove,400);}
}
function getChessMoves(r,c,board,color){
  const moves=[];const piece=board[r][c];if(!piece)return moves;
  const opp=color==='w'?'b':'w';
  const add=(tr,tc)=>{if(tr<0||tr>7||tc<0||tc>7)return false;if(board[tr][tc]&&board[tr][tc][0]===color)return false;moves.push([tr,tc]);return !board[tr][tc];};
  const slide=(dr,dc)=>{let nr=r+dr,nc=c+dc;while(nr>=0&&nr<8&&nc>=0&&nc<8){if(board[nr][nc]){if(board[nr][nc][0]===opp)moves.push([nr,nc]);break;}moves.push([nr,nc]);nr+=dr;nc+=dc;}};
  const t=piece[1];
  if(t==='P'){const d=color==='w'?-1:1;const start=color==='w'?6:1;if(!board[r+d]?.[c])moves.push([r+d,c]);if(r===start&&!board[r+d][c]&&!board[r+2*d]?.[c])moves.push([r+2*d,c]);if(board[r+d]?.[c-1]?.[0]===opp)moves.push([r+d,c-1]);if(board[r+d]?.[c+1]?.[0]===opp)moves.push([r+d,c+1]);}
  else if(t==='N'){[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc));}
  else if(t==='B'){[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc));}
  else if(t==='R'){[[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));}
  else if(t==='Q'){[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));}
  else if(t==='K'){[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c+dc));}
  return moves;
}
function chessAiMove(){
  const s=chessState;if(s.gameOver)return;
  let bestMove=null,bestScore=-Infinity;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    if(s.board[r][c]?.[0]==='b'){
      const moves=getChessMoves(r,c,s.board,'b');
      moves.forEach(([tr,tc])=>{
        const sc=chessEval(r,c,tr,tc,s.board);
        if(sc>bestScore){bestScore=sc;bestMove=[r,c,tr,tc];}
      });
    }
  }
  if(bestMove)chessMove(bestMove[0],bestMove[1],bestMove[2],bestMove[3]);
  else endChess('White wins! (No moves for Black)');
}
function chessEval(fr,fc,tr,tc,board){
  const vals={P:10,N:30,B:30,R:50,Q:90,K:900};
  const target=board[tr][tc];
  return target?vals[target[1]]||0:0;
}
function endChess(msg){
  document.getElementById('chessOverTitle').textContent='♟ Game Over';
  document.getElementById('chessOverMsg').textContent=msg;
  document.getElementById('chessOver').classList.add('show');
}

