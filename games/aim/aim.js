/* ============================================
   幽灵靶场 · Ghost Range（№ 003）
   爆点 / 追踪 / 微操 —— 网页版定位练习
   ============================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const API = 'https://api.azi36.com';
  const rand = (a, b) => a + Math.random() * (b - a);

  const MODES = {
    1: { name: '爆点连打', dur: 60 },
    2: { name: '曲线追踪', dur: 30 },
    3: { name: '瞬影微操', dur: 45 },
    4: { name: '直线追踪', dur: 30 },
    5: { name: '瞬闪点射', dur: 45 },
    6: { name: '无尽热身', dur: 0 },   // 不限时不上榜，专职调枪
  };
  const ENDLESS = (m) => m === 6;
  const TRACKY = (m) => m === 2 || m === 4;      // 跟枪类：贴靶计时，不吃点击
  const FLICKY = (m) => m === 3 || m === 5;      // 限时靶：超时就跑

  /* 各游戏每 1 单位灵敏度对应的 yaw（度/像素）——换算成「CS2 手感」的相对倍率 */
  const YAW = { gen: 0.022, cs2: 0.022, val: 0.07, apex: 0.022, ow: 0.0066 };

  const NAMES = ['稳如老狗', '人体描边大师', '八倍镜近战', '枪枪咬肉', '蜻蜓点水', '闪电五连鞭', '预判了预判', '手比脑快'];
  const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)];

  const GHOST_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" fill="#a7b3ff"/>' +
    '<circle cx="9.5" cy="10" r="1.2" fill="#251f33"/><circle cx="14.5" cy="10" r="1.2" fill="#251f33"/></svg>';

  /* ---------- 声音总台：BGM 无缝循环 + 合成音效，同全站操作习惯 ---------- */
  const SND = (() => {
    const loadV = (k, d) => {
      const v = parseInt(localStorage.getItem(k), 10);
      return Math.min(100, Math.max(0, Number.isNaN(v) ? d : v)) / 100;
    };
    let muted = localStorage.getItem('aim-mute') === '1';
    let vSfx = loadV('aim-vol-sfx', 100);
    let vBgm = loadV('aim-vol-bgm', 55);
    let ctx = null, master = null;
    let buf = null, bSrc = null, bGain = null, loading = false, wantBgm = false;
    const bgmTarget = () => 0.4 * vBgm;
    const ac = () => {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = vSfx;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    };
    const note = (f, t, dur, type = 'sine', vol = 0.1) => {
      const c = ac();
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, c.currentTime + t);
      g.gain.setValueAtTime(vol, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + dur);
      o.connect(g).connect(master);
      o.start(c.currentTime + t);
      o.stop(c.currentTime + t + dur + 0.02);
    };
    const seq = {
      hit:   () => note(880, 0, 0.06, 'triangle', 0.12),
      hit2:  () => { note(880, 0, 0.05, 'triangle', 0.1); note(1175, 0.05, 0.08, 'triangle', 0.1); },
      miss:  () => note(200, 0, 0.09, 'sine', 0.08),
      tick:  () => note(1320, 0, 0.05, 'sine', 0.07),
      go:    () => { note(660, 0, 0.09); note(880, 0.1, 0.14); },
      end:   () => [523, 659, 784, 1046].forEach((f, i) => note(f, i * 0.1, 0.2, 'triangle', 0.1)),
      best:  () => [659, 784, 1046, 1318].forEach((f, i) => note(f, i * 0.08, 0.16, 'triangle', 0.11)),
    };
    const bgmLoad = () => {
      if (buf || loading) return;
      loading = true;
      fetch('bgm.mp3')
        .then((r) => r.arrayBuffer())
        .then((ab) => new Promise((res, rej) => ac().decodeAudioData(ab, res, rej)))
        .then((b) => {
          // 掐掉 mp3 首尾静音垫，循环点落在有声样本上
          const d = b.getChannelData(0);
          let a = 0, z = d.length - 1;
          while (a < z && Math.abs(d[a]) < 1e-3) a++;
          while (z > a && Math.abs(d[z]) < 1e-3) z--;
          buf = b; buf._ls = a / b.sampleRate; buf._le = z / b.sampleRate;
          loading = false;
          if (wantBgm) bgmPlay();
        })
        .catch(() => { loading = false; });
    };
    const bgmPlay = () => {
      wantBgm = true;
      if (muted || !vBgm || bSrc) return;
      if (!buf) return bgmLoad();
      const c = ac();
      if (c.state === 'suspended') return;
      bGain = c.createGain();
      bGain.gain.setValueAtTime(0.001, c.currentTime);
      bGain.gain.exponentialRampToValueAtTime(Math.max(0.002, bgmTarget()), c.currentTime + 1.5);
      bSrc = c.createBufferSource();
      bSrc.buffer = buf; bSrc.loop = true;
      bSrc.loopStart = buf._ls; bSrc.loopEnd = buf._le;
      bSrc.connect(bGain).connect(c.destination);
      bSrc.start(c.currentTime, buf._ls);
    };
    const bgmFadeOut = (fast) => {
      if (!bSrc) return;
      const c = ac(), s = bSrc, g = bGain;
      bSrc = null; bGain = null;
      try {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.001), c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (fast ? 0.2 : 0.8));
        s.stop(c.currentTime + (fast ? 0.25 : 0.9));
      } catch (e) { /* 已经停了 */ }
    };
    return {
      play: (n) => { if (muted || !vSfx || !seq[n]) return; try { seq[n](); } catch (e) { /* 无声胜有声 */ } },
      bgm: bgmPlay,
      kick: () => { if (wantBgm && !bSrc) bgmPlay(); },
      resume: () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
      muted: () => muted,
      setMuted: (m) => { muted = m; localStorage.setItem('aim-mute', m ? '1' : '0'); if (m) bgmFadeOut(true); else bgmPlay(); },
      setSfx: (v) => { vSfx = v; localStorage.setItem('aim-vol-sfx', Math.round(v * 100)); if (master) master.gain.value = v; },
      setBgm: (v) => {
        vBgm = v; localStorage.setItem('aim-vol-bgm', Math.round(v * 100));
        if (bSrc && bGain) {
          const c = ac(), t = c.currentTime;
          try {
            bGain.gain.cancelScheduledValues(t);
            bGain.gain.setValueAtTime(Math.max(bGain.gain.value, 0.001), t);
            bGain.gain.linearRampToValueAtTime(Math.max(0.002, bgmTarget()), t + 0.15);
          } catch (e) { /* 拧不动算了 */ }
        } else if (wantBgm && v > 0) bgmPlay();
      },
      vSfx: () => vSfx,
      vBgm: () => vBgm,
    };
  })();
  document.addEventListener('pointerdown', () => { SND.resume(); SND.kick(); }, true);

  const ICN_VOL = '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  const ICN_VOLX = '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>';
  const renderSnd = () => {
    $('sndBtn').innerHTML = (SND.muted() ? ICN_VOLX : ICN_VOL) + ' 声音';
    $('sndBtn').title = SND.muted() ? '已静音，点击恢复' : '点击静音 · 悬停调音量';
  };
  $('sndBtn').addEventListener('click', () => { SND.setMuted(!SND.muted()); renderSnd(); if (!SND.muted()) SND.play('hit'); });
  $('volSfx').value = Math.round(SND.vSfx() * 100);
  $('volBgm').value = Math.round(SND.vBgm() * 100);
  $('volSfx').addEventListener('input', () => { if (SND.muted()) { SND.setMuted(false); renderSnd(); } SND.setSfx($('volSfx').value / 100); });
  $('volSfx').addEventListener('change', () => SND.play('hit'));
  $('volBgm').addEventListener('input', () => { if (SND.muted()) { SND.setMuted(false); renderSnd(); } SND.setBgm($('volBgm').value / 100); });
  renderSnd();

  /* ---------- 状态 ---------- */
  let mode = 1;
  let running = false;
  let over = null;          // 本轮结算数据
  let timeLeft = 0;
  let score = 0, hits = 0, misses = 0, combo = 0, bestCombo = 0;
  let reactSum = 0, reactN = 0;
  let contactMs = 0;        // 追踪模式：贴靶毫秒
  let ghosts = [];          // {el, born, vx, vy, x, y}
  let timerId = null, rafId = null, flickTTL = null;
  let pointer = { x: -1, y: -1, down: false };
  let uploaded = false;

  const field = $('field');

  const fieldSize = () => ({ w: field.clientWidth, h: field.clientHeight });

  const spawnPos = (pad) => {
    const { w, h } = fieldSize();
    return { x: rand(pad, w - pad), y: rand(pad, h - pad) };
  };

  /* ---------- 靶皮与手感设置（本机记忆） ---------- */
  const OPT = {
    get target() { return localStorage.getItem('aim-target') || 'ghost'; },
    get lock() { return (localStorage.getItem('aim-lock') || '1') === '1'; },
    get game() { return localStorage.getItem('aim-game') || 'gen'; },
    get sens() { const v = parseFloat(localStorage.getItem('aim-sens')); return Number.isFinite(v) && v > 0 ? v : 1; },
  };
  $('optTarget').value = OPT.target;
  $('optLock').value = OPT.lock ? '1' : '0';
  $('optGame').value = OPT.game;
  $('optSens').value = OPT.sens;
  $('optTarget').addEventListener('change', () => localStorage.setItem('aim-target', $('optTarget').value));
  $('optLock').addEventListener('change', () => localStorage.setItem('aim-lock', $('optLock').value));
  $('optGame').addEventListener('change', () => localStorage.setItem('aim-game', $('optGame').value));
  $('optSens').addEventListener('change', () => localStorage.setItem('aim-sens', $('optSens').value));

  const sensFactor = () => OPT.sens * (YAW[OPT.game] || YAW.gen) / YAW.cs2;

  /* ---------- 指针锁定：虚拟准星，灵敏度才有意义 ---------- */
  let plOn = false;
  let cx = 0, cy = 0;
  const moveXhair = () => {
    $('xhair').style.left = cx + 'px';
    $('xhair').style.top = cy + 'px';
  };
  const canLock = () => OPT.lock && matchMedia('(pointer: fine)').matches && field.requestPointerLock;
  document.addEventListener('pointerlockchange', () => {
    plOn = document.pointerLockElement === field;
    $('xhair').hidden = !plOn;
    field.classList.toggle('locked', plOn);
    if (plOn) {
      const { w, h } = fieldSize();
      cx = w / 2; cy = h / 2;
      moveXhair();
    } else if (running && !paused && OPT.lock) {
      pauseRound();   // Esc 解锁鼠标 = 想出来 = 自动暂停，不偷你的表
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (!plOn || !running) return;
    const { w, h } = fieldSize();
    cx = Math.max(0, Math.min(w, cx + e.movementX * sensFactor()));
    cy = Math.max(0, Math.min(h, cy + e.movementY * sensFactor()));
    moveXhair();
  });
  /* 当前准星位置：锁定用虚拟准星，否则用系统指针 */
  const aimPos = () => plOn ? { x: cx, y: cy } : pointer;

  const mkGhost = (cls) => {
    const g = document.createElement('div');
    const dot = OPT.target === 'dot';
    g.className = 'ghost-t' + (cls ? ' ' + cls : '') + (dot ? ' dot' : '');
    g.innerHTML = dot ? '<i></i>' : GHOST_SVG;
    field.appendChild(g);
    return g;
  };

  const placeGhost = (g) => {
    const pad = mode === 3 ? 30 : 46;
    const p = spawnPos(pad);
    g.x = p.x; g.y = p.y;
    g.el.style.left = p.x + 'px';
    g.el.style.top = p.y + 'px';
    g.born = performance.now();
  };

  const popText = (x, y, txt, bad) => {
    const el = document.createElement('span');
    el.className = 'ghost-pop' + (bad ? ' bad' : '');
    el.textContent = txt;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    field.appendChild(el);
    setTimeout(() => el.remove(), 500);
  };

  /* ---------- HUD ---------- */
  const acc = () => (hits + misses ? Math.round((hits / (hits + misses)) * 100) : null);
  const renderHud = () => {
    $('hudTime').textContent = ENDLESS(mode) ? '∞' : timeLeft;
    $('hudTime').classList.toggle('hot', !ENDLESS(mode) && timeLeft <= 5);
    $('hudScore').textContent = score;
    $('hudCombo').textContent = combo;
    $('hudAcc').textContent = TRACKY(mode)
      ? (contactMs / 1000).toFixed(1) + 's'
      : (acc() === null ? '—' : acc() + '%');
  };

  /* ---------- 回合流程 ---------- */
  const start = () => {
    running = true; over = null; uploaded = false;
    score = 0; hits = 0; misses = 0; combo = 0; bestCombo = 0;
    reactSum = 0; reactN = 0; contactMs = 0;
    timeLeft = MODES[mode].dur;
    ghosts.forEach((g) => g.el.remove());
    ghosts = [];
    field.querySelectorAll('.ghost-pop').forEach((e) => e.remove());

    $('startPanel').hidden = true;
    $('endPanel').hidden = true;
    $('rangeView').hidden = false;
    $('quitBtn').hidden = false;

    const n = (mode === 1 || ENDLESS(mode)) ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const g = { el: mkGhost(mode === 3 ? 'small' : TRACKY(mode) ? 'big' : ''), vx: 0, vy: 0, x: 0, y: 0, born: 0 };
      placeGhost(g);
      ghosts.push(g);
    }
    if (TRACKY(mode)) newDrift(ghosts[0]);
    if (FLICKY(mode)) armFlickTTL();
    if (canLock()) { try { field.requestPointerLock(); } catch (e) { /* 锁不上就用系统指针 */ } }
    paused = false;
    $('pauseOv').hidden = true;

    SND.play('go');
    SND.bgm();   // 首轮开打起乐，Rhodes 匀速心流，一直待在状态里
    renderHud();

    armTimer();
    if (TRACKY(mode)) { lastT = performance.now(); rafId = requestAnimationFrame(tickTrack); }

    // 开局计一次（静默失败）
    fetch(API + '/games/aim/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }).catch(() => {});
  };

  const armTimer = () => {
    if (ENDLESS(mode)) return;   // 无尽热身：时间不存在
    timerId = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 5 && timeLeft > 0) SND.play('tick');
      renderHud();
      if (timeLeft <= 0) end();
    }, 1000);
  };

  const stopLoops = () => {
    clearInterval(timerId); timerId = null;
    cancelAnimationFrame(rafId); rafId = null;
    clearTimeout(flickTTL); flickTTL = null;
  };

  /* ---------- 暂停：场内按钮 / 空格 / P / 解锁鼠标自动触发 ---------- */
  let paused = false;
  const pauseRound = () => {
    if (!running || paused) return;
    paused = true;
    stopLoops();
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* 无所谓 */ } }
    syncTune();
    $('pauseOv').hidden = false;
  };
  const resumeRound = () => {
    if (!running || !paused) return;
    paused = false;
    $('pauseOv').hidden = true;
    armTimer();
    if (FLICKY(mode)) { ghosts[0].born = performance.now(); armFlickTTL(); }
    if (TRACKY(mode)) { lastT = performance.now(); rafId = requestAnimationFrame(tickTrack); }
    if (canLock()) { try { field.requestPointerLock(); } catch (e) { /* 锁不上就裸奔 */ } }
  };
  $('resumeBtn').addEventListener('click', resumeRound);
  $('pauseQuit').addEventListener('click', () => end(true));

  /* 暂停界面的调枪台：与开始面板同一份存储，改完立即生效 */
  const syncTune = () => {
    $('povGame').value = OPT.game;
    $('povSens').value = OPT.sens;
    $('povTarget').value = OPT.target;
  };
  $('povGame').addEventListener('change', () => { localStorage.setItem('aim-game', $('povGame').value); $('optGame').value = $('povGame').value; });
  $('povSens').addEventListener('change', () => { localStorage.setItem('aim-sens', $('povSens').value); $('optSens').value = $('povSens').value; });
  $('povTarget').addEventListener('change', () => {
    localStorage.setItem('aim-target', $('povTarget').value);
    $('optTarget').value = $('povTarget').value;
    // 场上的靶就地换皮，不用重开
    const dot = OPT.target === 'dot';
    ghosts.forEach((g) => {
      g.el.classList.toggle('dot', dot);
      g.el.innerHTML = dot ? '<i></i>' : GHOST_SVG;
    });
  });
  document.addEventListener('keydown', (e) => {
    if (!running) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;   // 调枪台里打字不触发
    if (e.code === 'Space' || e.code === 'KeyP') {
      e.preventDefault();
      if (paused) resumeRound(); else pauseRound();
    }
  });

  const end = (quit) => {
    running = false;
    paused = false;
    stopLoops();
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* 无所谓 */ } }
    ghosts.forEach((g) => g.el.remove());
    ghosts = [];
    $('rangeView').hidden = true;
    $('quitBtn').hidden = true;
    $('pauseOv').hidden = true;
    // 计时模式中途收枪 = 不结算不上传；无尽热身收枪 = 正常看数据（本来就不上榜）
    if (quit && !ENDLESS(mode)) { $('startPanel').hidden = false; return; }

    const avgReact = reactN ? Math.round(reactSum / reactN) : null;
    const finalScore = TRACKY(mode) ? Math.round(contactMs / 50) : score;
    over = { score: finalScore, hits, misses, bestCombo, avgReact, contact: contactMs };

    // 本地最佳（无尽热身不记）
    const key = 'aim-best-' + mode;
    const prevBest = Number(localStorage.getItem(key) || 0);
    const isBest = !ENDLESS(mode) && finalScore > prevBest;
    if (isBest) localStorage.setItem(key, finalScore);
    SND.play(isBest && prevBest > 0 ? 'best' : 'end');

    $('endTitle').textContent = ENDLESS(mode)
      ? `无尽热身 · 练了 ${hits + misses} 枪`
      : `${MODES[mode].name} · ${finalScore} 分` + (isBest ? '（本机新纪录！）' : '');
    const st = (label, val) => `<span class="st"><i>${label}</i><b>${val}</b></span>`;
    $('endStats').innerHTML =
      st('得分', finalScore).replace('class="st"', 'class="st main"') +
      (TRACKY(mode)
        ? st('贴靶时长', (contactMs / 1000).toFixed(1) + 's') + st('全程', MODES[mode].dur + 's')
        : st('命中', hits) + st('失手', misses) + st('命中率', acc() === null ? '—' : acc() + '%')) +
      (avgReact !== null ? st('平均反应', avgReact + 'ms') : '') +
      (!TRACKY(mode) ? st('最高连击', bestCombo) : '') +
      (!ENDLESS(mode) ? st('本机最佳', Math.max(prevBest, finalScore)) : '');

    $('endPanel').hidden = false;

    if (ENDLESS(mode)) { $('endNote').textContent = '热身不计成绩，榜单不收——调好了就去打计时靶'; return; }

    // 上传成绩（打满一轮才有资格；每轮只交一次）
    $('endNote').textContent = '正在上报靶场战绩……';
    if (!uploaded) {
      uploaded = true;
      fetch(API + '/games/aim/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName(), score: finalScore, day: 1, mode }),
      }).then((r) => r.json()).then((d) => {
        if (!d.ok) throw 0;
        $('endNote').textContent = `🌍 ${MODES[mode].name}靶全球第 ${d.rank} 名`;
      }).catch(() => { $('endNote').textContent = '💾 本机已记录（全球榜暂时联系不上）'; });
    }
  };

  /* ---------- 模式 1 / 3：点击命中 ---------- */
  const hitGhost = (g, ev) => {
    hits += 1; combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    const react = Math.round(performance.now() - g.born);
    reactSum += react; reactN += 1;
    const gain = (mode === 3 ? 15 : mode === 5 ? 12 : 10) + Math.min(10, combo);
    score += gain;
    popText(g.x, g.y - 20, '+' + gain);
    SND.play(combo >= 5 ? 'hit2' : 'hit');
    placeGhost(g);
    if (FLICKY(mode)) armFlickTTL();
    renderHud();
  };

  const missShot = (x, y) => {
    misses += 1;
    if (combo > 0) popText(x, y, '断连', true);
    combo = 0;
    score = Math.max(0, score - (mode === 3 ? 5 : 3));
    SND.play('miss');
    renderHud();
  };

  /* 限时靶：瞬影微操 1.5 秒、瞬闪点射 0.9 秒，不打中就跑（算一次失手） */
  const armFlickTTL = () => {
    clearTimeout(flickTTL);
    flickTTL = setTimeout(() => {
      if (!running || !FLICKY(mode)) return;
      const g = ghosts[0];
      popText(g.x, g.y, mode === 5 ? '闪了' : '跑了', true);
      misses += 1; combo = 0;
      SND.play('miss');
      placeGhost(g);
      armFlickTTL();
      renderHud();
    }, mode === 5 ? 900 : 1500);
  };

  field.addEventListener('pointerdown', (e) => {
    if (!running || paused) return;
    if (e.target.closest('.pause-ov')) return;
    e.preventDefault();
    pointer.down = true;
    updatePointer(e);
    if (TRACKY(mode)) return;                  // 跟枪类不吃点击
    if (plOn) {
      // 锁定模式：按虚拟准星到靶心的距离判定
      const g = ghosts.find((x) => Math.hypot(cx - x.x, cy - x.y) <= x.el.offsetWidth / 2 + 5);
      if (g) hitGhost(g, e);
      else missShot(cx, cy);
      return;
    }
    const t = e.target.closest('.ghost-t');
    if (t) {
      const g = ghosts.find((x) => x.el === t);
      if (g) hitGhost(g, e);
    } else {
      const r = field.getBoundingClientRect();
      missShot(e.clientX - r.left, e.clientY - r.top);
    }
  });

  /* ---------- 跟枪类：曲线（2）与直线（4）两套运动 ---------- */
  let lastT = 0;
  const newDrift = (g) => {
    const ramp = (MODES[mode].dur - timeLeft);
    if (mode === 4) {
      // 直线追踪：纯水平变速平移，急停反向——模拟 A/D 侧移
      const sp = rand(180, 280) + ramp * 6;
      g.vx = (Math.random() < 0.5 ? -1 : 1) * sp;
      g.vy = 0;
      g.nextTurn = performance.now() + rand(400, 1200);
      return;
    }
    const sp = rand(120, 200) + ramp * 4;  // 曲线：越到后面越快
    const a = rand(0, Math.PI * 2);
    g.vx = Math.cos(a) * sp;
    g.vy = Math.sin(a) * sp;
    g.nextTurn = performance.now() + rand(700, 1600);
  };

  const updatePointer = (e) => {
    const r = field.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  };
  field.addEventListener('pointermove', (e) => updatePointer(e));
  field.addEventListener('pointerleave', () => { pointer.x = -999; pointer.y = -999; });

  const tickTrack = (now) => {
    if (!running || !TRACKY(mode)) return;
    const dt = Math.min(50, now - lastT);
    lastT = now;
    const g = ghosts[0];
    const { w, h } = fieldSize();
    if (now > g.nextTurn) newDrift(g);
    g.x += (g.vx * dt) / 1000;
    g.y += (g.vy * dt) / 1000;
    const pad = 34;
    if (g.x < pad) { g.x = pad; g.vx = Math.abs(g.vx); }
    if (g.x > w - pad) { g.x = w - pad; g.vx = -Math.abs(g.vx); }
    if (g.y < pad) { g.y = pad; g.vy = Math.abs(g.vy); }
    if (g.y > h - pad) { g.y = h - pad; g.vy = -Math.abs(g.vy); }
    g.el.style.left = g.x + 'px';
    g.el.style.top = g.y + 'px';

    const p = aimPos();
    const on = Math.hypot(p.x - g.x, p.y - g.y) <= 32;
    g.el.classList.toggle('lock', on);
    if (on) { contactMs += dt; renderHud(); }
    rafId = requestAnimationFrame(tickTrack);
  };

  /* ---------- 名号与入口 ---------- */
  const playerName = () => ($('playerName').value.trim() || randomName()).slice(0, 12);

  $('playerName').value = localStorage.getItem('aim-name') || randomName();
  $('randomName').addEventListener('click', () => { $('playerName').value = randomName(); });

  $('modeGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.aim-mode');
    if (!b) return;
    document.querySelectorAll('.aim-mode').forEach((x) => x.classList.toggle('on', x === b));
    mode = Number(b.dataset.mode);
  });

  $('startBtn').addEventListener('click', () => {
    localStorage.setItem('aim-name', playerName());
    start();
  });
  $('againBtn').addEventListener('click', start);
  $('backBtn').addEventListener('click', () => { $('endPanel').hidden = true; $('startPanel').hidden = false; });
  $('quitBtn').addEventListener('click', () => end(true));

  /* ---------- 排行榜 ---------- */
  const loadRank = (m) => {
    $('rankList').innerHTML = '<li class="empty">瞄准中……</li>';
    fetch(`${API}/games/aim/rank?mode=${m}`).then((r) => r.json()).then((d) => {
      const top = (d.top || []).slice(0, 10);
      $('rankList').innerHTML = top.length
        ? top.map((r, i) =>
            `<li><span class="no">${i + 1}</span><span class="nm">${String(r.name).replace(/</g, '&lt;')}</span>` +
            `<span class="sc">${Math.round(r.score)}</span><span class="dt">${String(r.date || '').slice(5)}</span></li>`).join('')
        : '<li class="empty">这张靶还没人上榜，等你开张。</li>';
    }).catch(() => { $('rankList').innerHTML = '<li class="empty">排行榜暂时联系不上</li>'; });
  };
  $('rankBtn').addEventListener('click', () => { $('rankModal').showModal(); loadRank(mode); syncTabs(mode); });
  $('rankClose').addEventListener('click', () => $('rankModal').close());
  const syncTabs = (m) => document.querySelectorAll('#rankTabs button').forEach((b) =>
    b.classList.toggle('on', Number(b.dataset.mode) === m));
  $('rankTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    syncTabs(Number(b.dataset.mode));
    loadRank(Number(b.dataset.mode));
  });

  /* 游玩统计（静默失败） */
  fetch(API + '/games/aim/play').then((r) => r.json()).then((d) => {
    if (typeof d.plays !== 'number') return;
    $('startStats').textContent = `这片靶场已被扫射 ${d.plays.toLocaleString('zh-CN')} 轮 · ${d.players.toLocaleString('zh-CN')} 位枪手来过`;
    $('startStats').hidden = false;
  }).catch(() => {});
})();
