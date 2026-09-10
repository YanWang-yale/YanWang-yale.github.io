/* Keep both spatial datasets out of the page until a visitor opens the viewer. */
(() => {
 document.querySelectorAll('.spatial-showcase').forEach(box=>{
  const preview=box.querySelector('.spatial-preview'),live=box.querySelector('.spatial-live'),load=box.querySelector('[data-load-spatial]'),close=box.querySelector('[data-close-spatial]');let frame;
  const resize=()=>dispatchEvent(new Event('resize'));
  function unload(focus=false){frame?.remove();frame=null;live.hidden=true;preview.hidden=false;if(focus)load.focus();resize();}
  load.addEventListener('click',()=>{if(!frame){frame=document.createElement('iframe');frame.title='Mouse and marmoset: interactive spatial transcriptomic comparison';frame.src='spatial/?embed=1';frame.allow='fullscreen';live.append(frame);}preview.hidden=true;live.hidden=false;close.focus();resize();});
  close.addEventListener('click',()=>unload(true));
  const card=box.closest('.research-card'),workspace=box.closest('.interest-map-workspace');
  const observer=new MutationObserver(()=>{if(frame&&((card&&!card.classList.contains('active'))||(workspace&&(workspace.hidden||!box.closest('.torpor-area-panel')?.classList.contains('active')||!box.closest('.interest-map-panel')?.classList.contains('active')))))unload();});
  if(card)observer.observe(card,{attributes:true,attributeFilter:['class']});
  if(workspace)observer.observe(workspace,{attributes:true,subtree:true,attributeFilter:['class','hidden']});
 });
})();
