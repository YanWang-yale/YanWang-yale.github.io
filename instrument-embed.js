(() => {
  document.querySelectorAll('.instrument-showcase').forEach(showcase => {
  const load=showcase.querySelector('[data-load-model]'),close=showcase.querySelector('[data-close-model]');
  const preview=showcase.querySelector('.instrument-preview'),live=showcase.querySelector('.instrument-live');
  let frame;
  load.addEventListener('click',()=>{
    if(!frame){frame=document.createElement('iframe');frame.title='Proposed cage monitoring rig: interactive 3D model and simulated signal replay';frame.src=showcase.dataset.modelSrc||'instrument/';frame.allow='fullscreen';live.append(frame);}
    preview.hidden=true;preview.style.display='none';live.hidden=false;close.focus();
  });
  function unload(restoreFocus=false){
    // Releasing the iframe also releases its GPU resources and replay loop.
    frame?.remove();frame=null;live.hidden=true;preview.hidden=false;preview.style.display='';if(restoreFocus)load.focus();
  }
  close.addEventListener('click',()=>unload(true));
  });
})();
