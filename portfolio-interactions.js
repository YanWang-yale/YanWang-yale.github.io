/* Short research accounts fit their contents; long ones scroll within the viewport. */
(() => {
  const originalToggle = window.toggleActivity;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function addCompactClose(card, content) {
    if (content.querySelector('.research-panel-closebar')) return;
    const bar = document.createElement('div');
    bar.className = 'research-panel-closebar';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close details';
    if (content.id) close.setAttribute('aria-controls', content.id);
    close.addEventListener('click', () => {
      const button = card.querySelector('.research-header');
      window.toggleActivity(button);
      button.focus({preventScroll:true});
      const top = card.getBoundingClientRect().top + scrollY - (document.querySelector('header')?.getBoundingClientRect().height || 0) - 16;
      window.scrollTo({top:Math.max(0, top), behavior:reduced.matches ? 'instant' : 'smooth'});
    });
    bar.append(close);
    content.prepend(bar);
  }
  function sizePanel(card) {
    const content = card.querySelector('.research-content');
    const header = document.querySelector('header');
    const viewportHeight = Math.min(innerHeight, window.visualViewport?.height || innerHeight);
    const beforeContent = content.getBoundingClientRect().top - card.getBoundingClientRect().top;
    const headerHeight = header?.getBoundingClientRect().height || 0;
    const available = viewportHeight - headerHeight - beforeContent - 36;
    const naturalHeight = content.querySelector('.research-inner').getBoundingClientRect().height;
    const compact = available < Math.min(180, naturalHeight);
    card.classList.toggle('research-panel-compact', compact);
    if (compact) addCompactClose(card, content);
    // This is an upper bound; CSS uses the content's natural height below it.
    const limit = compact ? viewportHeight - headerHeight - 48 : Math.min(viewportHeight * .78, available);
    card.style.setProperty('--research-panel-height', `${Math.max(64, limit)}px`);
  }
  function openResearch(card, scroll = true) {
    const content = card.querySelector('.research-content');
    const button = card.querySelector('.research-header');
    card.classList.add('active');
    content.inert = false;
    button.setAttribute('aria-expanded', 'true');
    sizePanel(card);
    if (scroll) {
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 0;
      const cardRect = card.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      // On a short screen, put the body below the site header. Its sticky
      // Close details control remains available while the long title scrolls away.
      const top = (card.classList.contains('research-panel-compact') ? contentRect.top : cardRect.top) + scrollY - headerHeight - 16;
      window.scrollTo({top: Math.max(0, top), behavior: reduced.matches ? 'instant' : 'smooth'});
      if (card.classList.contains('research-panel-compact')) content.querySelector('.research-panel-closebar button').focus({preventScroll:true});
    }
  }
  window.toggleActivity = function(button) {
    const card = button.closest('.research-card');
    if (!card) { originalToggle(button); button.setAttribute('aria-expanded', String(button.parentElement.classList.contains('active'))); return; }
    if (card.classList.contains('active')) {
      card.classList.remove('active', 'research-panel-compact');
      card.querySelector('.research-content').inert = true;
      button.setAttribute('aria-expanded', 'false');
    } else openResearch(card);
  };
  function revealLinkedResearch() {
    const card = document.getElementById(location.hash.slice(1));
    if (card?.classList.contains('research-card')) openResearch(card);
  }
  let resizeFrame;
  function schedulePanelSizing() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => document.querySelectorAll('.research-card.active').forEach(sizePanel));
  }
  addEventListener('resize', schedulePanelSizing);
  window.visualViewport?.addEventListener('resize', schedulePanelSizing);
  // Header wrapping can change independently of window size, including font loading.
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(schedulePanelSizing);
    document.querySelectorAll('header, .research-header').forEach(element => observer.observe(element));
  }
  addEventListener('hashchange', revealLinkedResearch);
  document.addEventListener('DOMContentLoaded', revealLinkedResearch);
})();
