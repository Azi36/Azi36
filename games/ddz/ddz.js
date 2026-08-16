/* ============================================
   Lord of the Cards · 斗地主（好友联机）
   服务端：wss://ddz.azi36.com（房间制，内存房间）
   ============================================ */
(function () {
  'use strict';

  const WS_URL = 'wss://ddz.azi36.com';
  const API_HTTP = 'https://ddz.azi36.com';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /* ---------- 游客身份码：战绩钥匙，换设备可导入 ---------- */
  const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const guestId = (() => {
    let id = localStorage.getItem('azi-guest-id');
    if (!/^[A-Z0-9]{16}$/.test(id || '')) {
      id = Array.from({ length: 16 }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join('');
      localStorage.setItem('azi-guest-id', id);
    }
    return () => localStorage.getItem('azi-guest-id');
  })();

  /* ---------- 成就目录（裁定在服务端，这里只管好看） ---------- */
  const ACHS = {
    first_win:   ['🎉', '开张大吉', '赢下人生第一局'],
    lord_slam:   ['👑', '地主的尊严', '当地主打出春天'],
    farmer_rise: ['🌱', '农民的逆袭', '反春获胜'],
    bomber:      ['💣', '炸弹狂魔', '单局甩出两个炸弹'],
    nuker:       ['🚀', '核平使者', '王炸开路并赢下这局'],
    streak5:     ['🔥', '连庄之魂', '豪取五连胜'],
    fish:        ['🌪️', '浑水摸鱼', '不洗牌模式获胜'],
    show_off:    ['👁', '明牌都拦不住', '明牌并获胜'],
    veteran50:   ['🪑', '常驻牌友', '累计对局 50 场'],
    century:     ['💰', '百分大户', '累计积分破 100'],
  };

  /* 随机动物名号；服务器还会追加 #XX 标识符防重名 */
  const NAME_A = ['呆萌', '狂暴', '慵懒', '神速', '隐身', '暴富', '高冷', '话痨', '优雅', '莽撞'];
  const NAME_B = ['企鹅', '水豚', '柴犬', '狸花猫', '仓鼠', '鸭嘴兽', '羊驼', '海獭', '狐狸', '树懒'];
  const randomName = () => NAME_A[Math.floor(Math.random() * NAME_A.length)] + NAME_B[Math.floor(Math.random() * NAME_B.length)];

  const PHRASES = [
    '快点吧，我等到花儿都谢了',
    '你的牌打得也太好了',
    '和你合作真是三生有幸',
    '地主家也没有余粮啊',
    '别走，决战到天亮',
    '炸他！就是现在！',
    '大爷的，又输了',
    '让我先冷静一下',
  ];

  /* ---------- 牌面 ---------- */
  const rankOf = (id) => (id < 52 ? 3 + Math.floor(id / 4) : id === 52 ? 16 : 17);
  const RANK_TXT = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const rankTxt = (r) => RANK_TXT[r - 3] || '?';
  const SUITS = ['♠', '♥', '♣', '♦'];
  let wildSet = new Set(); // 本局癞子点数（render 时同步）
  const cardHtml = (id, cls = '') => {
    const r = rankOf(id);
    if (r >= 16) {
      return `<div class="pcard joker ${r === 17 ? 'red' : ''} ${cls}" data-id="${id}"><i>${r === 17 ? '大王' : '小王'}</i><em>🃏</em></div>`;
    }
    const suit = SUITS[id % 4];
    const red = id % 4 === 1 || id % 4 === 3;
    const wild = wildSet.has(r) ? ' wild' : '';
    return `<div class="pcard ${red ? 'red' : ''}${wild} ${cls}" data-id="${id}"><i>${RANK_TXT[r - 3]}</i><em>${suit}</em></div>`;
  };
  const miniCards = (ids) => `<div class="mini-cards">${ids.map((id) => cardHtml(id, 'mini')).join('')}</div>`;

  /* ---------- 状态 ---------- */
  let ws = null;
  let S = null;        // 服务器最新快照
  let prevS = null;
  let sess = null;     // { room, pid }
  let trick = {};      // 本轮各座位的动作 {seat: {cards,name} | 'pass'}
  let leaving = false;
  let retries = 0;
  let selected = new Set();

  try { sess = JSON.parse(localStorage.getItem('ddz-sess') || 'null'); } catch { sess = null; }

  const saveSess = () => localStorage.setItem('ddz-sess', JSON.stringify(sess));
  const clearSess = () => { sess = null; localStorage.removeItem('ddz-sess'); };

  const send = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  const setConn = (txt, ok) => {
    const el = $('connState');
    el.textContent = txt;
    el.className = 'conn ' + (ok ? 'ok' : 'bad');
  };

  const toast = (msg) => {
    const el = $('ddzToast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
  };

  /* 自制确认框（不用原生 confirm） */
  let askResolve = null;
  const ask = (msg) => new Promise((resolve) => {
    askResolve = resolve;
    $('confirmText').textContent = msg;
    $('confirmModal').showModal();
  });
  $('confirmYes').addEventListener('click', () => { $('confirmModal').close(); askResolve && askResolve(true); });
  $('confirmNo').addEventListener('click', () => { $('confirmModal').close(); askResolve && askResolve(false); });

  /* ---------- 音量总台：一个按钮管静音，悬停滑块分管音效/音乐 ---------- */
  const loadVol = (key, dft) => {
    const v = parseInt(localStorage.getItem(key), 10);
    return Math.min(100, Math.max(0, Number.isNaN(v) ? dft : v)) / 100;
  };
  let sndMuted = localStorage.getItem('ddz-mute') === '1';
  let volSfx = loadVol('ddz-vol-sfx', 100);
  let volBgm = loadVol('ddz-vol-bgm', 55);

  /* ---------- 音效：WebAudio 现场合成，零音频文件 ---------- */
  const SFX = (() => {
    let ctx = null;
    let master = null;   // 音效总闸：滑块只拧这一个旋钮
    const ac = () => {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = volSfx;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    };
    // 单音：频率、起始时刻(相对)、时长、波形、音量
    const note = (c, f, t, dur, type = 'sine', vol = 0.14) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, c.currentTime + t);
      g.gain.setValueAtTime(vol, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + dur);
      o.connect(g).connect(master);
      o.start(c.currentTime + t);
      o.stop(c.currentTime + t + dur + 0.02);
    };
    /* 爆炸三件套：白噪冲击波（噼啪）+ 低频下坠（胸口闷响）。
       纯锯齿波那版被甲方鉴定为放屁，已回炉 */
    let noiseBuf = null;
    const blast = (c, t, dur, vol, fq) => {
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource();
      s.buffer = noiseBuf; s.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(fq, c.currentTime + t);
      f.frequency.exponentialRampToValueAtTime(70, c.currentTime + t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + dur);
      s.connect(f).connect(g).connect(master);
      s.start(c.currentTime + t);
      s.stop(c.currentTime + t + dur + 0.05);
    };
    const thump = (c, t, f0, f1, dur, vol) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, c.currentTime + t);
      o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + t + dur);
      g.gain.setValueAtTime(vol, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + dur);
      o.connect(g).connect(master);
      o.start(c.currentTime + t);
      o.stop(c.currentTime + t + dur + 0.02);
    };
    const seq = {
      play:   (c) => note(c, 950, 0, 0.06, 'triangle', 0.1),
      pass:   (c) => note(c, 260, 0, 0.1, 'sine', 0.08),
      bid:    (c) => { note(c, 660, 0, 0.09); note(c, 880, 0.09, 0.12); },
      turn:   (c) => { note(c, 880, 0, 0.07, 'sine', 0.1); note(c, 1175, 0.09, 0.1, 'sine', 0.1); },
      deal:   (c) => [0, 1, 2, 3].forEach((i) => note(c, 500 + i * 120, i * 0.05, 0.05, 'triangle', 0.08)),
      bomb:   (c) => { blast(c, 0, 0.5, 0.5, 2600); thump(c, 0, 160, 38, 0.55, 0.5); },
      rocket: (c) => { [0, 1, 2, 3, 4].forEach((i) => note(c, 300 + i * 180, i * 0.045, 0.05, 'square', 0.09)); blast(c, 0.26, 0.65, 0.55, 3200); thump(c, 0.26, 200, 34, 0.7, 0.55); },
      win:    (c) => [523, 659, 784, 1046].forEach((f, i) => note(c, f, i * 0.12, 0.22, 'triangle', 0.13)),
      lose:   (c) => { note(c, 330, 0, 0.25); note(c, 233, 0.22, 0.4); },
      ach:    (c) => [1046, 1318, 1568].forEach((f, i) => note(c, f, i * 0.07, 0.15, 'sine', 0.1)),
    };
    return {
      // 音效响起前 BGM 先侧身让路，提示音永远在最前排
      play: (name) => { if (sndMuted || !volSfx || !seq[name]) return; try { BGM.duck(); seq[name](ac()); } catch (e) { /* 无声胜有声 */ } },
      applyVol: () => { if (master) master.gain.value = volSfx; },
      ctx: ac,
    };
  })();

  /* ---------- BGM：循环底噪，WebAudio 精确接缝 ---------- */
  const BGM = (() => {
    let buf = null, src = null, gain = null, loading = false, want = false;
    const target = () => 0.44 * volBgm;   // 滑块拉满也只到 44%，音乐是底噪不是主角
    const load = () => {
      if (buf || loading) return;
      loading = true;
      fetch('bgm.mp3')
        .then((r) => r.arrayBuffer())
        .then((ab) => new Promise((res, rej) => SFX.ctx().decodeAudioData(ab, res, rej)))
        .then((b) => {
          // mp3 编解码会在首尾垫静音，循环点掐在有声样本上才无缝
          const d = b.getChannelData(0);
          let a = 0, z = d.length - 1;
          while (a < z && Math.abs(d[a]) < 1e-3) a++;
          while (z > a && Math.abs(d[z]) < 1e-3) z--;
          buf = b;
          buf._ls = a / b.sampleRate;
          buf._le = z / b.sampleRate;
          loading = false;
          if (want) play();
        })
        .catch(() => { loading = false; });
    };
    const play = () => {
      want = true;
      if (sndMuted || !volBgm || src) return;
      if (!buf) return load();
      const c = SFX.ctx();
      if (c.state === 'suspended') return;      // 浏览器要手势，等 kick()
      gain = c.createGain();
      gain.gain.setValueAtTime(0.001, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.002, target()), c.currentTime + 1.5);
      src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = buf._ls;
      src.loopEnd = buf._le;
      src.connect(gain).connect(c.destination);
      src.start(c.currentTime, buf._ls);
    };
    /* 只掐声不改意愿：静音时用，解除后 kick() 接着放 */
    const fadeOut = (fast) => {
      if (!src) return;
      const c = SFX.ctx(), s = src, g = gain;
      src = null; gain = null;
      try {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.001), c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (fast ? 0.2 : 0.8));
        s.stop(c.currentTime + (fast ? 0.25 : 0.9));
      } catch (e) { /* 已经停了就随它 */ }
    };
    const stop = (fast) => { want = false; fadeOut(fast); };
    const duck = () => {
      if (!gain) return;
      const c = SFX.ctx(), t = c.currentTime;
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(target() * 0.35, t + 0.05);
        gain.gain.linearRampToValueAtTime(Math.max(0.002, target()), t + 0.9);
      } catch (e) { /* 让不了路就不让 */ }
    };
    const kick = () => { if (want && !src) play(); };
    const applyVol = () => {
      if (src && gain) {
        const c = SFX.ctx(), t = c.currentTime;
        try {
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), t);
          gain.gain.linearRampToValueAtTime(Math.max(0.002, target()), t + 0.15);
        } catch (e) { /* 拧不动就算了 */ }
      } else kick();   // 从 0 拧上来：还没开声就现开
    };
    return { play, stop, fadeOut, duck, kick, applyVol };
  })();
  // 浏览器的 autoplay 门禁：任何一次按下都顺手把音频上下文捞活
  document.addEventListener('pointerdown', () => {
    const c = SFX.ctx();
    if (c.state === 'suspended') c.resume().catch(() => {});
    BGM.kick();
  }, true);

  /* 标题栏声音双按钮（图标是 SVG，emoji 不上 UI） */
  const ICN = {
    vol:    '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    volX:   '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>',
    music:  '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    musicX: '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" x2="22" y1="2" y2="22"/></svg>',
    max:    '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    min:    '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>',
    eye:    '<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>',
  };
  const renderSndBtn = () => {
    $('sndBtn').innerHTML = ICN[sndMuted ? 'volX' : 'vol'];
    $('sndBtn').title = sndMuted ? '已静音，点击恢复' : '点击静音 · 悬停调音量';
  };
  const setMuted = (m) => {
    sndMuted = m;
    localStorage.setItem('ddz-mute', m ? '1' : '0');
    if (m) BGM.fadeOut(true);
    else { BGM.kick(); SFX.play('bid'); }
    renderSndBtn();
  };
  $('sndBtn').addEventListener('click', () => setMuted(!sndMuted));
  $('volSfx').value = Math.round(volSfx * 100);
  $('volBgm').value = Math.round(volBgm * 100);
  $('volSfx').addEventListener('input', () => {
    volSfx = $('volSfx').value / 100;
    localStorage.setItem('ddz-vol-sfx', $('volSfx').value);
    if (sndMuted && volSfx > 0) setMuted(false);
    SFX.applyVol();
  });
  $('volSfx').addEventListener('change', () => SFX.play('bid'));   // 松手给个样品音
  $('volBgm').addEventListener('input', () => {
    volBgm = $('volBgm').value / 100;
    localStorage.setItem('ddz-vol-bgm', $('volBgm').value);
    if (sndMuted && volBgm > 0) setMuted(false);
    BGM.applyVol();
  });
  renderSndBtn();

  /* ---------- 移动端横屏舞台 ----------
     小屏 + 对局中 → 全屏舞台（横屏铺满 / 竖屏旋转 90°，样式见 CSS） */
  const isMobile = () => matchMedia('(max-width: 920px)').matches;

  const updateStage = () => {
    document.body.classList.toggle('stage-on', isMobile() && !!S && S.phase !== 'lobby');
  };
  window.addEventListener('resize', updateStage);

  /* Android 上还能顺手申请全屏 + 锁横屏（iOS 忽略，靠 CSS 旋转兜底） */
  const tryLandscape = () => {
    if (!isMobile() || !document.documentElement.requestFullscreen) return;
    document.documentElement.requestFullscreen()
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  };

  const exitStage = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    updateStage();
  };

  /* ---------- 连接 ---------- */
  const connect = (onOpen) => {
    if (ws && ws.readyState === 1) { onOpen && onOpen(); return; }
    setConn('连接中…', false);
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { retries = 0; setConn('已连线', true); onOpen && onOpen(); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      handle(m);
    };
    ws.onclose = () => {
      setConn('已断线', false);
      if (leaving) return;
      if (sess && retries < 5) {
        retries += 1;
        setTimeout(() => connect(() => send({ t: 'rejoin', room: sess.room, pid: sess.pid })), 1200 * retries);
      } else {
        showView('lobby');
      }
    };
  };

  const handle = (m) => {
    if (m.t === 'joined') {
      sess = { room: m.room, pid: m.pid };
      saveSess();
      if (m.spec) setTimeout(() => toast('满员了，你在观战席 👀'), 300);
      return;
    }
    if (m.t === 'expired') { clearSess(); S = null; exitStage(); showView('lobby'); toast('房间已散场'); return; }
    if (m.t === 'err') { flashErr(m.msg); return; }
    if (m.t !== 'state') return;
    prevS = S;
    S = m.state;
    // 倒计时换算成本地时刻，滴答不吃时钟偏差
    S.deadlineAt = m.state.deadline ? Date.now() + m.state.deadline : null;
    if (m.ev) onEv(m.ev);
    render();
  };

  const flashErr = (msg) => toast(msg);

  /* ---------- 事件（气泡 / 结算） ---------- */
  const bubbleTimers = {};
  const bubble = (seat, text) => {
    const host = seatEl(seat);
    if (!host) return;
    const b = host.querySelector('.bubble');
    if (!b) return;
    b.textContent = text;
    b.hidden = false;
    clearTimeout(bubbleTimers[seat]);
    bubbleTimers[seat] = setTimeout(() => { b.hidden = true; }, 2400);
  };

  const seatEl = (seat) => {
    if (!S) return null;
    if (seat === S.me) return document.querySelector('.me-zone');
    if (seat === (S.me + 1) % 3) return $('oppRight');
    return $('oppLeft');
  };

  const onEv = (ev) => {
    switch (ev.k) {
      case 'deal': case 'redeal':
        trick = {}; selected.clear();
        $('endPanel').hidden = true;
        SFX.play('deal');
        if (ev.k === 'redeal') toast('没人叫地主，重新发牌');
        else if (S.wilds && S.wilds.length)
          toast(`🃏 本局癞子：${S.wilds.map(rankTxt).join(' 和 ')}（可替任意牌，单出算本身）`);
        break;
      case 'bid':
        SFX.play('bid');
        bubble(ev.seat, ev.v > 0 ? `${ev.v} 分！` : '不叫');
        break;
      case 'landlord':
        trick = {}; selected.clear();
        SFX.play('bid');
        toast(`${S.players[ev.seat].name} 以 ${ev.bid} 分当上地主`);
        break;
      case 'played':
        if (!prevS || !prevS.last) trick = {};
        trick[ev.seat] = { cards: ev.cards, name: ev.name };
        if (ev.seat === S.me) selected.clear(); // 服务器确认出牌成功，此刻才清选中
        SFX.play(ev.name.includes('王炸') ? 'rocket' : ev.name.includes('炸') ? 'bomb' : 'play');
        break;
      case 'pass':
        trick[ev.seat] = 'pass';
        if (ev.seat === S.me) selected.clear();
        SFX.play('pass');
        bubble(ev.seat, '不要');
        break;
      case 'say':
        bubble(ev.seat, PHRASES[ev.i] || '…');
        break;
      case 'offline':
        toast(`${S.players[ev.seat].name} 掉线了，等 TA 回来（30 秒后自动托管）`);
        break;
      case 'reveal':
        toast(`👁 ${S.players[ev.seat].name} 明牌！总倍数 ×2`);
        break;
      case 'auto':
        toast(`${S.players[ev.seat].name} ${ev.on ? '开启了托管 🕹️' : '取消了托管'}`);
        break;
      case 'spec':
        toast(`${esc(ev.name)} 来围观了 👀`);
        break;
      case 'opts': {
        const lz = ev.laizi ? (ev.laizi === 2 ? ' + 天地癞子' : ' + 癞子') : '';
        toast(`房主把玩法切成「${ev.noShuffle ? '🌪️ 不洗牌' : '🀄 经典'}${lz}」${ev.live ? '，下一局生效' : ''}`);
        break;
      }
      case 'ach':
        ev.got.forEach((g, gi) => {
          const who = g.seat === S.me ? '' : `${S.players[g.seat].name} `;
          g.ids.forEach((id, ii) => {
            const a = ACHS[id];
            if (a) setTimeout(() => { toast(`🏅 ${who}成就达成「${a[0]} ${a[1]}」`); SFX.play('ach'); }, (gi * 2 + ii) * 1400);
          });
        });
        break;
      case 'join': toast(`${esc(ev.name)} 上桌了`); break;
      case 'rejoin': toast(`${esc(ev.name)} 回来了`); break;
      case 'leave': toast('有人离开了牌桌'); break;
      case 'end': showEnd(ev); break;
    }
  };

  const showEnd = (ev) => {
    const lord = S.landlord;
    const spec = S.me < 0;
    const meLord = S.me === lord;
    const iWin = (ev.lordWin && meLord) || (!ev.lordWin && !meLord);
    const myDelta = meLord ? (ev.lordWin ? ev.delta * 2 : -ev.delta * 2) : (ev.lordWin ? -ev.delta : ev.delta);
    $('endTitle').textContent = spec
      ? (ev.lordWin ? '👑 地主胜利' : '🌾 农民胜利')
      : (iWin ? '🎉 你赢了！' : '😵 你输了');
    $('endDetail').innerHTML =
      (spec ? `${ev.lordWin ? '地主' : '农民'}把把清光` :
        `${ev.lordWin ? '地主' : '农民'}胜利 · 你${myDelta >= 0 ? '赢' : '输'} <b class="${myDelta >= 0 ? 'good' : 'bad'}">${Math.abs(myDelta)}</b> 分`) +
      (ev.bombs ? `<br>💣 炸弹 ×${ev.bombs}，倍数翻上天` : '') +
      (S.reveals ? `<br>👁 明牌 ×${S.reveals}` : '') +
      (ev.spring ? '<br>🌸 春天！农民一张牌没打出去' : '') +
      (ev.antiSpring ? '<br>🌱 反春！地主只出了一手牌' : '');
    $('endScores').innerHTML = S.players.map((p, i) =>
      `<li>${i === lord ? '👑 ' : '🌾 '}${esc(p.name)}${i === S.me ? '（你）' : ''} <span class="${p.score >= 0 ? 'good' : 'bad'}">${p.score}</span></li>`).join('');
    $('againBtn').hidden = spec || S.host !== S.me;
    $('endPanel').hidden = false;
    renderActions(); // 面板亮起，桌面操作条同步静默
    SFX.play(spec ? 'bid' : iWin ? 'win' : 'lose');
  };

  /* ---------- 视图 ---------- */
  const showView = (v) => {
    $('lobbyView').hidden = v !== 'lobby';
    $('roomView').hidden = v !== 'room';
    $('tableView').hidden = v !== 'table';
    // 进房起乐、回大厅收乐——退场淡出，不搞戛然而止
    if (v === 'lobby') BGM.stop(); else BGM.play();
  };

  let lastTurnSig = '';
  const render = () => {
    updateStage();
    renderBar();
    if (!S) { showView('lobby'); return; }
    // 轮到自己了：叮一声（同一手只响一次）
    if ((S.phase === 'bid' || S.phase === 'play') && S.me >= 0 && S.turn === S.me) {
      const sig = `${S.phase}:${S.turn}:${S.players[S.me].count}:${S.last ? S.last.seat : -1}`;
      if (sig !== lastTurnSig) { SFX.play('turn'); lastTurnSig = sig; }
    }
    if (ws && ws.readyState === 1) setConn(`房间 ${S.code} · 已连线`, true);
    if (S.phase === 'lobby') { renderRoom(); showView('room'); }
    else { renderTable(); showView('table'); }
  };

  /* 标题栏按钮：模式切换（房主）、托管（对局中） */
  const renderBar = () => {
    const inGame = S && (S.phase === 'bid' || S.phase === 'play');
    const amHost = S && S.host === S.me;
    $('modeBtn').hidden = !(S && amHost);
    if (S) {
      const lz = S.opts.laizi ? (S.opts.laizi === 2 ? ' +天地癞' : ' +癞子') : '';
      $('modeBtn').textContent = (S.opts.noShuffle ? '不洗牌' : '经典') + lz + ' ▾';
    }
    $('autoBtn').hidden = !(inGame && S.me >= 0);
    if (inGame && S.me >= 0) {
      const on = S.players[S.me].auto;
      $('autoBtn').textContent = on ? '取消托管' : '托管';
      $('autoBtn').classList.toggle('on', on);
    }
    $('barLeave').hidden = !S;
  };

  const renderRoom = () => {
    $('roomCode').textContent = S.code;
    // 玩法选择：房主可点，其他人只读
    const amHost = S.host === S.me;
    const dis = amHost ? '' : 'disabled';
    $('modeRow').innerHTML =
      '<span class="mode-label">洗牌</span>' +
      `<button class="mode-pill ${!S.opts.noShuffle ? 'on' : ''}" data-shuffle="0" ${dis}>经典</button>` +
      `<button class="mode-pill ${S.opts.noShuffle ? 'on' : ''}" data-shuffle="1" ${dis}>不洗牌</button>` +
      '<span class="mode-label">癞子</span>' +
      [['0', '无'], ['1', '癞子'], ['2', '天地癞子']].map(([v, label]) =>
        `<button class="mode-pill ${String(S.opts.laizi || 0) === v ? 'on' : ''}" data-laizi="${v}" ${dis}>${label}</button>`
      ).join('');
    const isHost = S.host === S.me;
    $('seatRow').innerHTML = [0, 1, 2].map((i) => {
      const p = S.players[i];
      if (!p) return '<div class="seat empty"><b>空位</b><span>等朋友或机器人</span></div>';
      return `<div class="seat ${i === S.me ? 'mine' : ''}">
        <b>${p.bot ? '' : '🧑'} ${esc(p.name)}</b>
        <span>${i === S.host ? '房主' : p.bot ? '待命中' : '已就座'}${i === S.me ? ' · 你' : ''}</span>
      </div>`;
    }).join('');
    $('addBotBtn').hidden = !isHost;
    $('addBotBtn').innerHTML = ADDBOT_HTML;   // 撤掉「补位中…」占位
    $('addBotBtn').disabled = S.players.length >= 3;
    $('kickBotBtn').hidden = !isHost || !S.players.some((p) => p.bot);
    $('startBtn').hidden = !isHost;
    $('startBtn').disabled = S.players.length < 3;
    $('startBtn').textContent = S.players.length < 3 ? `开局（${S.players.length}/3）` : '开局！';
  };

  /* 身份章：地主金、农民绿——分完角色就一直挂着 */
  const roleChip = (seat) => {
    if (S.landlord < 0) return '';
    return S.landlord === seat
      ? '<i class="role lord">👑 地主</i>'
      : '<i class="role farm">🌾 农民</i>';
  };

  const flags = (p) => `${p.online ? '' : '📴 '}${p.auto ? '🕹️ 托管 · ' : ''}${p.revealed ? '👁 明牌 · ' : ''}`;

  const oppHtml = (seat) => {
    const p = S.players[seat];
    const isLord = S.landlord === seat;
    const isTurn = (S.phase === 'bid' || S.phase === 'play') && S.turn === seat;
    const shownHand = p.hand && seat !== S.me
      ? `<div class="opp-hand">${p.hand.slice().reverse().map((id) => cardHtml(id, 'mini tiny')).join('')}</div>`
      : '';
    return `<div class="opp-card ${isTurn ? 'turn' : ''} ${isLord ? 'lord' : ''}">
      <span class="bubble" hidden></span>
      <b>${p.bot ? '🤖' : '🧑'} ${esc(p.name)}${roleChip(seat)}</b>
      <span class="opp-meta">${flags(p)}剩 <em>${p.count}</em> 张 · ${p.score} 分</span>
      ${shownHand}
      ${isTurn ? '<span class="thinking">思考中…</span>' : ''}
    </div>`;
  };

  const trickHtml = (seat) => {
    const a = trick[seat];
    if (!a) return '';
    if (a === 'pass') return '<span class="pass-tag">不要</span>';
    return miniCards(a.cards) + `<span class="combo-tag">${esc(a.name)}</span>`;
  };

  const renderTable = () => {
    const meSeat = S.me >= 0 ? S.me : 0;   // 观战者借用 0 号位视角
    const right = (meSeat + 1) % 3;
    const left = (meSeat + 2) % 3;
    wildSet = new Set(S.wilds || []);

    // 重连回填：本地事件流断档时，用快照里「当前要压的那手」补上出牌展示
    if (S.last && trick[S.last.seat] === undefined) {
      trick[S.last.seat] = { cards: S.last.cards, name: S.last.name };
    }

    // 底牌与倍数（炸弹和明牌都翻倍）
    $('bottomCards').innerHTML = S.bottom.map((id) =>
      id < 0 ? '<div class="pcard mini back"></div>' : cardHtml(id, 'mini')).join('');
    const mult = Math.pow(2, (S.bombs || 0) + (S.reveals || 0));
    $('multInfo').innerHTML = (S.phase === 'bid'
      ? `叫分中 · 当前 <b>${S.bid || '-'}</b> 分`
      : `底分 <b>${S.bid}</b> · 💣×${S.bombs}${S.reveals ? ` · 👁×${S.reveals}` : ''} · 倍数 <b>×${mult}</b>`)
      + (S.wilds && S.wilds.length ? ` · 癞子 <b class="wild-txt">${S.wilds.map(rankTxt).join(' / ')}</b>` : '')
      + (S.opts && S.opts.noShuffle ? ' · 🌪️ 不洗牌' : '');

    $('oppLeft').innerHTML = oppHtml(left);
    $('oppRight').innerHTML = oppHtml(right);
    $('trickLeft').innerHTML = trickHtml(left);
    $('trickRight').innerHTML = trickHtml(right);
    $('trickMine').innerHTML = trickHtml(meSeat);

    // 底部座位（我，或观战时的 0 号玩家）
    const p = S.players[meSeat];
    const isTurn = (S.phase === 'bid' || S.phase === 'play') && S.turn === meSeat;
    $('meInfo').innerHTML = `<span class="bubble" hidden></span>
      <b class="${isTurn ? 'turn-glow' : ''}">${p.bot ? '🤖' : '🧑'} ${esc(p.name)}${S.me < 0 ? '' : '（你）'}${roleChip(meSeat)}</b>
      <span class="opp-meta">${flags(p)}${p.score} 分${S.me < 0 ? ' · 👀 观战视角' : ''}</span>`;

    // 手牌：自己可选；观战时显示 0 号玩家（明牌给真牌，否则牌背）
    let handHtml = '';
    if (S.me >= 0) {
      selected.forEach((id) => { if (!p.hand.includes(id)) selected.delete(id); });
      handHtml = (p.hand || []).slice().reverse().map((id) => cardHtml(id, selected.has(id) ? 'sel' : '')).join('');
    } else if (p.hand) {
      handHtml = p.hand.slice().reverse().map((id) => cardHtml(id)).join('');
    } else {
      handHtml = Array.from({ length: p.count }, () => '<div class="pcard back"></div>').join('');
    }
    $('handRow').innerHTML = handHtml;

    // 左下：在场人员（含观战）；右下：牌局历史——都轻着显示
    $('crewCard').innerHTML = '<b>在场</b>' + S.players.map((pl, i) =>
      `<span>${S.landlord === i ? '👑' : pl.bot ? '🤖' : '🧑'} ${esc(pl.name)}${pl.online ? '' : ' 📴'}</span>`).join('') +
      (S.specs && S.specs.length
        ? `<i>👀 ${S.specs.map(esc).join('、')}</i>` : '');
    $('histCard').innerHTML = (S.history && S.history.length)
      ? '<b>战报</b>' + S.history.slice(-5).reverse().map((h) =>
          `<span>第${h.n}局 ${h.lordWin ? '👑胜' : '🌾胜'} ${h.delta * 2} 分${h.spring ? ' 🌸' : ''}${h.bombs ? ' 💣' + h.bombs : ''}</span>`).join('')
      : '<b>战报</b><i>首局进行中…</i>';

    renderActions();
  };

  const renderActions = () => {
    const row = $('actionRow');
    // 结算面板开着时操作条静默——按钮只在一处出现，不叠影
    if (S.phase === 'end' && !$('endPanel').hidden) { row.innerHTML = ''; return; }
    // 观战席：只能看（离开在标题栏）
    if (S.me < 0) {
      row.innerHTML = '<span class="wait-tip">' + ICN.eye + ' 观战中</span>';
      return;
    }
    const meP = S.players[S.me];
    const myTurn = S.turn === S.me;
    const inGame = S.phase === 'bid' || S.phase === 'play';
    let html = '';
    if (meP.auto && inGame) {
      html = '<span class="wait-tip">🕹️ 托管中，机器人代打…</span>' +
        '<button class="felt-btn primary" data-act="auto">取消托管</button>';
    } else if (S.phase === 'bid') {
      html = myTurn
        ? [0, 1, 2, 3].map((v) =>
            `<button class="felt-btn ${v === 3 ? 'primary' : ''}" data-bid="${v}" ${v > 0 && v <= S.bid ? 'disabled' : ''}>${v === 0 ? '不叫' : v + ' 分'}</button>`).join('')
        : `<span class="wait-tip">等 ${esc(S.players[S.turn].name)} 叫分…</span>`;
    } else if (S.phase === 'play') {
      const mustBeat = S.last && S.last.seat !== S.me;
      html = myTurn
        ? `<button class="felt-btn" data-act="pass" ${mustBeat ? '' : 'disabled'}>不出</button>
           <button class="felt-btn" data-act="hint">提示</button>
           <button class="felt-btn primary" data-act="play">出牌</button>`
        : `<span class="wait-tip">等 ${esc(S.players[S.turn].name)} 出牌…</span>`;
    } else if (S.phase === 'end') {
      html = S.host === S.me
        ? '<button class="felt-btn primary" data-act="again">再来一局</button>'
        : '<span class="wait-tip">等房主再开一局…</span>';
    }
    // 明牌只属于叫分环节：拿到牌就得亮底气，开打了才想明牌那叫马后炮（服务器也不收）
    if (S.phase === 'bid' && !meP.auto && !meP.revealed) {
      html += `<button class="felt-btn dim" data-act="reveal">${ICN.eye} 明牌 ×2</button>`;
    }
    // 倒计时挂件：当前行动者的沙漏（机器人/托管代打时服务器不发）
    row.innerHTML = cdChip() + html;
  };

  /* ---------- 出牌倒计时：服务器发剩余毫秒，本地滴答 ---------- */
  const cdChip = () => (S && S.deadlineAt && (S.phase === 'bid' || S.phase === 'play'))
    ? `<span class="cd" id="cdNum">${Math.max(0, Math.ceil((S.deadlineAt - Date.now()) / 1000))}</span>`
    : '';
  setInterval(() => {
    const el = document.getElementById('cdNum');
    if (!el || !S || !S.deadlineAt) return;
    const s = Math.max(0, Math.ceil((S.deadlineAt - Date.now()) / 1000));
    if (String(s) !== el.textContent) el.textContent = s;
    el.classList.toggle('hot', s <= 5 && S.turn === S.me);
  }, 300);

  /* ---------- 提示（简易找牌） ---------- */
  const groupHand = (hand) => {
    const g = new Map();
    hand.forEach((id) => { const r = rankOf(id); if (!g.has(r)) g.set(r, []); g.get(r).push(id); });
    return [...g.entries()].sort((a, b) => a[0] - b[0]);
  };

  const hint = () => {
    const hand = S.players[S.me].hand;
    const groups = groupHand(hand);
    selected.clear();
    const last = S.last && S.last.seat !== S.me ? S.last : null;
    let pickIds = null;
    if (!last) {
      const single = groups.find(([, ids]) => ids.length === 1);
      pickIds = single ? [single[1][0]] : [groups[0][1][0]];
    } else {
      const cards = last.cards;
      const lastRanks = cards.map(rankOf);
      const kind = last.name;
      const main = Math.max(...lastRanks.filter((r) => {
        const c = lastRanks.filter((x) => x === r).length;
        return c >= (kind === '对子' ? 2 : kind === '三张' ? 3 : 1);
      }));
      const size = { '单张': 1, '对子': 2, '三张': 3 }[kind];
      if (size) {
        const hit = groups.find(([r, ids]) => r > main && ids.length >= size);
        if (hit) pickIds = hit[1].slice(0, size);
      } else if (kind === '顺子' || kind === '连对') {
        const per = kind === '顺子' ? 1 : 2;
        const L = kind === '顺子' ? cards.length : cards.length / 2;
        const top = Math.max(...lastRanks);
        for (let hi = top + 1; hi <= 14 && !pickIds; hi++) {
          const want = Array.from({ length: L }, (_, k) => hi - L + 1 + k);
          if (want[0] < 3) continue;
          const got = want.map((r) => groups.find(([gr, ids]) => gr === r && ids.length >= per)?.[1].slice(0, per));
          if (got.every(Boolean)) pickIds = got.flat();
        }
      }
      if (!pickIds) {
        const bomb = groups.find(([r, ids]) => ids.length === 4 && (kind !== '💣 炸弹' || r > Math.max(...lastRanks)));
        if (bomb) pickIds = bomb[1];
        else if (hand.includes(52) && hand.includes(53) && kind !== '🚀 王炸') pickIds = [52, 53];
      }
    }
    if (!pickIds) {
      // 要不起：直接替你点「不出」
      toast('要不起，自动不出');
      selected.clear();
      send({ t: 'pass' });
      return;
    }
    pickIds.forEach((id) => selected.add(id));
    renderTable();
  };

  /* ---------- 交互 ---------- */
  $('randomName').addEventListener('click', () => { $('playerName').value = randomName(); });
  $('playerName').value = localStorage.getItem('ddz-name') || randomName();

  const myName = () => {
    const n = ($('playerName').value.trim() || randomName()).slice(0, 8);
    localStorage.setItem('ddz-name', n);
    return n;
  };

  $('createBtn').addEventListener('click', () => {
    leaving = false;
    connect(() => send({ t: 'create', name: myName(), guest: guestId() }));
  });
  $('joinBtn').addEventListener('click', () => {
    const input = $('joinCode');
    const code = input.value.trim().toUpperCase();
    if (code.length !== 4) {
      toast('房号是 4 位，问朋友要一下');
      input.classList.add('shake');
      input.focus();
      setTimeout(() => input.classList.remove('shake'), 500);
      return;
    }
    leaving = false;
    connect(() => send({ t: 'join', room: code, name: myName(), guest: guestId() }));
  });
  $('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

  $('roomCode').addEventListener('click', () => {
    const code = $('roomCode').textContent;
    (navigator.clipboard?.writeText(code) || Promise.reject()).then(
      () => { $('roomCode').textContent = '已复制!'; setTimeout(() => { $('roomCode').textContent = code; }, 900); },
      () => {});
  });

  const sendOpts = (patch) => send({ t: 'opts', noShuffle: S.opts.noShuffle, laizi: S.opts.laizi || 0, ...patch });

  $('modeRow').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    // 本地先亮再发包：隧道一来一回几百毫秒，等回包才变色就显得「卡」
    const group = b.dataset.shuffle !== undefined ? '[data-shuffle]' : '[data-laizi]';
    $('modeRow').querySelectorAll(group).forEach((x) => x.classList.toggle('on', x === b));
    if (b.dataset.shuffle !== undefined) sendOpts({ noShuffle: b.dataset.shuffle === '1' });
    if (b.dataset.laizi !== undefined) sendOpts({ laizi: Number(b.dataset.laizi) });
  });

  /* 标题栏「模式」按钮：弹出玩法菜单（房主专属） */
  $('modeBtn').addEventListener('click', (e) => {
    const menu = $('modeMenu');
    if (!menu.hidden) { menu.hidden = true; return; }
    const check = (on) => on ? ' ✓' : '';
    menu.innerHTML =
      `<button data-shuffle="0">经典洗牌${check(!S.opts.noShuffle)}</button>` +
      `<button data-shuffle="1">不洗牌${check(S.opts.noShuffle)}</button>` +
      '<hr class="menu-line">' +
      `<button data-laizi="0">无癞子${check(!S.opts.laizi)}</button>` +
      `<button data-laizi="1">癞子${check(S.opts.laizi === 1)}</button>` +
      `<button data-laizi="2">天地癞子${check(S.opts.laizi === 2)}</button>`;
    menu.hidden = false;
    const r = e.target.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 248, r.left - 60)) + 'px';
    menu.style.top = (r.bottom + 8) + 'px';
  });
  $('modeMenu').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.shuffle !== undefined) sendOpts({ noShuffle: b.dataset.shuffle === '1' });
    if (b.dataset.laizi !== undefined) sendOpts({ laizi: Number(b.dataset.laizi) });
    $('modeMenu').hidden = true;
  });
  document.addEventListener('click', (e) => {
    if (!$('modeMenu').hidden && !e.target.closest('#modeMenu') && !e.target.closest('#modeBtn'))
      $('modeMenu').hidden = true;
  });
  $('autoBtn').addEventListener('click', () => send({ t: 'auto', on: !S.players[S.me].auto }));
  const ADDBOT_HTML = $('addBotBtn').innerHTML;
  $('addBotBtn').addEventListener('click', () => {
    // 即时反馈占位，服务器回包后 renderRoom 恢复原貌
    $('addBotBtn').disabled = true;
    $('addBotBtn').textContent = '补位中…';
    send({ t: 'addBot' });
  });
  $('kickBotBtn').addEventListener('click', () => send({ t: 'kickBot' }));
  $('startBtn').addEventListener('click', () => { tryLandscape(); send({ t: 'start' }); });
  $('againBtn').addEventListener('click', () => { $('endPanel').hidden = true; tryLandscape(); send({ t: 'start' }); });
  $('endHide').addEventListener('click', () => { $('endPanel').hidden = true; if (S) renderActions(); });
  document.querySelectorAll('.ddz-close').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close()));

  const doLeave = () => {
    leaving = true;
    send({ t: 'leave' });
    clearSess();
    S = null; trick = {}; selected.clear();
    $('endPanel').hidden = true;
    exitStage();
    showView('lobby');
    setConn('', true);
    if (ws) { ws.close(); ws = null; }
  };
  $('leaveBtn').addEventListener('click', doLeave);
  $('barLeave').addEventListener('click', () => {
    if (!S || S.me < 0 || S.phase === 'lobby') { doLeave(); return; }
    ask('中途跑路会解散这一局，确定？').then((ok) => { if (ok) doLeave(); });
  });
  $('chatBtn').addEventListener('click', () => showPhrases($('chatBtn')));

  /* ---------- 手牌选择：点选 / 滑动连选 / 双击智能整组 ---------- */
  const toggleCard = (id) => {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    const el = $('handRow').querySelector(`[data-id="${id}"]`);
    if (el) el.classList.toggle('sel', selected.has(id));
  };

  /* 双击：同点数整组（对/三/炸）优先；单张则试着抓一条经过它的顺子 */
  const smartSelect = (id) => {
    if (!S || S.me < 0) return;
    const hand = S.players[S.me].hand || [];
    const r = rankOf(id);
    const groups = groupHand(hand);
    const mine = groups.find(([gr]) => gr === r);
    let pick = null;
    if (mine && mine[1].length >= 2) pick = mine[1];
    else if (r <= 14) {
      const has = new Set(groups.filter(([gr]) => gr <= 14).map(([gr]) => gr));
      let lo = r, hi = r;
      while (has.has(lo - 1)) lo--;
      while (has.has(hi + 1)) hi++;
      if (hi - lo + 1 >= 5) {
        pick = [];
        for (let x = lo; x <= hi; x++) pick.push(groups.find(([gr]) => gr === x)[1][0]);
      }
    }
    (pick || [id]).forEach((cid) => selected.add(cid));
    renderTable();
  };

  let drag = null;
  let lastTap = { id: null, t: 0 };

  $('handRow').addEventListener('pointerdown', (e) => {
    if (!S || S.me < 0) return;
    const c = e.target.closest('.pcard');
    if (!c || c.dataset.id === undefined) return;
    e.preventDefault();
    const id = Number(c.dataset.id);
    const now = Date.now();
    if (lastTap.id === id && now - lastTap.t < 350) {  // 双击/双触
      smartSelect(id);
      lastTap = { id: null, t: 0 };
      drag = null;
      return;
    }
    lastTap = { id, t: now };
    drag = { toggled: new Set([id]) };
    toggleCard(id);
  });

  $('handRow').addEventListener('pointermove', (e) => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pcard');
    if (!el || !$('handRow').contains(el) || el.dataset.id === undefined) return;
    const id = Number(el.dataset.id);
    if (drag.toggled.has(id)) return;
    drag.toggled.add(id);
    toggleCard(id);
  });

  ['pointerup', 'pointercancel'].forEach((ev) =>
    document.addEventListener(ev, () => { drag = null; }));

  // 操作按钮（事件委托）
  $('actionRow').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.bid !== undefined) return send({ t: 'bid', v: Number(btn.dataset.bid) });
    switch (btn.dataset.act) {
      /* 选中集不再乐观清空——等服务器确认真出去了才清，
         否则出牌被驳回后会出现「牌抬着、集合空」的鬼状态 */
      case 'pass': send({ t: 'pass' }); break;
      case 'play': {
        if (!selected.size) return toast('先选牌再出');
        send({ t: 'play', cards: [...selected] });
        break;
      }
      case 'hint': hint(); break;
      case 'again': tryLandscape(); send({ t: 'start' }); break;
      case 'reveal': send({ t: 'reveal' }); break;
      case 'auto': send({ t: 'auto', on: !S.players[S.me].auto }); break;
      case 'phrase': showPhrases(btn); break;
    }
  });

  /* 短语面板 */
  const showPhrases = (anchor) => {
    const pop = $('phrasePop');
    if (!pop.hidden) { pop.hidden = true; return; }
    pop.innerHTML = PHRASES.map((p, i) => `<button data-i="${i}">${p}</button>`).join('');
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 248, r.left - 100)) + 'px';
    pop.style.top = Math.max(8, r.top - pop.offsetHeight - 8) + 'px';
  };
  $('phrasePop').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { send({ t: 'say', i: Number(b.dataset.i) }); $('phrasePop').hidden = true; }
  });
  document.addEventListener('click', (e) => {
    /* 点外面就收起——但要放行两个开关自己（不然刚开就被这行关上，按钮就成了「点了没反应」） */
    if (!$('phrasePop').hidden && !e.target.closest('#phrasePop')
      && !e.target.closest('[data-act="phrase"]') && !e.target.closest('#chatBtn'))
      $('phrasePop').hidden = true;
  });

  /* ---------- 排行榜与牌手档案 ---------- */
  $('rankBtn').addEventListener('click', () => {
    $('ddzRankBody').innerHTML = '<tr><td colspan="5" class="rank-empty">加载中……</td></tr>';
    $('rankModal').showModal();
    fetch(API_HTTP + '/rank').then((r) => r.json()).then((d) => {
      const top = d.top || [];
      $('ddzRankBody').innerHTML = top.length ? top.map((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
        const wr = r.games ? Math.round((r.wins / r.games) * 100) : 0;
        return `<tr class="${i < 3 ? 'r' + (i + 1) : ''}">
          <td class="r-no">${medal}</td><td>${esc(r.name)}</td>
          <td class="num"><b class="${r.score >= 0 ? 'good' : 'bad'}">${r.score}</b></td>
          <td class="num">${wr}%</td><td class="num">${r.best_streak}</td></tr>`;
      }).join('') : '<tr><td colspan="5" class="rank-empty">虚位以待——打满 3 局就能上榜</td></tr>';
    }).catch(() => { $('ddzRankBody').innerHTML = '<tr><td colspan="5" class="rank-empty">排行榜暂时联系不上</td></tr>'; });
  });

  const fmtId = (id) => id.replace(/(.{4})/g, '$1-').slice(0, -1);

  const loadProfile = () => {
    $('idCode').textContent = fmtId(guestId());
    $('pfStats').innerHTML = '<span class="dim-note">翻档案中……</span>';
    $('achGrid').innerHTML = '';
    fetch(`${API_HTTP}/me/${guestId()}`).then((r) => r.json()).then((d) => {
      const me = d.me;
      const unlocked = new Set(me ? me.ach : []);
      $('pfStats').innerHTML = me
        ? `<span>对局 <b>${me.games}</b></span><span>胜率 <b>${me.games ? Math.round((me.wins / me.games) * 100) : 0}%</b></span>
           <span>积分 <b class="${me.score >= 0 ? 'good' : 'bad'}">${me.score}</b></span>
           <span>当地主 <b>${me.lord_games}</b> 次胜 <b>${me.lord_wins}</b></span>
           <span>炸弹 <b>${me.bombs}</b></span><span>最高连胜 <b>${me.best_streak}</b></span>`
        : '<span class="dim-note">还没打过——战绩从第一局开始记</span>';
      $('achGrid').innerHTML = Object.entries(ACHS).map(([id, [icon, name, desc]]) =>
        `<div class="ach ${unlocked.has(id) ? 'on' : ''}"><i>${icon}</i><b>${name}</b><span>${desc}</span></div>`).join('');
    }).catch(() => { $('pfStats').innerHTML = '<span class="dim-note">档案室暂时联系不上</span>'; });
  };

  $('profileBtn').addEventListener('click', () => { $('profileModal').showModal(); loadProfile(); });

  $('idCode').addEventListener('click', () => {
    (navigator.clipboard?.writeText(guestId()) || Promise.reject()).then(
      () => { $('idCode').textContent = '已复制!'; setTimeout(() => { $('idCode').textContent = fmtId(guestId()); }, 900); },
      () => {});
  });

  $('idImportBtn').addEventListener('click', () => {
    const v = $('idImport').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!/^[A-Z0-9]{16}$/.test(v)) { $('idMsg').textContent = '身份码是 16 位字母数字（横杠可带可不带）'; return; }
    ask('导入后本设备将以该身份记战绩，确定？').then((ok) => {
      if (!ok) return;
      localStorage.setItem('azi-guest-id', v);
      $('idImport').value = '';
      $('idMsg').textContent = '✓ 身份已导入，下一局开始生效';
      loadProfile();
    });
  });

  /* ---------- 网页全屏（铺满浏览器视口，不是系统全屏） ---------- */
  let maxed = false;
  const setMax = (on) => {
    maxed = on;
    document.body.classList.toggle('ddz-max', on);
    $('fsBtn').innerHTML = on ? ICN.min + ' 退出全屏' : ICN.max + ' 全屏';
  };
  $('fsBtn').addEventListener('click', () => setMax(!maxed));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && maxed) setMax(false); });

  /* ---------- 启动：有旧会话就自动回座 ---------- */
  if (sess) {
    connect(() => send({ t: 'rejoin', room: sess.room, pid: sess.pid }));
  } else {
    setConn('', true);
  }
})();
