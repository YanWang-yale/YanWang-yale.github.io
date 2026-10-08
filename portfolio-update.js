(() => {
  const buttons = [...document.querySelectorAll('.interest-tag')];
  const popover = document.createElement('div');
  popover.id = 'interest-note-popover';
  popover.className = 'interest-note-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'region');
  popover.setAttribute('aria-labelledby', 'interest-note-title');
  const title = document.createElement('h4');
  title.id = 'interest-note-title';
  const note = document.createElement('p');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'interest-note-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close interest note');
  popover.append(title, note, close);
  document.body.append(popover);
  let current = null, pinned = false, leaveTimer, suppressFocus = false, hoverDismissedUntil = 0;

  function hideNote(returnFocus = false) {
    clearTimeout(leaveTimer);
    const previous = current;
    current?.setAttribute('aria-expanded', 'false');
    current = null;
    pinned = false;
    popover.hidden = true;
    // Hiding the panel can expose a tag directly underneath the close button.
    // Ignore that layout-generated hover so a deliberate close stays closed.
    if (returnFocus) hoverDismissedUntil = performance.now() + 300;
    if (returnFocus && previous && document.activeElement !== previous) {
      suppressFocus = true;
      previous.focus({preventScroll:true});
      suppressFocus = false;
    }
  }
  function positionNote() {
    if (!current || popover.hidden) return;
    const r = current.getBoundingClientRect();
    const h = window.visualViewport?.height || innerHeight;
    const w = window.visualViewport?.width || innerWidth;
    if (r.bottom < 0 || r.top > h) { hideNote(); return; }
    const box = popover.getBoundingClientRect();
    const below = r.bottom + 8;
    const top = below + box.height <= h - 12 ? below : Math.max(12, r.top - box.height - 8);
    popover.style.left = `${Math.max(12,Math.min(r.left,w - box.width - 12))}px`;
    popover.style.top = `${Math.max(12,Math.min(top,h - box.height - 12))}px`;
  }
  function showNote(button, pin = false) {
    clearTimeout(leaveTimer);
    current?.setAttribute('aria-expanded', 'false');
    current = button;
    pinned = pin;
    title.textContent = button.dataset.interestTitle;
    note.textContent = button.dataset.interestNote;
    popover.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    positionNote();
  }
  function scheduleHide() {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (!pinned && !popover.matches(':hover') && !popover.contains(document.activeElement) && document.activeElement !== current) hideNote();
    }, 180);
  }
  buttons.forEach(button => {
    button.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'touch' && performance.now() >= hoverDismissedUntil) showNote(button);
    });
    button.addEventListener('pointerleave', scheduleHide);
    button.addEventListener('focus', () => { if (!suppressFocus) showNote(button); });
    button.addEventListener('blur', scheduleHide);
    button.addEventListener('click', () => {
      if (current === button && pinned) hideNote();
      else showNote(button, true);
    });
  });
  popover.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
  popover.addEventListener('pointerleave', scheduleHide);
  popover.addEventListener('focusout', scheduleHide);
  close.addEventListener('click', () => hideNote(true));
  document.addEventListener('pointerdown', e => {
    if (current && !popover.contains(e.target) && !e.target.closest('.interest-tag')) hideNote();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && current) { hideNote(); e.preventDefault(); }
  });
  window.addEventListener('scroll', positionNote, true);
  window.addEventListener('resize', positionNote);

  const dialog = document.getElementById('ins1-poster-dialog');
  const image = dialog.querySelector('[data-poster-image]');
  const viewport = dialog.querySelector('.poster-viewport');
  let trigger = null, zoom = 1;
  function sizePoster() {
    const style = getComputedStyle(viewport);
    const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const maximumHeight = parseFloat(getComputedStyle(dialog).maxHeight);
    const toolbarHeight = dialog.querySelector('.poster-toolbar').getBoundingClientRect().height;
    const paddingHeight = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const height = maximumHeight
      - toolbarHeight
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2;
    const base = Math.min(width, height * 4 / 3);
    image.style.width = `${Math.round(base * zoom)}px`;
    dialog.style.height = `${Math.min(maximumHeight, Math.ceil(base * zoom * .75 + toolbarHeight + paddingHeight + 2))}px`;
    dialog.querySelector('[data-poster-zoom="out"]').disabled = zoom <= 1;
    dialog.querySelector('[data-poster-zoom="in"]').disabled = zoom >= 5;
  }
  document.querySelectorAll('[data-open-poster]').forEach(button => button.addEventListener('click', () => {
    hideNote();
    trigger = button;
    zoom = 1;
    if (!image.hasAttribute('src')) image.src = image.dataset.src;
    dialog.showModal();
    document.body.classList.add('poster-view-open');
    sizePoster();
    viewport.scrollTo({top:0,left:0});
    dialog.querySelector('[data-poster-close]').focus({preventScroll:true});
  }));
  dialog.querySelector('[data-poster-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('poster-view-open');
    trigger?.focus({preventScroll:true});
  });
  dialog.addEventListener('click', e => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    }
  });
  dialog.querySelectorAll('[data-poster-zoom]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.posterZoom;
    zoom = action === 'fit' ? 1 : Math.max(1,Math.min(5,zoom + (action === 'in' ? .75 : -.75)));
    sizePoster();
    if (zoom === 1) viewport.scrollTo({top:0,left:0});
  }));
  window.addEventListener('resize', () => { if (dialog.open) sizePoster(); });
})();
