/* ============================================================
   Azi36 全站迷你播放器
   - 音乐页(music.js 掌管音频)：本脚本只当遥控——导航图标/popover 调 window.AziPlayer，
     并靠 'azi-now' 事件实时反映当前曲。
   - 其余页：本脚本自带音频引擎，从本地 mu-now/mu-queue 接力续播（上一首/下一首/历史），
     并把状态写回，回到音乐页时无缝接上。记忆退出用的就是这套。
   跨页真·无缝做不到（整页刷新会销毁音频），这里是「断点续播」：切页有极短重缓冲，
   浏览器自动播放被拦时图标上出现「继续」，点一下接着放。
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const LS = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 满了算了 */ } };
  // 纯文本读取也得包起来：无痕模式下 localStorage 一读就抛，会把整个播放器带走
  const LSt = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const LSd = (k) => { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } };
  const isMusic = !!document.querySelector('.mu-window');   // 音乐页：只当遥控，不自建音频
  const navSide = document.querySelector('.nav-side');
  // 图标要挂在导航「音乐」这一项后面。各页到 music/ 的相对深度不一样，
  // 音乐页自己那条还是 './'，所以认文字不认 href。
  const musicLink = [...document.querySelectorAll('.site-nav a')]
    .find((a) => a.textContent.trim() === '音乐');
  if (!musicLink && !navSide) return;

  const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60), x = Math.floor(s % 60);
    return m + ':' + String(x).padStart(2, '0');
  };
  const keyOf = (c) => (c ? (c.q ? 'qq:' + c.q : c.n ? 'ncm:' + c.n : c.u || c.t) : '');

  const cfg = () => ({
    qqUrl: LSt('mu-qq').replace(/\/$/, ''),
    apiUrl: LSt('mu-api').replace(/\/$/, ''),
    key: LSt('mu-qq-key'),
    apiCookie: LSt('mu-api-cookie'),
  });

  /* ---------- DOM：导航 EQ 图标 + popover ---------- */
  const ICN = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="4.6" height="16" rx="1.4"/><rect x="14.4" y="4" width="4.6" height="16" rx="1.4"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="19 20 9 12 19 4 19 20"/><rect x="4" y="5" width="2.4" height="14" rx="1"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17.6" y="5" width="2.4" height="14" rx="1"/></svg>',
  };
  const disc = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#e9e9ee"/><circle cx="20" cy="20" r="9" fill="none" stroke="#b8b8c2" stroke-width="1.6"/><circle cx="20" cy="20" r="2" fill="#b8b8c2"/></svg>');

  const wrap = document.createElement('div');
  wrap.className = 'nav-player';
  wrap.hidden = true;
  wrap.innerHTML = `
    <button class="np-icon" aria-label="正在播放" title="正在播放"><span class="np-eq"><i></i><i></i><i></i><i></i></span></button>
    <div class="np-pop" hidden>
      <button class="np-close" aria-label="关闭播放器" title="关闭播放器（停止播放）">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <div class="np-head">
        <img class="np-cover" alt="">
        <div class="np-meta"><b class="np-title">—</b><span class="np-sub"></span></div>
      </div>
      <div class="np-bar"><i class="np-fill"></i></div>
      <div class="np-time"><span class="np-cur">0:00</span><span class="np-dur">0:00</span></div>
      <div class="np-ctrl">
        <button class="np-prev" aria-label="上一首">${ICN.prev}</button>
        <button class="np-play big" aria-label="播放/暂停">${ICN.play}</button>
        <button class="np-next" aria-label="下一首">${ICN.next}</button>
        <a class="np-open" href="${isMusic ? '#' : (location.pathname.includes('/') && !location.pathname.endsWith('/') ? './' : '') + 'music/'}" aria-label="打开音乐频道" title="去音乐频道">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'}</a>
      </div>
    </div>`;
  // 正常情况下就住在导航胶囊里、「音乐」右边；万一哪天页面没有那一项，退回右侧头像前面
  if (musicLink) {
    musicLink.insertAdjacentElement('afterend', wrap);
  } else {
    navSide.insertBefore(wrap, navSide.querySelector('.nav-gh') || null);
  }
  // 修正「去音乐频道」链接的相对路径（子目录页面要回上级）
  const openLink = $('.np-open', wrap);
  if (!isMusic) {
    const depth = location.pathname.replace(/\/[^/]*$/, '/').split('/').filter(Boolean).length;
    openLink.setAttribute('href', (depth > 0 ? '../'.repeat(depth) : './') + 'music/');
  } else {
    openLink.setAttribute('href', './');
  }

  const el = {
    icon: $('.np-icon', wrap), pop: $('.np-pop', wrap), close: $('.np-close', wrap),
    cover: $('.np-cover', wrap), title: $('.np-title', wrap), sub: $('.np-sub', wrap),
    fill: $('.np-fill', wrap), cur: $('.np-cur', wrap), dur: $('.np-dur', wrap),
    play: $('.np-play', wrap), prev: $('.np-prev', wrap), next: $('.np-next', wrap),
  };

  /* popover 显隐：hover 展开，点击图标钉住/收起（移动端） */
  let pinned = false;
  const openPop = () => { el.pop.hidden = false; requestAnimationFrame(() => wrap.classList.add('open')); };
  const closePop = () => { wrap.classList.remove('open'); setTimeout(() => { if (!wrap.classList.contains('open')) el.pop.hidden = true; }, 180); };
  wrap.addEventListener('mouseenter', () => { if (!wrap.hidden) openPop(); });
  wrap.addEventListener('mouseleave', () => { if (!pinned) closePop(); });
  el.icon.addEventListener('click', (e) => { e.preventDefault(); pinned = !pinned; pinned ? openPop() : closePop(); });
  document.addEventListener('click', (e) => { if (pinned && !wrap.contains(e.target)) { pinned = false; closePop(); } });

  /* ---------- 关闭：点 × 就彻底收摊 ----------
     停止播放 + 抹掉跨页记忆 mu-now + 收起导航图标。
     下次在音乐页放歌，mu-now 重新写上，图标自己回来。 */
  let closed = false;
  let stopAudio = null;      // 非音乐页的音频引擎晚一点才建，建好后往这儿挂个停止入口
  const shutDown = () => {
    closed = true;
    pinned = false;
    if (isMusic) {
      // 音乐页的音频归 music.js 管，让它自己停（顺带清掉 mu-now）
      if (window.AziPlayer && window.AziPlayer.stop) window.AziPlayer.stop();
      else LSd('mu-now');
    } else {
      if (stopAudio) stopAudio();
      LSd('mu-now');
    }
    wrap.classList.remove('open', 'playing');
    el.pop.hidden = true;
    wrap.hidden = true;
  };
  el.close.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); shutDown(); });

  /* ---------- 渲染：把 mu-now 画到图标/popover ---------- */
  let curState = { c: null, p: 0, d: 0, pl: false };
  const paint = () => {
    const c = curState.c;
    if (closed) { wrap.hidden = true; return; }   // 关过就别再自己冒出来
    if (!c) { wrap.hidden = true; return; }
    wrap.hidden = false;
    el.cover.src = c.img || disc;
    el.title.textContent = c.t || '—';
    el.sub.textContent = c.s || '';
    el.cur.textContent = fmt(curState.p);
    el.dur.textContent = fmt(curState.d);
    el.fill.style.width = (curState.d ? Math.min(100, (curState.p / curState.d) * 100) : 0) + '%';
    el.play.innerHTML = curState.pl ? ICN.pause : ICN.play;
    wrap.classList.toggle('playing', !!curState.pl);
  };

  /* ============ 音乐页：遥控模式 ============ */
  if (isMusic) {
    const pull = () => {
      const now = LS('mu-now');
      curState = now && now.cur ? { c: now.cur, p: now.p, d: now.d, pl: now.pl } : { c: null };
      paint();
    };
    window.addEventListener('azi-now', pull);
    window.addEventListener('storage', (e) => { if (e.key === 'mu-now') pull(); });
    el.play.addEventListener('click', () => window.AziPlayer && window.AziPlayer.toggle());
    el.prev.addEventListener('click', () => window.AziPlayer && window.AziPlayer.prev());
    el.next.addEventListener('click', () => window.AziPlayer && window.AziPlayer.next());
    pull();
    // AziPlayer 可能晚于本脚本就绪，稍后再拉一次
    setTimeout(pull, 300);
    return;
  }

  /* ============ 其余页：独立音频引擎（断点续播） ============ */
  const now0 = LS('mu-now'), q0 = LS('mu-queue');
  if (!now0 || !now0.cur) { wrap.hidden = true; return; }   // 没听过歌，不出图标

  let queue = (q0 && q0.q) || [now0.cur];
  let idx = Math.max(0, Math.min(now0.i || 0, queue.length - 1));
  let kind = (q0 && q0.k) || now0.k || 'itunes';
  let playing = false;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = (() => { const v = parseInt(LSt('mu-vol'), 10); return Number.isNaN(v) ? 0.7 : v / 100; })();
  stopAudio = () => { audio.pause(); audio.removeAttribute('src'); };   // 供 × 关闭时叫停

  curState = { c: queue[idx] || now0.cur, p: now0.p || 0, d: now0.d || 0, pl: false };
  paint();

  const resolveUrl = (c) => {
    const g = cfg();
    if (!c) return Promise.resolve('');
    if (c.u) return Promise.resolve(c.u);                                   // iTunes 稳定直链
    if (c.q && g.qqUrl) return fetch(`${g.qqUrl}/song/url?id=${c.q}`, { headers: { 'X-Azi-Key': g.key } })
      .then((r) => r.json()).then((d) => (typeof d.data === 'string' ? d.data.replace(/^http:/, 'https:') : ''));
    if (c.n && g.apiUrl) return fetch(`${g.apiUrl}/song/url/v1?id=${c.n}&level=exhigh${g.apiCookie ? '&cookie=' + encodeURIComponent(g.apiCookie) : ''}&timestamp=${Date.now()}`, { headers: { 'X-Azi-Key': g.key } })
      .then((r) => r.json()).then((d) => ((d.data && d.data[0] && d.data[0].url) || '').replace(/^http:/, 'https:'));
    return Promise.resolve('');   // 本地 blob 跨页已死
  };

  const writeNow = () => {
    const c = queue[idx]; if (!c) return;
    LSs('mu-now', { cur: c, i: idx, p: audio.currentTime || 0, d: audio.duration || 0, pl: playing, k: kind, ts: Date.now() });
  };
  const pushHist = (c) => {
    if (!c) return;
    let h = LS('mu-history') || [];
    h = h.filter((x) => keyOf(x) !== keyOf(c));
    h.unshift(c);
    if (h.length > 60) h.length = 60;
    LSs('mu-history', h);
  };
  const setMedia = (c) => {
    if (!('mediaSession' in navigator) || !c) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: c.t || '', artist: c.a || 'Azi36', album: (q0 && q0.name) || 'Azi36' });
    } catch (e) { /* 不支持 */ }
  };

  let seekTo = 0;
  const cue = (doPlay) => {
    const c = queue[idx];
    curState.c = c; curState.pl = doPlay; paint();
    setMedia(c);
    resolveUrl(c).then((u) => {
      if (!u) { playing = false; curState.pl = false; paint(); return; }
      audio.src = u;
      if (doPlay) audio.play().then(() => { pushHist(c); }).catch(() => { playing = false; curState.pl = false; paint(); });   // 自动播放被拦→停在断点
    });
  };
  const go = (d) => {
    if (!queue.length) return;
    idx = (idx + d + queue.length) % queue.length;
    seekTo = 0;
    cue(true);
  };

  audio.addEventListener('loadedmetadata', () => {
    if (seekTo > 0 && audio.duration) { try { audio.currentTime = Math.min(seekTo, audio.duration - 1); } catch (e) { /* 拒了从头 */ } seekTo = 0; }
    curState.d = audio.duration || 0; paint();
  });
  audio.addEventListener('play', () => { playing = true; curState.pl = true; paint(); writeNow(); });
  audio.addEventListener('pause', () => { playing = false; curState.pl = false; paint(); writeNow(); });
  audio.addEventListener('ended', () => go(1));
  let thr = 0;
  audio.addEventListener('timeupdate', () => {
    curState.p = audio.currentTime; curState.d = audio.duration || curState.d;
    el.cur.textContent = fmt(curState.p); el.dur.textContent = fmt(curState.d);
    el.fill.style.width = (curState.d ? (curState.p / curState.d) * 100 : 0) + '%';
    const n = performance.now();
    if (playing && n - thr > 1000) { thr = n; writeNow(); }
  });
  el.play.addEventListener('click', () => {
    if (!audio.src) { seekTo = curState.p; cue(true); return; }   // 首次点击：resolve + 从断点放
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  });
  el.prev.addEventListener('click', () => go(-1));
  el.next.addEventListener('click', () => go(1));
  el.fill.parentElement.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const r = el.fill.parentElement.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => el.play.click());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => go(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => go(1));
    } catch (e) { /* 不支持 */ }
  }

  // 开页尝试续播（上次在放才接着放；被浏览器拦就 cue 在断点等点击）
  if (now0.pl) { seekTo = now0.p || 0; cue(true); }
  else { seekTo = now0.p || 0; }   // 暂停态：等用户点播放键再 resolve
})();
