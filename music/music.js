/* ============================================
   音乐电台 · Azi36 Radio v4
   自产曲库 / iTunes 搜索(30s) / 收藏 / 本地导入
   歌词：LRCLIB 开放接口 · 背景：频谱律动
   ============================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /* ---------- 封面 ---------- */
  const COVER = {
    ddz:
      '<svg viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" fill="#2e7d4e"/>' +
      '<ellipse cx="100" cy="96" rx="140" ry="120" fill="#3f9a63" opacity=".5"/>' +
      '<g transform="translate(100,104)">' +
      '<g transform="rotate(-16)"><rect x="-64" y="-38" width="42" height="60" rx="6" fill="#fff"/><text x="-57" y="-18" font-family="-apple-system,sans-serif" font-size="18" font-weight="800" fill="#23262d">3</text></g>' +
      '<g><rect x="-21" y="-44" width="42" height="60" rx="6" fill="#fff"/><text x="-14" y="-24" font-family="-apple-system,sans-serif" font-size="18" font-weight="800" fill="#c22f2f">A</text></g>' +
      '<g transform="rotate(16)"><rect x="24" y="-38" width="42" height="60" rx="6" fill="#fff"/><text x="30" y="-20" font-family="-apple-system,sans-serif" font-size="14" font-weight="800" fill="#c22f2f">王</text></g>' +
      '</g></svg>',
    tgf:
      '<svg viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" fill="#1c1d22"/>' +
      '<g fill="#2a2c34"><rect x="8" y="92" width="34" height="108"/><rect x="52" y="62" width="40" height="138"/><rect x="112" y="88" width="36" height="112"/><rect x="158" y="52" width="36" height="148"/></g>' +
      '<circle cx="100" cy="82" r="34" fill="#f5a623"/><circle cx="100" cy="82" r="26" fill="none" stroke="#c9871a" stroke-width="3"/>' +
      '<text x="100" y="93" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="30" font-weight="800" fill="#5b3a00">¥</text></svg>',
    aim:
      '<svg viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" fill="#251f33"/>' +
      '<circle cx="100" cy="100" r="62" fill="none" stroke="#463a66" stroke-width="10"/>' +
      '<circle cx="100" cy="100" r="40" fill="none" stroke="#7c5ce0" stroke-width="9" opacity=".75"/>' +
      '<circle cx="100" cy="100" r="20" fill="none" stroke="#463a66" stroke-width="8"/>' +
      '<circle cx="100" cy="100" r="7" fill="#ff5470"/></svg>',
    loc:
      '<svg viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" fill="#23262d"/>' +
      '<circle cx="100" cy="100" r="74" fill="#17181c"/>' +
      '<g fill="none" stroke="#2f333c" stroke-width="3"><circle cx="100" cy="100" r="62"/><circle cx="100" cy="100" r="48"/><circle cx="100" cy="100" r="34"/></g>' +
      '<circle cx="100" cy="100" r="20" fill="#d63384"/><circle cx="100" cy="100" r="6" fill="#17181c"/></svg>',
  };

  /* ---------- 歌单库 ---------- */
  const LRC_DDZ =
    '[00:00.00]（纯音乐）\n[00:04.00]二胡起手\n[00:12.00]古筝跟上\n[00:24.00]木鱼：哒\n' +
    '[00:36.00]弹指一挥，牌已出完\n[00:52.00]对面：要不起\n[01:10.00]（循环收尾，准备再来一局）';

  const PLAYLISTS = [
    {
      name: '自产自销',
      tracks: [
        { src: '../games/ddz/bgm.mp3', title: '出牌快感', sub: '斗地主主题曲 · 二胡×古筝×木鱼', cover: 'ddz', lrc: LRC_DDZ },
        { src: '../games/tgf/bgm.mp3', title: '深夜负重', sub: 'The Great Fusion 主题曲 · 钢琴×弦乐×脉冲', cover: 'tgf' },
        { src: '../games/aim/bgm.mp3', title: '心流', sub: '幽灵靶场主题曲 · Rhodes 匀速律动', cover: 'aim' },
      ],
    },
    { name: '搜索', dynamic: true, tracks: [] },
    { name: '收藏', fav: true, tracks: [] },
    { name: '本地', local: true, tracks: [] },
    { name: '歌单', opened: true, tracks: [] },   // 底部广场点开的 QQ 歌单落在这
    { name: '历史', history: true, tracks: [] },  // 播放历史
  ];
  const PL_HOT = 1, PL_FAV = 2, PL_LOC = 3, PL_OPEN = 4, PL_HIST = 5;
  const HOT_SEEDS = ['周杰伦', '林俊杰', '邓紫棋', '陈奕迅', '薛之谦', '汪苏泷'];
  const PAGE_SIZE = 10;

  /* 收藏：localStorage 持久化（本地导入的 blob 重开就死，不给收藏） */
  try { PLAYLISTS[PL_FAV].tracks = JSON.parse(localStorage.getItem('mu-favs') || '[]'); } catch (e) { /* 空手起家 */ }
  const saveFavs = () => localStorage.setItem('mu-favs', JSON.stringify(PLAYLISTS[PL_FAV].tracks));
  /* 稳定键：网关曲目播放前没有 src、且直链会过期，改用 songmid/id 认曲 */
  const favKey = (t) => t.qqMid ? 'qq:' + t.qqMid : t.ncmId ? 'ncm:' + t.ncmId : t.src;
  const isFaved = (t) => PLAYLISTS[PL_FAV].tracks.some((x) => favKey(x) === favKey(t));
  /* 收进收藏前洗掉易失字段：网关直链会过期，本地 blob/dbId 换设备就死，都别持久化 */
  const cleanFav = (t) => {
    const { lrcTried, dbId, ...keep } = t;
    if (keep.qqMid || keep.ncmId) delete keep.src;
    return keep;
  };
  const addFav = (t) => {
    if (isFaved(t)) return false;
    PLAYLISTS[PL_FAV].tracks.push(cleanFav(t));
    return true;
  };

  /* ---------- 跨页状态：正在放什么 / 队列 / 历史，全存本地，供全站迷你播放器接力 ---------- */
  const compact = (t) => ({
    t: t.title, s: t.sub, a: t.artist || '', img: t.img || '',
    q: t.qqMid || undefined, n: t.ncmId || undefined,
    u: (t.qqMid || t.ncmId || t.local) ? undefined : t.src,   // 只有 iTunes 直链稳定，能跨页
    c: t.cover || undefined, loc: t.local ? 1 : undefined,
  });
  const expand = (c) => ({
    title: c.t, name: c.t, sub: c.s, artist: c.a, img: c.img, imgBig: c.img,
    qqMid: c.q, ncmId: c.n, src: c.u || undefined, cover: c.c, local: !!c.loc,
  });
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 满了就算了 */ } };
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

  // 历史：开页捞回
  PLAYLISTS[PL_HIST].tracks = (lsGet('mu-history') || []).map((c) => (c.title ? c : expand(c)));
  const saveHistory = () => lsSet('mu-history', PLAYLISTS[PL_HIST].tracks.map(compact));
  const pushHistory = (t) => {
    if (!t) return;
    const arr = PLAYLISTS[PL_HIST].tracks;
    const k = favKey(t);
    const at = arr.findIndex((x) => favKey(x) === k);
    if (at >= 0) arr.splice(at, 1);
    arr.unshift(cleanFav(t));
    if (arr.length > 60) arr.length = 60;
    saveHistory();
    if (plView === PL_HIST) renderList();
  };

  // 正在播放 + 队列：写给全站迷你播放器
  let queueKind = '';
  const writeQueue = () => {
    const list = tracksOf(plPlay);
    lsSet('mu-queue', { name: PLAYLISTS[plPlay].name, k: source(), q: list.map(compact) });
    queueKind = source();
  };
  const writeNow = (playing) => {
    const t = nowTrack();
    if (!t) { localStorage.removeItem('mu-now'); return; }
    lsSet('mu-now', {
      cur: compact(t), i: cur, p: audio.currentTime || 0, d: audio.duration || 0,
      pl: !!playing, k: source(), ts: Date.now(),
    });
    window.dispatchEvent(new Event('azi-now'));   // 同页导航控件即时刷新
  };
  let nowThrottle = 0;
  let pendingSeek = 0;
  let queueSig = '';

  const ICN_PLAY = '<svg class="icn" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  const ICN_PAUSE = '<svg class="icn" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="4.6" height="16" rx="1.4"/><rect x="14.4" y="4" width="4.6" height="16" rx="1.4"/></svg>';
  const ICN_LOOP = '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';
  const ICN_LOOP1 = '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>';
  const ICN_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const ICN_DISC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3a9 9 0 0 1 0 18"/></svg>';

  /* ---------- 音源三选：iTunes 试听（默认）/ 网易云网关 / QQ 音乐网关 ---------- */
  let apiUrl = (localStorage.getItem('mu-api') || '').replace(/\/$/, '');
  let apiCookie = localStorage.getItem('mu-api-cookie') || '';
  let qqUrl = (localStorage.getItem('mu-qq') || '').replace(/\/$/, '');
  const source = () => {
    const s = localStorage.getItem('mu-source') || 'itunes';
    if (s === 'ncm' && !apiUrl) return 'itunes';
    if (s === 'qq' && !qqUrl) return 'itunes';
    return s;
  };
  const gwOn = () => source() !== 'itunes';
  /* 两个网关共用一把口令墙钥匙（公网网关不设防等于请全世界白嫖 VIP） */
  const qqKey = () => localStorage.getItem('mu-qq-key') || '';
  const gw = (path) =>
    fetch(apiUrl + path + (path.includes('?') ? '&' : '?') + 'timestamp=' + Date.now()
      + (apiCookie ? '&cookie=' + encodeURIComponent(apiCookie) : ''),
      { headers: { 'X-Azi-Key': qqKey() } })
      .then((r) => r.json());
  /* 不带 credentials：网关默认用服务端存的 cookie（data/cookie.json），
     浏览器无需回传凭证。去掉后跨域可用通配 *，file:// 本地也能测。 */
  const qq = (path, opts) => fetch(qqUrl + path, {
    ...opts,
    headers: { 'X-Azi-Key': qqKey(), ...(opts && opts.headers) },
  }).then((r) => r.json());

  const audio = new Audio();
  audio.preload = 'metadata';
  /* 网关模式不带 crossOrigin：音乐 CDN 无 CORS 头，带了整曲直接放不出；
     代价是频谱可视化退回呼吸模式（initViz 同步跳过，防 taint 静音） */
  audio.crossOrigin = gwOn() ? null : 'anonymous';

  /* ---------- 本地曲库：IndexedDB 存 blob，关页不丢 ---------- */
  const idb = () => new Promise((res, rej) => {
    const rq = indexedDB.open('mu-local', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  const idbAll = () => idb().then((db) => new Promise((res) => {
    const rq = db.transaction('tracks').objectStore('tracks').getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => res([]);
  })).catch(() => []);
  const idbAdd = (row) => idb().then((db) => new Promise((res) => {
    const rq = db.transaction('tracks', 'readwrite').objectStore('tracks').add(row);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => res(null);
  })).catch(() => null);
  const idbDel = (id) => idb().then((db) => db.transaction('tracks', 'readwrite').objectStore('tracks').delete(id)).catch(() => {});

  let plView = 0, plPlay = 0, cur = -1;
  let errStreak = 0, errTimer = null;
  let loopOne = localStorage.getItem('mu-loop') === '1';
  let lrcLines = [];
  const durCache = {};

  const tracksOf = (p) => PLAYLISTS[p].tracks;
  const nowTrack = () => (cur >= 0 ? tracksOf(plPlay)[cur] : null);

  const fmt = (s) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), x = Math.floor(s % 60);
    return m + ':' + String(x).padStart(2, '0');
  };

  /* ---------- 音量与淡入淡出：硬切是原罪 ---------- */
  const savedVol = parseInt(localStorage.getItem('mu-vol'), 10);
  let userVol = (Number.isNaN(savedVol) ? 70 : Math.min(100, Math.max(0, savedVol))) / 100;
  let fadeF = 1, fadeTimer = null;
  const applyVol = () => { audio.volume = Math.max(0, Math.min(1, userVol * fadeF)); };
  const fade = (to, ms, done) => {
    clearInterval(fadeTimer);
    const from = fadeF, t0 = performance.now();
    if (ms <= 0) { fadeF = to; applyVol(); if (done) done(); return; }
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      fadeF = from + (to - from) * k;
      applyVol();
      if (k >= 1) { clearInterval(fadeTimer); if (done) done(); }
    }, 30);
  };
  applyVol();

  /* ---------- 曲目单 ---------- */
  const thumbOf = (t) => t.img ? `<img src="${t.img}" alt="" loading="lazy">` : COVER[t.cover || 'loc'];

  const emptyText = (p) =>
    PLAYLISTS[p].dynamic ? (gwOn() ? `搜点什么听听——${source() === 'qq' ? 'QQ 音乐' : '网易云'}网关已接管，整首伺候` : '搜点什么听听——iTunes 正版接口，30 秒管饱；想听整首去右上角设置')
    : PLAYLISTS[p].fav ? '还没收藏——列表里点小心心，走的时候带上'
    : PLAYLISTS[p].local ? '把硬盘里的歌导进来——存进浏览器仓库（IndexedDB），关页不丢'
    : PLAYLISTS[p].history ? '还没听过歌——放几首，这儿记着你的足迹'
    : '空空如也';

  const renderList = () => {
    const list = tracksOf(plView);
    $('muSearch').hidden = !PLAYLISTS[plView].dynamic;
    $('muImport').hidden = !PLAYLISTS[plView].local;
    const op = PLAYLISTS[plView].opened && list.length;
    $('muOpened').hidden = !op;
    if (op) $('openName').textContent = PLAYLISTS[plView].name;
    renderPager();
    $('trackList').innerHTML = list.length
      ? list.map((t, i) => {
          const isNow = plView === plPlay && i === cur;
          const side = t.local
            ? `<button class="del" data-del="${i}" aria-label="移除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`
            : `<button class="fav ${isFaved(t) ? 'on' : ''}" data-fav="${i}" aria-label="收藏">${ICN_HEART}</button>`;
          return `<li data-i="${i}" class="${isNow ? 'on' : ''}${isNow && !audio.paused ? ' playing' : ''}">
            <span class="no">${String(i + 1).padStart(2, '0')}</span>
            <span class="mu-eq"><i></i><i></i><i></i></span>
            <span class="thumb">${thumbOf(t)}</span>
            <span class="meta"><b>${esc(t.title)}</b><span>${esc(t.sub)}</span></span>
            ${side}
            <span class="dur">${durCache[t.src] || (t.ncmId ? durCache['ncm' + t.ncmId] : '') || (t.qqMid ? durCache['qq' + t.qqMid] : '') || '…'}</span>
          </li>`;
        }).join('')
      : `<li class="mu-empty">${emptyText(plView)}</li>`;
  };

  /* 时长预读小工具 */
  const probeDur = (t) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = t.src;
    probe.addEventListener('loadedmetadata', () => { durCache[t.src] = fmt(probe.duration); renderList(); });
  };
  tracksOf(0).forEach(probeDur);

  /* 启动时从 IndexedDB 捞回本地曲库 */
  const rowToTrack = (row) => ({
    src: URL.createObjectURL(row.blob),
    title: row.name.replace(/\.[^.]+$/, ''),
    sub: `本地 · ${(row.name.split('.').pop() || '').toUpperCase()}`,
    cover: 'loc',
    local: true,
    dbId: row.id,
  });
  idbAll().then((rows) => {
    if (!rows.length) return;
    rows.forEach((row) => {
      const t = rowToTrack(row);
      PLAYLISTS[PL_LOC].tracks.push(t);
      probeDur(t);
    });
    renderTabs();
    renderList();
  });

  /* ---------- 搜索（iTunes 官方接口）+ 分页 ---------- */
  let hotQ = '', hotPage = 0, hotMore = false, searching = false;

  const renderPager = () => {
    const show = PLAYLISTS[plView].dynamic && hotQ && (hotPage > 0 || hotMore);
    $('muPager').hidden = !show;
    if (!show) return;
    $('pgInfo').textContent = `第 ${hotPage + 1} 页`;
    $('pgPrev').disabled = hotPage === 0;
    $('pgNext').disabled = !hotMore;
  };

  const doneSearch = (rows, more) => {
    hotMore = more;
    PLAYLISTS[PL_HOT].tracks = rows;
    searching = false;
    if (plView === PL_HOT) renderList();
  };
  const failSearch = () => {
    searching = false;
    if (plView === PL_HOT) $('trackList').innerHTML = '<li class="mu-empty">唱片行暂时联系不上，稍后再试</li>';
  };

  const itunesSearch = (q, page) => {
    if (searching) return;
    searching = true;
    hotQ = q; hotPage = page;
    $('trackList').innerHTML = '<li class="mu-empty">正在翻唱片架……</li>';
    $('muPager').hidden = true;

    if (source() === 'qq') {
      // QQ 网关：搜索，整曲直链播放时再取
      qq(`/search?key=${encodeURIComponent(q)}&pageNo=${page + 1}&pageSize=${PAGE_SIZE}`)
        .then((d) => {
          const list = (d.data && d.data.list) || [];
          const rows = list.map((s) => {
            const t = {
              qqMid: s.songmid,
              title: s.songname,
              name: s.songname,
              artist: (s.singer && s.singer[0] && s.singer[0].name) || '',
              sub: `${(s.singer || []).map((a) => a.name).join('/')} · ${s.albumname || '单曲'}`,
              img: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg` : '',
              imgBig: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${s.albummid}.jpg` : '',
            };
            if (s.interval) durCache['qq' + s.songmid] = fmt(s.interval);
            return t;
          });
          doneSearch(rows, list.length >= PAGE_SIZE);
        })
        .catch(failSearch);
      return;
    }

    if (source() === 'ncm') {
      // 网易云网关：搜索，整曲直链播放时再取
      gw(`/cloudsearch?keywords=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
        .then((d) => {
          const songs = (d.result && d.result.songs) || [];
          const rows = songs.map((s) => {
            const pic = (s.al && s.al.picUrl) || '';
            const t = {
              ncmId: s.id,
              title: s.name,
              name: s.name,
              artist: (s.ar && s.ar[0] && s.ar[0].name) || '',
              sub: `${(s.ar || []).map((a) => a.name).join('/')} · ${(s.al && s.al.name) || '单曲'}`,
              img: pic ? pic + '?param=200y200' : '',
              imgBig: pic ? pic + '?param=600y600' : '',
            };
            if (s.dt) durCache['ncm' + s.id] = fmt(s.dt / 1000);
            return t;
          });
          doneSearch(rows, songs.length >= PAGE_SIZE);
        })
        .catch(failSearch);
      return;
    }

    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&country=cn&media=music&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.results || []).filter((r) => r.previewUrl).map((r) => {
          const t = {
            src: r.previewUrl,
            title: r.trackName,
            name: r.trackName,
            artist: r.artistName,
            preview: true,   // 30 秒试听：歌词不做假同步
            sub: `${r.artistName} · ${r.collectionName || '单曲'}`,
            img: (r.artworkUrl100 || '').replace('100x100', '200x200'),
            imgBig: (r.artworkUrl100 || '').replace('100x100', '600x600'),
          };
          durCache[t.src] = '0:30';
          return t;
        });
        doneSearch(rows, (d.results || []).length >= PAGE_SIZE);
      })
      .catch(failSearch);
  };

  $('qBtn').addEventListener('click', () => { const q = $('qInput').value.trim(); if (q) itunesSearch(q, 0); });
  $('qInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('qBtn').click(); });
  $('pgPrev').addEventListener('click', () => { if (hotPage > 0) itunesSearch(hotQ, hotPage - 1); });
  $('pgNext').addEventListener('click', () => { if (hotMore) itunesSearch(hotQ, hotPage + 1); });

  /* ---------- 本地导入：浏览器能解的都吃，解不了的把话说明白 ---------- */
  const EXT_MIME = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
    ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg; codecs="opus"',
    wav: 'audio/wav', webm: 'audio/webm', mp4: 'audio/mp4',
  };
  const SNOB_EXTS = ['ape', 'wma', 'wv', 'dsf', 'dff', 'aiff', 'aif', 'tta', 'tak', 'mka'];

  $('impBtn').addEventListener('click', () => $('impFile').click());
  $('impFile').addEventListener('change', () => {
    const files = [...$('impFile').files];
    $('impFile').value = '';
    if (!files.length) return;
    const probe = document.createElement('audio');
    let added = 0;
    const snubbed = [];
    files.forEach((f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const mime = f.type || EXT_MIME[ext] || '';
      const playable = mime && probe.canPlayType(mime) !== '';
      if (!playable || SNOB_EXTS.includes(ext)) { snubbed.push(`${f.name}（.${ext}）`); return; }
      const row = { name: f.name, blob: f };
      idbAdd(row).then((id) => {
        row.id = id;
        const t = rowToTrack(row);
        PLAYLISTS[PL_LOC].tracks.push(t);
        probeDur(t);
        renderTabs();
        renderList();
      });
      added += 1;
    });
    $('impNote').textContent = snubbed.length
      ? `收下 ${added} 首；婉拒 ${snubbed.length} 首：${snubbed.slice(0, 3).join('、')}${snubbed.length > 3 ? '…' : ''}——APE/WMA/DSD 这类上古贵族格式浏览器不伺候，转成 FLAC/MP3 再来`
      : `收下 ${added} 首，已入库（关页不丢）`;
    renderList();
  });

  /* ---------- 歌词：本地 LRC 优先，搜来的歌问 LRCLIB（免费开放接口） ---------- */
  const parseLrc = (raw) => {
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      return m ? { t: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() } : null;
    }).filter(Boolean).sort((a, b) => a.t - b.t);
  };

  const renderLyrics = () => {
    const t = nowTrack();
    if (t && !t.lrc && !t.plain && !t.lrcTried && t.artist) {
      t.lrcTried = true;
      $('lyricsBox').innerHTML = '<p class="lrc-empty">找词中……</p>';
      fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(t.artist)}&track_name=${encodeURIComponent(t.name)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) { t.lrc = d.syncedLyrics || null; t.plain = d.plainLyrics || null; } })
        .catch(() => {})
        .finally(() => { if (nowTrack() === t) renderLyrics(); });
      return;
    }
    /* 30 秒试听是从整首里剪的，时间轴对不上——给整词自己看，不做假同步 */
    if (t && t.preview && (t.lrc || t.plain)) {
      lrcLines = [];
      const lines = t.lrc ? parseLrc(t.lrc).map((l) => l.text) : t.plain.split('\n');
      $('lyricsBox').innerHTML =
        '<p class="lrc-note">试听只有中段 30 秒，对不上时间轴——整词奉上，自己跟</p>' +
        lines.map((l) => `<p>${esc(l) || '…'}</p>`).join('');
      return;
    }
    lrcLines = parseLrc(t && t.lrc);
    if (lrcLines.length) {
      $('lyricsBox').innerHTML = lrcLines.map((l, i) => `<p data-l="${i}">${esc(l.text) || '…'}</p>`).join('');
    } else if (t && t.plain) {
      $('lyricsBox').innerHTML = t.plain.split('\n').map((l) => `<p>${esc(l) || '…'}</p>`).join('');
    } else {
      $('lyricsBox').innerHTML = `<p class="lrc-empty">${t ? (t.artist ? '这首没找到词——纯欣赏' : '纯音乐 · 闭眼听') : '还没放歌'}</p>`;
    }
  };

  const syncLyrics = () => {
    if (!lrcLines.length || $('lyricsBox').hidden) return;
    let idx = -1;
    for (let i = 0; i < lrcLines.length; i++) { if (audio.currentTime >= lrcLines[i].t) idx = i; else break; }
    const onEl = $('lyricsBox').querySelector('p.on');
    const tgt = $('lyricsBox').querySelector(`p[data-l="${idx}"]`);
    if (onEl && onEl !== tgt) onEl.classList.remove('on');
    if (tgt && tgt !== onEl) {
      tgt.classList.add('on');
      tgt.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const setView = (lrc) => {
    $('disc').hidden = lrc;
    $('lyricsBox').hidden = !lrc;
    $('viewDisc').classList.toggle('on', !lrc);
    $('viewLrc').classList.toggle('on', lrc);
    if (lrc) { renderLyrics(); syncLyrics(); }
  };
  $('viewDisc').addEventListener('click', () => setView(false));
  $('viewLrc').addEventListener('click', () => setView(true));

  /* ---------- 播放控制 ---------- */
  const renderNow = () => {
    const t = nowTrack();
    $('coverBox').innerHTML = t
      ? (t.imgBig || t.img ? `<img src="${t.imgBig || t.img}" alt="">` : COVER[t.cover || 'loc'])
      : COVER.aim;
    $('nowTitle').textContent = t ? t.title : '—';
    $('nowSub').textContent = t ? t.sub : '选一首开始';
    $('playBtn').innerHTML = audio.paused ? ICN_PLAY : ICN_PAUSE;
    $('disc').classList.toggle('spin', !!t && !audio.paused);
    renderList();
    if (!$('lyricsBox').hidden) renderLyrics();
    if (t && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist || 'Azi36', album: PLAYLISTS[plPlay].name,
      });
    }
  };

  const load = (p, i, andPlay) => {
    clearTimeout(errTimer);
    const n = tracksOf(p).length;
    if (!n) return;
    const startSrc = (u) => {
      audio.src = u;
      if (andPlay) {
        fadeF = 0; applyVol();
        audio.play().catch(() => {});
        fade(1, 700);   // 缓入
      }
      renderNow();
    };
    const doSwitch = () => {
      plPlay = p;
      cur = ((i % n) + n) % n;
      const t = tracksOf(p)[cur];
      const sig = plPlay + ':' + n + ':' + source();
      if (sig !== queueSig) { writeQueue(); queueSig = sig; }
      if (andPlay) pushHistory(t);
      if (t.src) return startSrc(t.src);
      if (t.qqMid && qqUrl) {
        renderNow();
        $('nowSub').textContent = '取整曲直链中……';
        qq(`/song/url?id=${t.qqMid}`)
          .then((d) => {
            const u = typeof d.data === 'string' ? d.data : '';
            if (!u) { $('nowSub').textContent = '这首拿不到整曲——cookie 过期或需要 VIP（设置里重新登记）'; return; }
            t.src = u.replace(/^http:/, 'https:');
            durCache[t.src] = durCache['qq' + t.qqMid] || '…';
            startSrc(t.src);
          })
          .catch(() => { $('nowSub').textContent = 'QQ 网关没接住，稍后再试'; });
        return;
      }
      if (t.ncmId && apiUrl) {
        // 网关曲目：播放时才取直链
        renderNow();
        $('nowSub').textContent = '取整曲直链中……';
        gw(`/song/url/v1?id=${t.ncmId}&level=exhigh`)
          .then((d) => {
            const u = d.data && d.data[0] && d.data[0].url;
            if (!u) { $('nowSub').textContent = '这首拿不到整曲——可能要登录或开 VIP（右上角设置扫码）'; return; }
            t.src = u.replace(/^http:/, 'https:');
            durCache[t.src] = durCache['ncm' + t.ncmId] || '…';
            startSrc(t.src);
          })
          .catch(() => { $('nowSub').textContent = '网关没接住，稍后再试'; });
      }
    };
    if (!audio.paused) fade(0, 160, doSwitch);   // 先缓出再换
    else doSwitch();
  };

  const toggle = () => {
    if (cur < 0) return load(plView, 0, true);
    if (audio.paused) { audio.play().catch(() => {}); fade(1, 450); }
    else { clearTimeout(errTimer); errStreak = 0; fade(0, 280, () => { audio.pause(); fadeF = 1; }); }
  };

  $('playBtn').addEventListener('click', toggle);
  $('prevBtn').addEventListener('click', () => load(plPlay, cur - 1, true));
  $('nextBtn').addEventListener('click', () => load(plPlay, cur + 1, true));

  $('plTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    plView = Number(b.dataset.p);
    renderTabs();
    renderList();
    if (PLAYLISTS[plView].dynamic && !tracksOf(plView).length && !hotQ) {
      const seed = HOT_SEEDS[Math.floor(Math.random() * HOT_SEEDS.length)];
      $('qInput').placeholder = `搜歌 / 搜歌手（垫场：${seed}）`;
      itunesSearch(seed, 0);
    }
  });

  $('trackList').addEventListener('click', (e) => {
    const delBtn = e.target.closest('.del');
    if (delBtn) {
      const i = Number(delBtn.dataset.del);
      const t = tracksOf(PL_LOC)[i];
      if (!t) return;
      if (t.dbId != null) idbDel(t.dbId);
      if (plPlay === PL_LOC && i === cur && !audio.paused) { audio.pause(); cur = -1; }
      try { URL.revokeObjectURL(t.src); } catch (err) { /* 已经散了 */ }
      tracksOf(PL_LOC).splice(i, 1);
      if (plPlay === PL_LOC && cur > i) cur -= 1;
      renderTabs();
      renderList();
      return;
    }
    const favBtn = e.target.closest('.fav');
    if (favBtn) {
      const t = tracksOf(plView)[Number(favBtn.dataset.fav)];
      if (!t) return;
      if (isFaved(t)) {
        PLAYLISTS[PL_FAV].tracks = PLAYLISTS[PL_FAV].tracks.filter((x) => favKey(x) !== favKey(t));
      } else {
        addFav(t);
      }
      saveFavs();
      renderList();
      return;
    }
    const li = e.target.closest('li');
    if (!li || li.dataset.i === undefined) return;
    const i = Number(li.dataset.i);
    if (plView === plPlay && i === cur) toggle();
    else load(plView, i, true);
  });

  audio.addEventListener('play', () => { initViz(); renderNow(); writeNow(true); });
  audio.addEventListener('pause', () => { renderNow(); writeNow(false); });
  audio.addEventListener('playing', () => { errStreak = 0; });
  audio.addEventListener('ended', () => {
    if (loopOne) { audio.currentTime = 0; audio.play().catch(() => {}); fade(1, 300); }
    else load(plPlay, cur + 1, true);
  });
  audio.addEventListener('error', () => {
    if (cur < 0) return;
    errStreak += 1;
    if (errStreak >= Math.min(3, tracksOf(plPlay).length)) {
      $('nowSub').textContent = '连着几首都放不出来，先歇了——多半是网络把外链掐了';
      $('playBtn').innerHTML = ICN_PLAY;
      $('disc').classList.remove('spin');
      return;
    }
    $('nowSub').textContent = '这首加载失败，试下一首';
    clearTimeout(errTimer);
    errTimer = setTimeout(() => load(plPlay, cur + 1, true), 800);
  });
  audio.addEventListener('loadedmetadata', () => {
    const t = nowTrack();
    if (t) { durCache[t.src] = fmt(audio.duration); renderList(); }
    if (pendingSeek > 0 && audio.duration) {   // 记忆退出：跳回断点
      try { audio.currentTime = Math.min(pendingSeek, audio.duration - 1); } catch (e) { /* 拒了就从头 */ }
      pendingSeek = 0;
    }
  });

  audio.addEventListener('timeupdate', () => {
    const p = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    $('progBar').style.width = p + '%';
    $('tCur').textContent = fmt(audio.currentTime);
    $('tDur').textContent = fmt(audio.duration);
    syncLyrics();
    const nowMs = performance.now();
    if (!audio.paused && nowMs - nowThrottle > 1000) { nowThrottle = nowMs; writeNow(true); }
  });
  $('progWrap').addEventListener('pointerdown', (e) => {
    if (!audio.duration) return;
    const r = $('progWrap').getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  const renderLoop = () => {
    $('loopBtn').innerHTML = loopOne ? ICN_LOOP1 : ICN_LOOP;
    $('loopBtn').classList.toggle('one', loopOne);
    $('loopBtn').title = loopOne ? '单曲循环' : '列表循环';
  };
  $('loopBtn').addEventListener('click', () => {
    loopOne = !loopOne;
    localStorage.setItem('mu-loop', loopOne ? '1' : '0');
    renderLoop();
  });

  $('vol').value = Math.round(userVol * 100);
  $('vol').addEventListener('input', () => {
    userVol = $('vol').value / 100;
    localStorage.setItem('mu-vol', $('vol').value);
    applyVol();
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('previoustrack', () => load(plPlay, cur - 1, true));
      navigator.mediaSession.setActionHandler('nexttrack', () => load(plPlay, cur + 1, true));
      navigator.mediaSession.setActionHandler('play', toggle);
      navigator.mediaSession.setActionHandler('pause', toggle);
    } catch (e) { /* 不支持就算了 */ }
  }

  const renderTabs = () => {
    $('plTabs').innerHTML = PLAYLISTS.map((p, i) =>
      ((p.opened || p.history) && !p.tracks.length)   // 「歌单」「历史」空着时先藏
        ? ''
        : `<button class="${i === plView ? 'on' : ''}" data-p="${i}">${esc(p.name)}<i>${p.dynamic ? '' : p.tracks.length}</i></button>`).join('');
  };

  /* ---------- 律动背景：Threads（WebGL 流动丝线，移植自 reactbits），振幅随音乐 ---------- */
  // 自产/iTunes 能读真频谱；网关曲（QQ/网易云）进 WebAudio 会被静音，故只在非网关时接分析器
  let actx = null, analyser = null, freq = null;
  const initViz = () => {
    if (gwOn()) return;
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8;
      src.connect(analyser); analyser.connect(actx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) { analyser = null; }
  };
  const canvas = $('viz');
  (() => {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
      || canvas.getContext('experimental-webgl', { alpha: true });
    if (!gl) { canvas.style.display = 'none'; return; }   // 没 WebGL 就别硬顶，宁可没有

    const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
    const FRAG = `precision highp float;
      uniform float iTime; uniform vec2 iResolution; uniform vec3 uColor;
      uniform float uAmplitude; uniform float uDistance; uniform vec2 uMouse;
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec2 fade(vec2 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
      float perlin(vec2 P){
        vec4 Pi=floor(P.xyxy)+vec4(0.0,0.0,1.0,1.0);vec4 Pf=fract(P.xyxy)-vec4(0.0,0.0,1.0,1.0);
        Pi=mod(Pi,289.0);vec4 ix=Pi.xzxz;vec4 iy=Pi.yyww;vec4 fx=Pf.xzxz;vec4 fy=Pf.yyww;
        vec4 i=permute(permute(ix)+iy);vec4 gx=2.0*fract(i*0.0243902439)-1.0;vec4 gy=abs(gx)-0.5;
        vec4 tx=floor(gx+0.5);gx=gx-tx;
        vec2 g00=vec2(gx.x,gy.x);vec2 g10=vec2(gx.y,gy.y);vec2 g01=vec2(gx.z,gy.z);vec2 g11=vec2(gx.w,gy.w);
        vec4 nrm=1.79284291400159-0.85373472095314*vec4(dot(g00,g00),dot(g01,g01),dot(g10,g10),dot(g11,g11));
        g00*=nrm.x;g01*=nrm.y;g10*=nrm.z;g11*=nrm.w;
        float n00=dot(g00,vec2(fx.x,fy.x));float n10=dot(g10,vec2(fx.y,fy.y));
        float n01=dot(g01,vec2(fx.z,fy.z));float n11=dot(g11,vec2(fx.w,fy.w));
        vec2 fx2=fade(Pf.xy);vec2 nx=mix(vec2(n00,n01),vec2(n10,n11),fx2.x);
        return 2.3*mix(nx.x,nx.y,fx2.y);
      }
      const float LW=3.5; const float LB=8.0;
      float px(float c){return (1.0/max(iResolution.x,iResolution.y))*c;}
      float lineFn(vec2 st,float w,float perc,vec2 mo,float t,float amp,float dist){
        float sp=0.1+perc*0.4;
        float an=smoothstep(sp,0.7,st.x);
        float fa=an*0.5*amp*(1.0+(mo.y-0.5)*0.2);
        float ts=t/10.0+(mo.x-0.5);
        float bl=smoothstep(sp,sp+0.05,st.x)*perc;
        float xn=mix(perlin(vec2(ts,st.x+perc)*2.5),perlin(vec2(ts,st.x+ts)*3.5)/1.5,st.x*0.3);
        float y=0.5+(perc-0.5)*dist+xn/2.0*fa;
        float ls=smoothstep(y+(w/2.0)+(LB*px(1.0)*bl),y,st.y);
        float le=smoothstep(y,y-(w/2.0)-(LB*px(1.0)*bl),st.y);
        return clamp((ls-le)*(1.0-smoothstep(0.0,1.0,pow(perc,0.3))),0.0,1.0);
      }
      void main(){
        vec2 uv=gl_FragCoord.xy/iResolution;
        float s=1.0;
        for(int i=0;i<40;i++){ float perc=float(i)/40.0;
          s*=(1.0-lineFn(uv,LW*px(1.0)*(1.0-perc),perc,uMouse,iTime,uAmplitude,uDistance)); }
        float c=1.0-s;
        gl_FragColor=vec4(uColor*c,c);
      }`;

    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const uTime = U('iTime'), uRes = U('iResolution'), uCol = U('uColor'),
      uAmp = U('uAmplitude'), uDist = U('uDistance'), uMouse = U('uMouse');

    // 颜色跟主题：浅色用频道主色（白底上清晰），深色提亮成淡粉（暗底上发光）
    const parseHex = (h) => {
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((h || '').trim());
      return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0.84, 0.20, 0.52];
    };
    const isDark = () => {
      const t = document.documentElement.getAttribute('data-theme');
      return t === 'dark' ? true : t === 'light' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;
    };
    let col = [0.84, 0.20, 0.52];
    const updateColor = () => {
      const b = parseHex(getComputedStyle(document.body).getPropertyValue('--brand'));
      col = isDark()
        ? [Math.min(1, b[0] * 0.5 + 0.5), Math.min(1, b[1] * 0.5 + 0.45), Math.min(1, b[2] * 0.5 + 0.5)]
        : b;
    };
    updateColor();
    try {
      new MutationObserver(updateColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateColor);
    } catch (e) { /* 老浏览器无所谓 */ }

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.floor(window.innerWidth * DPR), h = Math.floor(window.innerHeight * DPR);
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    window.addEventListener('resize', resize);
    resize();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied
    gl.clearColor(0, 0, 0, 0);

    let amp = 0.9, level = 0;   // level=当前音乐能量(0-1)，amp=缓动后喂给着色器的振幅
    const t0 = performance.now();
    const frame = () => {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      const tt = (performance.now() - t0) / 1000;
      const playing = !audio.paused && cur >= 0;
      let target = 0;
      if (playing) {
        if (analyser && freq) {                       // 真频谱：取低中频能量
          analyser.getByteFrequencyData(freq);
          const n = Math.min(freq.length, 48);
          let s = 0; for (let i = 0; i < n; i++) s += freq[i];
          target = Math.min(1, (s / n / 255) * 1.05);
        } else {                                       // 网关曲读不到谱：缓慢合成节拍顶着（放慢，别鬼畜）
          target = 0.20 + 0.10 * Math.abs(Math.sin(tt * 0.55)) + 0.07 * Math.abs(Math.sin(tt * 0.9 + 1.0));
        }
      }
      level += (target - level) * 0.05;                // 缓，避免跳
      amp += ((0.9 + level * 0.5) - amp) * 0.04;        // 振幅回到 ~1（reactbits 的发散形），随乐轻呼吸
      gl.uniform1f(uTime, tt * 0.6);                   // 流速降一档
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform3f(uCol, col[0], col[1], col[2]);
      gl.uniform1f(uAmp, amp);
      gl.uniform1f(uDist, 0.0);                        // 关键：0 → 丝线汇到一点再发散，不再摊成一条带
      // 没有鼠标：x 极缓自漂防呆板，y 由音乐能量轻推
      gl.uniform2f(uMouse, 0.5 + 0.07 * Math.sin(tt * 0.08), 0.5 + level * 0.12);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(frame);
  })();

  /* ---------- 设置：音源选择 + 双网关 ---------- */
  let qrTimer = null;
  const showPane = (src) => {
    document.querySelectorAll('#srcSeg button').forEach((b) => b.classList.toggle('on', b.dataset.src === src));
    document.querySelectorAll('.src-pane').forEach((p) => { p.hidden = p.dataset.pane !== src; });
  };
  $('setBtn').addEventListener('click', () => {
    $('apiUrl').value = apiUrl;
    $('qqUrl').value = qqUrl;
    $('qqKeyInput').value = qqKey();
    $('ncmKeyInput').value = qqKey();   // 两个网关共用一把口令
    showPane(localStorage.getItem('mu-source') || 'itunes');
    $('apiStatus').textContent = apiCookie ? '已登录（凭证存在本机）' : (apiUrl ? '网关已配置，未登录' : '');
    $('setModal').showModal();
  });

  /* 分段切换：点哪个就选哪个音源（itunes 无需登记，点了立即启用） */
  $('srcSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    showPane(b.dataset.src);
    if (b.dataset.src === 'itunes') localStorage.setItem('mu-source', 'itunes');
  });

  /* QQ 音乐：存地址 + 把粘来的 cookie 登记进网关（多脏都行，我来洗） */
  $('qqSave').addEventListener('click', () => {
    qqUrl = $('qqUrl').value.trim().replace(/\/$/, '');
    localStorage.setItem('mu-qq', qqUrl);
    localStorage.setItem('mu-qq-key', $('qqKeyInput').value.trim());
    if (!qqUrl) { $('qqStatus').textContent = '已清除'; return; }
    const raw = $('qqCookie').value
      .replace(/^cookie:\s*/i, '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!raw) {
      // 只存地址：测个连通性
      $('qqStatus').textContent = '测试中……';
      qq('/user/cookie').then(() => { $('qqStatus').textContent = '网关在线 ✓ 还差 cookie'; })
        .catch(() => { $('qqStatus').textContent = '连不上网关——地址不对或还没部署'; });
      return;
    }
    if (!qqUrl) { $('qqStatus').textContent = '先填网关地址：https://music-qq.azi36.com'; return; }
    if (!qqKey()) { $('qqStatus').textContent = '先填网关口令那一栏（部署时给你的那串）'; return; }
    if (!/uin=/.test(raw) || !/qm_keyst=/.test(raw)) {
      $('qqStatus').textContent = '这串里没找到 uin 或 qm_keyst——多半复制成别的行了（要「请求标头」里的 Cookie）';
      return;
    }
    $('qqStatus').textContent = '登记中……';
    // setCookie 存的是服务端全局登录态，成功回 {result:100}；别再去读 /user/cookie（那只回浏览器 cookie，永远是空）
    qq('/user/setCookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: raw }),
    })
      .then((d) => {
        if (!d || d.result !== 100) throw 0;
        $('qqStatus').textContent = '登记成功 ✓ 已设为当前音源——刷新页面即整首';
        $('qqCookie').value = '';
        localStorage.setItem('mu-source', 'qq');   // 添加即启用
        // 抓 uin 存下来：拉「我的歌单」要显式带 id（网关默认读浏览器 cookie=空）
        const uin = ((raw.match(/\buin=([^;]+)/) || [])[1] || '').replace(/\D/g, '');
        if (uin) localStorage.setItem('mu-qq-uin', uin);
        loadPlaza();   // 登记完立刻刷新底部歌单广场
      })
      .catch(() => { $('qqStatus').textContent = '登记没成——连不上网关。若你是直接双击打开 HTML 的，浏览器会拦跨域，用本地服务器打开或等上线后再试'; });
  });
  $('setClose').addEventListener('click', () => { clearInterval(qrTimer); $('setModal').close(); });

  const pollQr = (key) => {
    clearInterval(qrTimer);
    qrTimer = setInterval(() => {
      gw(`/login/qr/check?key=${key}`).then((d) => {
        if (d.code === 803) {
          clearInterval(qrTimer);
          apiCookie = d.cookie || '';
          localStorage.setItem('mu-api-cookie', apiCookie);
          localStorage.setItem('mu-source', 'ncm');   // 登录即启用
          $('qrArea').hidden = true;
          $('apiStatus').textContent = '登录成功！已设为当前音源——刷新页面即整首';
        } else if (d.code === 800) {
          clearInterval(qrTimer);
          $('apiStatus').textContent = '二维码过期了，再点一次「保存并测试」';
        } else if (d.code === 802) {
          $('apiStatus').textContent = '扫到了——手机上点确认';
        }
      }).catch(() => {});
    }, 3000);
  };

  $('apiSave').addEventListener('click', () => {
    apiUrl = $('apiUrl').value.trim().replace(/\/$/, '');
    localStorage.setItem('mu-api', apiUrl);
    localStorage.setItem('mu-qq-key', $('ncmKeyInput').value.trim());   // 共用口令
    clearInterval(qrTimer);
    $('qrArea').hidden = true;
    if (!apiUrl) { $('apiStatus').textContent = '已清除，回到 iTunes 免费源（刷新生效）'; return; }
    $('apiStatus').textContent = '测试中……';
    gw('/login/qr/key').then((d) => {
      const key = d.data && d.data.unikey;
      if (!key) throw 0;
      $('apiStatus').textContent = '网关在线 ✓ 拉取登录二维码……';
      return gw(`/login/qr/create?key=${key}&qrimg=true`).then((c) => {
        $('qrImg').src = c.data.qrimg;
        $('qrArea').hidden = false;
        $('apiStatus').textContent = '网关在线 ✓ 用网易云 App 扫码';
        pollQr(key);
      });
    }).catch(() => { $('apiStatus').textContent = '连不上网关——地址不对，或后端还没部署'; });
  });

  /* ---------- 底部「歌单广场」：我的自建/收藏歌单 + 粘链接开任意歌单 + 一键导入收藏 ---------- */
  const qqReady = () => !!qqUrl && !!qqKey();
  const setPlaza = (msg, warn) => {
    const el = $('plazaStatus');
    el.textContent = msg || '';
    el.classList.toggle('warn', !!warn);
    el.hidden = !msg;
  };
  const normPl = (v, kind) => ({
    tid: String(v.tid || v.dissid || v.dirid || ''),
    name: v.diss_name || v.dissname || v.title || '未命名歌单',
    cover: (v.diss_cover || v.logo || v.cover || v.picurl || '').replace(/^http:/, 'https:'),
    count: v.song_cnt != null ? v.song_cnt : (v.songnum != null ? v.songnum : (v.total || 0)),
    kind,
  });
  const qqSongsToTracks = (d) => {
    const songs = (d && d.data && (d.data.songlist || d.data.list)) || [];
    return songs.filter((s) => s && s.songmid).map((s) => {
      const t = {
        qqMid: s.songmid,
        title: s.songname || s.name || '未知曲目',
        name: s.songname || s.name || '',
        artist: (s.singer && s.singer[0] && s.singer[0].name) || '',
        sub: `${(s.singer || []).map((a) => a.name).join('/')} · ${s.albumname || (s.album && s.album.name) || '单曲'}`,
        img: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg` : '',
        imgBig: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${s.albummid}.jpg` : '',
      };
      if (s.interval) durCache['qq' + s.songmid] = fmt(s.interval);
      return t;
    });
  };
  const fetchSongs = (tid) => qq(`/songlist?id=${encodeURIComponent(tid)}`).then(qqSongsToTracks);

  const openPlaylist = (tid, name) => {
    if (!qqReady()) { setPlaza('先在右上角设置里配好 QQ 网关地址和口令', true); return; }
    setPlaza('翻开歌单……');
    fetchSongs(tid).then((rows) => {
      if (!rows.length) { setPlaza('这个歌单空的，或者需要权限', true); return; }
      PLAYLISTS[PL_OPEN].tracks = rows;
      PLAYLISTS[PL_OPEN].name = name || '歌单';
      PLAYLISTS[PL_OPEN].openTid = String(tid);
      plView = PL_OPEN;
      renderTabs(); renderList();
      setPlaza('');
      const w = document.querySelector('.mu-window');
      if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(() => setPlaza('打不开——网关没接住或链接不对', true));
  };

  const importPlaylist = (tid, name) => {
    if (!qqReady()) { setPlaza('先配好 QQ 网关', true); return; }
    setPlaza(`正在把《${name}》搬进收藏……`);
    fetchSongs(tid).then((rows) => {
      let n = 0;
      rows.forEach((t) => { if (addFav(t)) n += 1; });
      saveFavs(); renderTabs();
      if (plView === PL_FAV) renderList();
      setPlaza(n ? `已把 ${n} 首收进收藏${n < rows.length ? `（另 ${rows.length - n} 首本来就有）` : ''} ♥` : '这些歌收藏里都有了');
    }).catch(() => setPlaza('导入失败——网关没接住', true));
  };

  const parseTid = (s) => {
    s = (s || '').trim();
    const m = s.match(/(?:playlist|dissid|list|id)[\/=]?(\d{3,})/i) || s.match(/(\d{5,})/);
    return m ? m[1] : '';
  };

  const cardHtml = (p) => `
    <div class="plaza-card" role="button" tabindex="0" data-tid="${esc(p.tid)}" data-name="${esc(p.name)}" title="${esc(p.name)}">
      <span class="pc-cover">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : ICN_DISC}<em class="pc-play">${ICN_PLAY}</em><i class="pc-imp" data-imp="1" role="button" tabindex="0" aria-label="导入到收藏" title="全部导入收藏">${ICN_HEART}</i></span>
      <b class="pc-name">${esc(p.name)}</b>
      <span class="pc-cnt">${p.count} 首</span>
    </div>`;

  const renderGrid = (gridId, groupId, list) => {
    const grid = $(gridId), group = $(groupId);
    if (!list.length) { group.hidden = true; grid.innerHTML = ''; return; }
    group.hidden = false;
    grid.innerHTML = list.map(cardHtml).join('');
  };

  const loadPlaza = () => {
    const uin = localStorage.getItem('mu-qq-uin') || '';
    if (source() !== 'qq' || !qqReady()) {
      $('plazaSelf').hidden = true; $('plazaColl').hidden = true;
      $('plazaEmpty').hidden = false;
      $('plazaEmpty').textContent = '切到 QQ 音乐并登录后，你的自建/收藏歌单会摆在这；也能直接在上面粘一个歌单链接打开。';
      return;
    }
    if (!uin) {
      $('plazaSelf').hidden = true; $('plazaColl').hidden = true;
      $('plazaEmpty').hidden = false;
      $('plazaEmpty').textContent = '已接管 QQ 音乐——去设置里重新登记一次 cookie 就能抓到你的歌单（早前的登记没存 uin）。';
      return;
    }
    $('plazaEmpty').hidden = true;
    setPlaza('翻你的唱片架……');
    Promise.all([
      qq(`/user/songlist?id=${uin}`).then((d) => ((d.data && d.data.list) || []).map((v) => normPl(v, 'self'))).catch(() => []),
      qq(`/user/collect/songlist?id=${uin}&pageSize=60`).then((d) => ((d.data && d.data.list) || []).map((v) => normPl(v, 'collect'))).catch(() => []),
    ]).then(([self, coll]) => {
      setPlaza('');
      renderGrid('gridSelf', 'plazaSelf', self.filter((p) => p.tid));
      renderGrid('gridColl', 'plazaColl', coll.filter((p) => p.tid));
      if (!self.length && !coll.length) {
        $('plazaEmpty').hidden = false;
        $('plazaEmpty').textContent = '没抓到歌单——可能你还没建过、也没收藏过歌单。上面粘个链接也能听。';
      }
    });
  };

  $('plazaGo').addEventListener('click', () => {
    const raw = $('plazaInput').value;
    const tid = parseTid(raw);
    if (!tid) { setPlaza('没认出歌单 ID——粘完整的歌单链接，或直接粘那串数字', true); return; }
    openPlaylist(tid, '歌单 ' + tid);
  });
  $('plazaInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('plazaGo').click(); });

  $('muPlaza').addEventListener('click', (e) => {
    const imp = e.target.closest('[data-imp]');
    const card = e.target.closest('.plaza-card');
    if (!card) return;
    if (imp) { e.preventDefault(); e.stopPropagation(); importPlaylist(card.dataset.tid, card.dataset.name); return; }
    openPlaylist(card.dataset.tid, card.dataset.name);
  });

  $('openImp').addEventListener('click', () => {
    const p = PLAYLISTS[PL_OPEN];
    if (p.openTid) importPlaylist(p.openTid, p.name);
    else { let n = 0; p.tracks.forEach((t) => { if (addFav(t)) n += 1; }); saveFavs(); renderTabs(); setPlaza(n ? `已收 ${n} 首 ♥` : '都收过了'); }
  });

  /* 记忆退出：开页从上次断点把队列和进度接上（能续播就 cue 好，自动播被拦就停在断点等点一下） */
  const restoreNow = () => {
    const now = lsGet('mu-now'), q = lsGet('mu-queue');
    if (!now || !now.cur || now.cur.loc) return;
    if (!(q && q.q && q.q.length && q.k === source())) return;   // 音源不一致/无队列：不硬续
    PLAYLISTS[PL_OPEN].tracks = q.q.map(expand);
    PLAYLISTS[PL_OPEN].name = q.name || '继续播放';
    PLAYLISTS[PL_OPEN].openTid = null;
    plView = PL_OPEN; plPlay = PL_OPEN;
    cur = Math.max(0, Math.min(now.i || 0, PLAYLISTS[PL_OPEN].tracks.length - 1));
    queueSig = plPlay + ':' + PLAYLISTS[PL_OPEN].tracks.length + ':' + source();
    pendingSeek = now.p || 0;
    renderTabs(); renderList(); renderNow();
    if (now.pl) load(PL_OPEN, cur, true);   // 试着接着放
    else writeNow(false);
  };

  // 给全站迷你播放器的同页控制接口（导航图标/popover 直接调这里）
  window.AziPlayer = {
    host: true,
    toggle: () => toggle(),
    next: () => load(plPlay, cur + 1, true),
    prev: () => load(plPlay, cur - 1, true),
  };

  $('muCount').textContent = gwOn()
    ? `${source() === 'qq' ? 'QQ 音乐' : '网易云'}网关接管中 · 整首模式`
    : '搜索走 iTunes · 歌词走 LRCLIB · 免费优先';
  renderTabs();
  renderLoop();
  renderNow();
  loadPlaza();
  restoreNow();
})();
