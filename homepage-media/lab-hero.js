/* Only the visible opening scene owns playback; model loading stays independent. */
(() => {
  const cover=document.querySelector('.lab-cover');
  const header=document.querySelector('body > header');
  const videos=[...document.querySelectorAll('.lab-scene-video')];
  const toggle=document.querySelector('.motion-toggle');
  const credits=document.querySelector('#lab-credits');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const mobile=matchMedia('(max-width:960px)');
  if(!cover || !videos.length) return;
  const shots=[...cover.querySelectorAll('.lab-shot')];
  const buttons=[...cover.querySelectorAll('.lab-scene-button')];
  const navigation=header.querySelector('.nav-links');
  const menu=header.querySelector('.lab-menu-toggle');
  const constrained=!!navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');
  let scene=0,visible=false,optedIn=false,userPaused=false,running=false;
  let elapsed=0,lastTime=0,lastPaint=0,motionFrame=0,layoutFrame=0;
  const duration=8500;
  function label(paused) {
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.querySelector('.motion-text').textContent=paused?'Play motion':'Pause motion';
  }
  function syncVideo() {
    videos.forEach((video,index)=>{
      if(running && scene===index) {
        if(!video.getAttribute('src')) { video.src=video.dataset.src; video.load(); }
        const playback=video.play();
        if(playback) playback.then(()=>{
          if(running && scene===index) video.classList.add('is-playing');
          else video.pause();
        }).catch(()=>{
          // Keep the corresponding still visible when autoplay is unavailable.
          video.classList.remove('is-playing');
        });
      } else video.pause();
    });
  }
  function chooseScene(index) {
    scene=index; elapsed=0;
    cover.dataset.scene=String(scene);
    cover.style.setProperty('--scene-progress','0');
    shots.forEach((shot,i)=>{ shot.classList.toggle('is-active',i===scene); shot.setAttribute('aria-hidden',String(i!==scene)); });
    buttons.forEach((button,i)=>{button.classList.toggle('is-active',i===scene);button.setAttribute('aria-pressed',String(i===scene));});
    syncVideo();
  }
  function tick(time) {
    motionFrame=0;
    if(!running) return;
    if(lastTime) elapsed+=Math.min(time-lastTime,200);
    lastTime=time;
    if(elapsed>=duration) chooseScene((scene+1)%shots.length);
    if(time-lastPaint>40) {cover.style.setProperty('--scene-progress',String(elapsed/duration));lastPaint=time;}
    motionFrame=requestAnimationFrame(tick);
  }
  function updateMotion() {
    running=visible && !document.hidden && !userPaused && (optedIn || (!reduced.matches && !constrained));
    cover.style.setProperty('--lab-motion',running?'running':'paused');
    cover.classList.toggle('motion-running',running);
    label(!running);
    if(running && !motionFrame) {lastTime=0;motionFrame=requestAnimationFrame(tick);}
    if(!running) {cancelAnimationFrame(motionFrame);motionFrame=0;lastTime=0;}
    syncVideo();
  }
  function setMenu(open,restore=false) {
    menu.setAttribute('aria-expanded',String(open));
    menu.querySelector('span').textContent=open?'Close':'Menu';
    navigation.classList.toggle('is-open',open);
    if(restore) menu.focus({preventScroll:true});
  }
  function updateLayout() {
    layoutFrame=0;
    const r=header.getBoundingClientRect();
    document.documentElement.style.setProperty('--lab-nav-height',`${r.bottom}px`);
    document.body.classList.toggle('lab-preview-at-top',cover.getBoundingClientRect().bottom>r.bottom+80 && cover.getBoundingClientRect().height>0);
  }
  function schedule() {if(!layoutFrame) layoutFrame=requestAnimationFrame(updateLayout);}
  updateLayout();
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  if('ResizeObserver' in window) new ResizeObserver(schedule).observe(header);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;updateMotion();schedule();},{threshold:.02}).observe(cover);
  document.addEventListener('visibilitychange',updateMotion);
  reduced.addEventListener('change',updateMotion);
  toggle.hidden=false;
  toggle.addEventListener('click',()=>{userPaused=running;if(!userPaused)optedIn=true;updateMotion();});
  buttons.forEach((button,i)=>button.addEventListener('click',()=>chooseScene(i)));
  cover.addEventListener('pointermove',event=>{
    if(!running || event.pointerType!=='mouse' || mobile.matches) return;
    const r=cover.getBoundingClientRect();
    cover.style.setProperty('--pointer-x',`${((event.clientX-r.left)/r.width-.5)*16}px`);
    cover.style.setProperty('--pointer-y',`${((event.clientY-r.top)/r.height-.5)*12}px`);
  },{passive:true});
  cover.addEventListener('pointerleave',()=>{cover.style.setProperty('--pointer-x','0px');cover.style.setProperty('--pointer-y','0px');});
  menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
  mobile.addEventListener('change',()=>setMenu(false));
  document.addEventListener('pointerdown',event=>{if(!header.contains(event.target))setMenu(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && menu.getAttribute('aria-expanded')==='true')setMenu(false,true);});
  [...navigation.querySelectorAll('a'),header.querySelector('.logo'),cover.querySelector('.lab-explore')].forEach(link=>{
    link.addEventListener('click',event=>{
      const target=document.querySelector(link.getAttribute('href'));
      if(!target)return;
      event.preventDefault();
      const fromOpenMenu=menu.getAttribute('aria-expanded')==='true';
      setMenu(false);
      if(link.getAttribute('href')==='#home' && target.classList.contains('map-active') && typeof window.closeInterestMap==='function') {
        window.closeInterestMap();
      }
      const offset=header.getBoundingClientRect().bottom+20;
      window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+scrollY-offset),behavior:reduced.matches?'instant':'smooth'});
      history.replaceState(null,'',link.getAttribute('href'));
      if(fromOpenMenu) {
        const focusTarget=target.querySelector('h2,h1') || target;
        const hadTabindex=focusTarget.hasAttribute('tabindex');
        if(!hadTabindex) focusTarget.setAttribute('tabindex','-1');
        focusTarget.focus({preventScroll:true});
        if(!hadTabindex) focusTarget.addEventListener('blur',()=>focusTarget.removeAttribute('tabindex'),{once:true});
      }
    });
  });
  document.querySelector('.credits-toggle').hidden=false;
  document.querySelector('.credits-toggle').addEventListener('click',()=>credits.showModal());
  document.querySelector('.lab-credits-close').addEventListener('click',()=>credits.close());
  credits.addEventListener('click',event=>{if(event.target===credits){const r=credits.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)credits.close();}});
})();
