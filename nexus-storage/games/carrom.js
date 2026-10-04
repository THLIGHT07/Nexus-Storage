/* ============================================================
   CARROM.JS
   ============================================================ */

/* ═══════════════════════════════════════
   CARROM
═══════════════════════════════════════ */
let carromState={};
function initCarrom(){
  document.getElementById('carromOver').classList.remove('show');
  const canvas=document.getElementById('carromCanvas');
  const S=canvas.width;
  const pieces=[];
  // Place 9 black + 9 white + 1 red queen in center
  const center=S/2;
  [[0,-20],[20,-10],[20,10],[0,20],[-20,10],[-20,-10],[0,0],[10,-18],[-10,-18]].forEach(([dx,dy],i)=>{
    pieces.push({x:center+dx,y:center+dy,vx:0,vy:0,r:10,color:i%2===0?'#eee':'#333',pocket:false});
  });
  pieces.push({x:center,y:center,vx:0,vy:0,r:10,color:'#ff4d6a',queen:true,pocket:false});
  const striker={x:center,y:S-60,vx:0,vy:0,r:16,color:'#7c6fff',isStriker:true};
  carromState={S,pieces,striker,drag:null,score:[0,0],turn:0,shooting:false,phase:'aim'};
  let dragStart=null;
  canvas.onmousedown=e=>{
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const dx=mx-striker.x,dy=my-striker.y;
    if(Math.sqrt(dx*dx+dy*dy)<striker.r+5){dragStart={x:mx,y:my};carromState.phase='drag';}
  };
  canvas.onmousemove=e=>{
    if(!dragStart)return;
    const rect=canvas.getBoundingClientRect();
    carromState.aimX=e.clientX-rect.left;carromState.aimY=e.clientY-rect.top;
  };
  canvas.onmouseup=e=>{
    if(!dragStart)return;
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const dx=dragStart.x-mx,dy=dragStart.y-my;
    const power=Math.min(Math.sqrt(dx*dx+dy*dy),80);
    const angle=Math.atan2(dy,dx);
    striker.vx=Math.cos(angle)*power/8;striker.vy=Math.sin(angle)*power/8;
    carromState.phase='shoot';dragStart=null;
  };
  // Touch support
  canvas.ontouchstart=e=>{e.preventDefault();const t=e.touches[0];const rect=canvas.getBoundingClientRect();const mx=t.clientX-rect.left,my=t.clientY-rect.top;const dx=mx-striker.x,dy=my-striker.y;if(Math.sqrt(dx*dx+dy*dy)<striker.r+10){dragStart={x:mx,y:my};carromState.phase='drag';}};
  canvas.ontouchmove=e=>{e.preventDefault();if(!dragStart)return;const t=e.touches[0];const rect=canvas.getBoundingClientRect();carromState.aimX=t.clientX-rect.left;carromState.aimY=t.clientY-rect.top;};
  canvas.ontouchend=e=>{e.preventDefault();if(!dragStart)return;const t=e.changedTouches[0];const rect=canvas.getBoundingClientRect();const mx=t.clientX-rect.left,my=t.clientY-rect.top;const dx=dragStart.x-mx,dy=dragStart.y-my;const power=Math.min(Math.sqrt(dx*dx+dy*dy),80);const angle=Math.atan2(dy,dx);striker.vx=Math.cos(angle)*power/8;striker.vy=Math.sin(angle)*power/8;carromState.phase='shoot';dragStart=null;};
  if(gameLoops.carrom)cancelAnimationFrame(gameLoops.carrom);
  carromLoop();
}
function carromLoop(){
  const canvas=document.getElementById('carromCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  function frame(){
    gameLoops.carrom=requestAnimationFrame(frame);
    const s=carromState;const S=s.S;
    // Physics
    const allPieces=[...s.pieces,s.striker];
    allPieces.forEach(p=>{
      if(p.pocket)return;
      p.x+=p.vx;p.y+=p.vy;
      p.vx*=0.98;p.vy*=0.98;
      if(Math.abs(p.vx)<.05)p.vx=0;if(Math.abs(p.vy)<.05)p.vy=0;
      const margin=p.r+20;
      if(p.x<margin){p.x=margin;p.vx=Math.abs(p.vx)*.85;}
      if(p.x>S-margin){p.x=S-margin;p.vx=-Math.abs(p.vx)*.85;}
      if(p.y<margin){p.y=margin;p.vy=Math.abs(p.vy)*.85;}
      if(p.y>S-margin){p.y=S-margin;p.vy=-Math.abs(p.vy)*.85;}
      // Pocket detection
      const pockets=[[30,30],[S-30,30],[30,S-30],[S-30,S-30]];
      pockets.forEach(([px,py])=>{if(!p.isStriker&&Math.hypot(p.x-px,p.y-py)<p.r+12){p.pocket=true;if(p.queen){s.score[s.turn]+=3;}else{s.score[s.turn]+=1;}showScoreboard('carromScore',s.score.map((sc,i)=>({name:`P${i+1}`,score:sc,active:i===s.turn})));if(s.score[s.turn]>=12){document.getElementById('carromOverTitle').textContent=`🎯 Player ${s.turn+1} Wins!`;document.getElementById('carromOverMsg').textContent=`Score: ${s.score[s.turn]}`;document.getElementById('carromOver').classList.add('show');}}});
    });
    // Piece-piece collision
    for(let i=0;i<allPieces.length;i++)for(let j=i+1;j<allPieces.length;j++){
      const a=allPieces[i],b=allPieces[j];
      if(a.pocket||b.pocket)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<a.r+b.r&&d>0){
        const nx=dx/d,ny=dy/d,overlap=(a.r+b.r-d)/2;
        a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
        const rv=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
        if(rv>0){a.vx-=rv*nx*0.9;a.vy-=rv*ny*0.9;b.vx+=rv*nx*0.9;b.vy+=rv*ny*0.9;}
      }
    }
    // Check if all pieces stopped → next turn
    const moving=allPieces.some(p=>!p.pocket&&(Math.abs(p.vx)>.1||Math.abs(p.vy)>.1));
    if(!moving&&s.phase==='shoot'){s.phase='aim';s.striker.x=S/2;s.striker.y=S-60;s.striker.vx=0;s.striker.vy=0;s.turn=(s.turn+1)%2;}
    // Draw board
    ctx.fillStyle='#8B6914';ctx.fillRect(0,0,S,S);
    ctx.fillStyle='#C19A2A';ctx.fillRect(18,18,S-36,S-36);
    ctx.strokeStyle='#8B6914';ctx.lineWidth=2;ctx.strokeRect(30,30,S-60,S-60);
    ctx.strokeStyle='rgba(139,105,20,.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(S/2,S/2,60,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(30,30);ctx.lineTo(S-30,S-30);ctx.stroke();
    ctx.beginPath();ctx.moveTo(S-30,30);ctx.lineTo(30,S-30);ctx.stroke();
    // Pockets
    [[30,30],[S-30,30],[30,S-30],[S-30,S-30]].forEach(([px,py])=>{ctx.beginPath();ctx.arc(px,py,18,0,Math.PI*2);ctx.fillStyle='#1a1a2a';ctx.fill();});
    // Aim line
    if(s.phase==='drag'&&s.aimX&&s.aimY){
      ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(s.striker.x,s.striker.y);const dx=s.striker.x-s.aimX,dy=s.striker.y-s.aimY;const len=Math.sqrt(dx*dx+dy*dy);ctx.lineTo(s.striker.x+dx/len*100,s.striker.y+dy/len*100);ctx.stroke();ctx.setLineDash([]);
    }
    // Draw pieces
    [...s.pieces,s.striker].forEach(p=>{
      if(p.pocket)return;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.color;ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1.5;ctx.stroke();
      if(p.queen){ctx.font=`${p.r}px serif`;ctx.textAlign='center';ctx.fillText('★',p.x,p.y+p.r*.4);}
      if(p.isStriker){ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,p.r-4,0,Math.PI*2);ctx.strokeStyle='rgba(168,156,255,.5)';ctx.stroke();}
    });
    // Striker lane
    ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(50,S-80);ctx.lineTo(S-50,S-80);ctx.stroke();ctx.beginPath();ctx.moveTo(50,S-40);ctx.lineTo(S-50,S-40);ctx.stroke();
  }
  frame();
}

