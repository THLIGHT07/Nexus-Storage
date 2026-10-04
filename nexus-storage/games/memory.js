/* ============================================================
   MEMORY.JS — Memory Match
   ============================================================ */

/* ═══════════════════════════════════════
   MEMORY MATCH
═══════════════════════════════════════ */
let memState={};
const MEM_EMOJIS=['🎮','🎲','🎯','🎪','🎭','🎨','🎬','🎤','🎸','🎹','🎺','🎻','🏆','🥇','🎖','🏅'];
function initMemory(){
  document.getElementById('memOver').classList.remove('show');
  const pairs=8;
  const pool=MEM_EMOJIS.slice(0,pairs);
  const cards=[...pool,...pool].sort(()=>Math.random()-.5);
  memState={cards,flipped:[],matched:[],moves:0,lock:false,score:{},players:numPlayers,turn:0,pscores:Array(numPlayers).fill(0)};
  const board=document.getElementById('memBoard');
  const cols=Math.min(8,Math.ceil(Math.sqrt(cards.length*1.5)));
  board.style.gridTemplateColumns=`repeat(${cols},1fr)`;
  board.innerHTML='';
  cards.forEach((emoji,i)=>{
    const card=document.createElement('div');card.className='mem-card';
    card.innerHTML=`<span>${emoji}</span>`;
    card.dataset.i=i;card.onclick=()=>memFlip(i);
    board.appendChild(card);
  });
  showScoreboard('memScore',memState.pscores.map((s,i)=>({name:LUDO_NAMES[i],score:s,active:i===memState.turn})));
}
function memFlip(i){
  const s=memState;
  if(s.lock||s.flipped.includes(i)||s.matched.includes(i))return;
  s.flipped.push(i);
  const cards=document.querySelectorAll('.mem-card');
  cards[i].classList.add('flipped');
  if(s.flipped.length===2){
    s.moves++;s.lock=true;
    const[a,b]=s.flipped;
    if(s.cards[a]===s.cards[b]){
      s.matched.push(a,b);s.pscores[s.turn]++;
      cards[a].classList.add('matched');cards[b].classList.add('matched');
      s.flipped=[];s.lock=false;
      showScoreboard('memScore',s.pscores.map((sc,i)=>({name:LUDO_NAMES[i],score:sc,active:i===s.turn})));
      if(s.matched.length===s.cards.length){
        const winner=s.pscores.indexOf(Math.max(...s.pscores));
        document.getElementById('memOverMsg').textContent=`${playerEmojis[winner]} ${LUDO_NAMES[winner]} wins with ${s.pscores[winner]} pairs! ${s.moves} moves total.`;
        document.getElementById('memOver').classList.add('show');
      }
    }else{
      setTimeout(()=>{cards[a].classList.remove('flipped');cards[b].classList.remove('flipped');s.flipped=[];s.lock=false;s.turn=(s.turn+1)%s.players;showScoreboard('memScore',s.pscores.map((sc,pi)=>({name:LUDO_NAMES[pi],score:sc,active:pi===s.turn})));},900);
    }
  }
}

