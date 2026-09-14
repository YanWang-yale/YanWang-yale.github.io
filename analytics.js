/* Aggregate site statistics. No cookies, identifiers or page content are stored here. */
(() => {
  'use strict';
  const endpoints = {
    'yanwang-whu.github.io': 'https://yanwang-whu.goatcounter.com/count',
    'yanwang-yale.github.io': 'https://yanwang-yale.goatcounter.com/count'
  };
  const endpoint = endpoints[location.hostname];
  if (!endpoint || window.self !== window.top || navigator.globalPrivacyControl ||
      navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.webdriver) return;
  let source = '';
  try {
    const ref = new URL(document.referrer);
    if (ref.hostname !== location.hostname) source = ref.origin;
  } catch (_) {}
  const path = location.pathname.replace(/index\.html$/, '') || '/';
  window.goatcounter = {no_onload: true, no_events: true, endpoint, path, referrer: source};
  const queue = [];
  let loaded = false;
  function countEvent(name, title, everyClick = true) {
    const event = {path: name, title, event: true, no_session: everyClick, referrer: source};
    if (loaded) window.goatcounter.count(event);
    else if (queue.length < 10) queue.push(event);
  }
  document.addEventListener('click', event => {
    const target = event.target.closest?.('a,button');
    if (!target) return;
    const href = target.getAttribute('href') || '';
    let decoded = href;
    try { decoded = decodeURIComponent(href); } catch (_) {}
    if (/Yan Wang_CV\.pdf(?:[?#]|$)/i.test(decoded)) countEvent('cv-open', 'CV link clicks');
    else if (target.matches('[data-load-spatial]') || /^spatial\/(?:$|\?)/.test(href))
      countEvent('spatial-open', 'Spatial viewer opens');
    else if (target.matches('[data-load-model]') || /^instrument\/(?:$|\?)/.test(href))
      countEvent('instrument-open', 'Monitoring model opens');
    else if (/qplot\.html(?:[?#]|$)/.test(href)) countEvent('qplot-open', 'QPLOT example opens');
  }, {passive: true});
  const resume = document.querySelector('.resume-card');
  if (resume && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        countEvent('cv-view', 'Resume section views');
        observer.disconnect();
      }
    }, {threshold: 0.3});
    observer.observe(resume);
  }
  const script = document.createElement('script');
  script.src = 'https://gc.zgo.at/count.js';
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.onload = () => {
    if (!window.goatcounter.count || window.goatcounter.filter()) return;
    const getData = window.goatcounter.get_data;
    window.goatcounter.get_data = vars => {
      const data = getData(vars);
      delete data.q;
      delete data.s;
      return data;
    };
    loaded = true;
    window.goatcounter.count();
    countEvent('page-view', 'Page loads');
    countEvent('site-visit', 'Visits (8-hour deduplication estimate)', false);
    queue.splice(0).forEach(event => window.goatcounter.count(event));
  };
  script.onerror = () => { queue.length = 0; };
  document.head.append(script);
})();
