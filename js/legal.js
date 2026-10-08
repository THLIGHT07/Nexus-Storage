/* ============================================================
   LEGAL.JS — behaviour for privacy.html + terms.html
   - splits the title into words for the staggered entrance
   - builds the table of contents from the page sections
   - scroll-reveal (IntersectionObserver), scroll-spy, progress bar
   - cursor spotlight on cards, back-to-top, condensed top bar
   Everything degrades gracefully: with JS off the page is still fully readable.
   ============================================================ */
(function(){
  "use strict";
  var doc=document,root=doc.documentElement;
  var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $=function(s,c){return (c||doc).querySelector(s);};
  var $$=function(s,c){return Array.prototype.slice.call((c||doc).querySelectorAll(s));};

  /* 1 ── Title: wrap each word so it can slide up one by one */
  var title=$(".lg-title");
  if(title&&!title.dataset.split){
    var words=title.textContent.trim().split(/\s+/);
    title.setAttribute("aria-label",title.textContent.trim());
    title.textContent="";
    words.forEach(function(w,i){
      var outer=doc.createElement("span");outer.className="w";outer.setAttribute("aria-hidden","true");
      var inner=doc.createElement("span");inner.textContent=w;inner.style.setProperty("--i",i);
      outer.appendChild(inner);title.appendChild(outer);
      if(i<words.length-1)title.appendChild(doc.createTextNode(" "));
    });
    title.dataset.split="1";
  }

  /* 2 ── Table of contents (built from <section class="lg-sec" data-toc="Title">) */
  var secs=$$(".lg-sec[id]");
  var tocList=$("#lgToc");
  var tocLinks=[];
  if(tocList){
    secs.forEach(function(sec,i){
      var li=doc.createElement("li"),a=doc.createElement("a"),n=doc.createElement("em");
      a.href="#"+sec.id;
      n.textContent=("0"+(i+1)).slice(-2);
      a.appendChild(n);
      a.appendChild(doc.createTextNode(sec.getAttribute("data-toc")||(($("h2",sec)||{}).textContent||"")));
      li.appendChild(a);tocList.appendChild(li);tocLinks.push(a);
      a.addEventListener("click",function(e){
        e.preventDefault();
        sec.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
        if(history.replaceState)history.replaceState(null,"","#"+sec.id);
      });
    });
  }

  /* 3 ── Scroll-reveal with a little stagger for siblings revealed together */
  var reveals=$$(".reveal");
  if(!("IntersectionObserver" in window)||reduce){
    reveals.forEach(function(el){el.classList.add("in");});
  }else{
    var io=new IntersectionObserver(function(entries){
      var batch=0;
      entries.forEach(function(en){
        if(!en.isIntersecting)return;
        en.target.style.setProperty("--d",batch++);   // stagger inside one batch
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    },{threshold:.08,rootMargin:"0px 0px -6% 0px"});
    reveals.forEach(function(el){io.observe(el);});
  }

  /* 4 ── Scroll-spy: highlight the section currently under the top bar */
  function setActive(id){
    tocLinks.forEach(function(a){
      var on=a.getAttribute("href")==="#"+id;
      a.classList.toggle("on",on);
      if(on)a.setAttribute("aria-current","true");else a.removeAttribute("aria-current");
      if(on&&window.innerWidth<=980&&a.parentNode.parentNode.scrollTo){ // keep the active chip in view on mobile
        var ol=a.parentNode.parentNode;
        ol.scrollTo({left:a.offsetLeft-ol.clientWidth/2+a.clientWidth/2,behavior:reduce?"auto":"smooth"});
      }
    });
  }
  if(secs.length&&"IntersectionObserver" in window){
    var visible={};
    var spy=new IntersectionObserver(function(entries){
      entries.forEach(function(en){visible[en.target.id]=en.isIntersecting?en.boundingClientRect.top:null;});
      var best=null;
      Object.keys(visible).forEach(function(id){if(visible[id]!==null&&(best===null||visible[id]<visible[best]))best=id;});
      if(best)setActive(best);
    },{rootMargin:"-70px 0px -55% 0px",threshold:0});
    secs.forEach(function(s){spy.observe(s);});
  }

  /* 5 ── Progress bar, condensed bar, back-to-top (one rAF-throttled scroll handler) */
  var bar=$(".lg-bar"),prog=$(".lg-progress"),topBtn=$(".lg-top"),ticking=false;
  function onScroll(){
    ticking=false;
    var y=window.pageYOffset||root.scrollTop,h=root.scrollHeight-window.innerHeight;
    if(prog)prog.style.transform="scaleX("+(h>0?Math.min(1,y/h):0)+")";
    if(bar)bar.classList.toggle("scrolled",y>10);
    if(topBtn)topBtn.classList.toggle("show",y>700);
  }
  window.addEventListener("scroll",function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
  window.addEventListener("resize",onScroll);
  onScroll();
  if(topBtn)topBtn.addEventListener("click",function(){window.scrollTo({top:0,behavior:reduce?"auto":"smooth"});});

  /* 6 ── Cursor spotlight on cards (skipped on touch devices) */
  if(!reduce&&window.matchMedia&&matchMedia("(hover:hover)").matches){
    $$(".lg-sec").forEach(function(card){
      var raf=0;
      card.addEventListener("pointermove",function(e){
        if(raf)return;
        raf=requestAnimationFrame(function(){
          raf=0;var r=card.getBoundingClientRect();
          card.style.setProperty("--mx",(e.clientX-r.left)+"px");
          card.style.setProperty("--my",(e.clientY-r.top)+"px");
        });
      });
    });
  }

  /* 7 ── Deep link (#section) on load: jump after layout is ready */
  if(location.hash){
    var t=doc.getElementById(location.hash.slice(1));
    if(t)setTimeout(function(){t.scrollIntoView({block:"start"});},350);
  }

  /* 8 ── Estimated reading time */
  var rt=$("#lgRead");
  if(rt){
    var text=($(".lg-content")||doc.body).textContent||"";
    rt.textContent=Math.max(1,Math.round(text.trim().split(/\s+/).length/210))+" min read";
  }
})();
