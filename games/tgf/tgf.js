/* ============================================
   The Great Fusion · Web 复刻版 v2
   原作：Carlo（2019，易语言）· 复刻：2026
   市场随机游走 · 黑市风险 · 澳门皇家 · 社区彩票
   ============================================ */
(function () {
  'use strict';

  /* ---------- 商品目录 ---------- */
  // 普通商品池（每局随机抽 12 种上架，价格区间继承 2019 item.ini）
  const COMMON_POOL = [
    { id: 'lt',  name: '辣条',     min: 3,      max: 40 },
    { id: 'dgy', name: '地沟油',   min: 20,     max: 300 },
    { id: 'zzr', name: '人造肉',   min: 30,     max: 400 },
    { id: 'lsr', name: '老鼠肉串', min: 30,     max: 350 },
    { id: 'mm',  name: '微商面膜', min: 20,     max: 500 },
    { id: 'slj', name: '饲料肉鸡', min: 50,     max: 500 },
    { id: 'gx',  name: '高档香烟', min: 100,    max: 800 },
    { id: 'szb', name: '山寨名表', min: 100,    max: 2000 },
    { id: 'mp',  name: '黄牛门票', min: 200,    max: 5000 },
    { id: 'gd',  name: '高仿古董', min: 200,    max: 5000 },
    { id: 'hj',  name: '黄金首饰', min: 500,    max: 5000 },
    { id: 'dc',  name: '电动车',   min: 1000,   max: 5000 },
    { id: 'wrj', name: '无人机',   min: 800,    max: 6000 },
    { id: 'dn',  name: '组装电脑', min: 800,    max: 12000 },
    { id: 'pb',  name: '平板电脑', min: 1000,   max: 15000 },
    { id: 'sj',  name: '水果手机', min: 3000,   max: 18000 },
    { id: 'btc', name: '比特币',   min: 20000,  max: 150000 },
  ];
  // 市场稀货：不定期现身交易市场，量少利润高，无违法风险
  const MARKET_RARES = [
    { id: 'mt', name: '茅台酒',   min: 1500, max: 9000, rare: true },
    { id: 'qx', name: '限量球鞋', min: 800,  max: 6000, rare: true },
  ];
  // 黑市货：利润高、波动狂，但交易与持有都有被抓风险
  const BLACK_POOL = [
    { id: 'yp',  name: '生肖邮票', min: 2000,   max: 30000,  black: true },
    { id: 'ysy', name: '走私药品', min: 300,    max: 3000,   black: true },
    { id: 'wwz', name: '文物字画', min: 5000,   max: 80000,  black: true },
    { id: 'xy',  name: '野生象牙', min: 30000,  max: 150000, black: true },
    { id: 'zsb', name: '走私珠宝', min: 50000,  max: 300000, black: true },
  ];

  /* 仓库档位：租金 = max(保底, 净资产 × 比例)——身家越厚，仓租越疼 */
  const WH = [
    { name: '随身背包', cap: 100,  base: 0,    rate: 0 },
    { name: '小仓库',   cap: 300,  base: 80,   rate: 0.005 },
    { name: '大仓库',   cap: 800,  base: 350,  rate: 0.012 },
    { name: '保税仓',   cap: 2000, base: 2000, rate: 0.025 },
  ];

  /* 难度模式：天数不同，起点不同 */
  const MODES = {
    15: { days: 15, cash: 8000, debt: 10000, label: '快闪局' },
    30: { days: 30, cash: 2000, debt: 5000,  label: '经典局' },
    60: { days: 60, cash: 500,  debt: 8000,  label: '马拉松' },
  };
  let mode = 30;
  let DAYS = 30;
  const DEPOSIT_RATE = 0.005;
  const DEBT_RATE = 0.10;
  const BLACK_UNLOCK = 50000;   // 黑市门槛：净资产
  /* 黑市风声：每天一掷，决定被抓概率；可花钱打点压一级 */
  const HEATS = [
    { label: '风平浪静', trade: 0.05, hold: 0.03, cls: 'calm' },
    { label: '有点风声', trade: 0.10, hold: 0.06, cls: 'mid' },
    { label: '严打进行中', trade: 0.20, hold: 0.14, cls: 'hot' },
  ];
  const rollHeat = () => {
    const r = Math.random();
    S.heat = r < 0.35 ? 0 : r < 0.8 ? 1 : 2;
    if (S.blackVip && S.heat === 2) log('🚨 线人来电：今晚严打，黑市谨慎行事！');
  };

  /* ---------- 文案 ---------- */
  const SPIKE_MSGS = [
    '直播间一哥吼了一嗓子「家人们」，{g}价格起飞！',
    '海外疯抢{g}，出口商加价扫货！',
    '短视频疯传{g}养生偏方，大妈们杀疯了！',
    '{g}进了非遗名录，身价暴涨！',
  ];
  const CRASH_MSGS = [
    '监管重拳出击，{g}无人敢收，价格崩了！',
    '媒体曝光{g}黑作坊，全城甩卖！',
    '{g}仓库集体到期，市场血流成河！',
    '有人在{g}里吃出了不可描述之物，价格跳水！',
  ];
  const LIFE_EVENTS = [
    { msg: '路边捡到一个钱包，失主留言「拿去花」。现金 +{v}', cash: [500, 3000] },
    { msg: '被碰瓷老哥讹了一笔。现金 -{v}', cash: [-2000, -300] },
    { msg: '吃了自己囤的存货，上吐下泻。健康 -{v}', health: [-15, -5] },
    { msg: '在天桥下睡了一夜好觉。健康 +{v}', health: [3, 8] },
    { msg: '手机中了「免费领狗蛋」病毒，被盗刷。现金 -{v}', cash: [-1500, -200] },
    { msg: '好心扶起摔倒大爷，获得锦旗和红包。现金 +{v}', cash: [200, 1000] },
  ];

  /* ---------- 工具 ---------- */
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const fmt = (n) => Math.round(n).toLocaleString('zh-CN');
  const pick = (arr) => arr[rand(0, arr.length - 1)];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const NAME_A = ['尼古拉斯', '铁柱', '翠花', '二狗', '建国', '阿珍', '富贵', '玛卡巴卡', '奥利给', '赛博'];
  const NAME_B = ['狗蛋', '发财', '暴富', '斯基', '施瓦辛格', '不亏', '梭哈', '回本', '大聪明', '锦鲤'];
  const randomName = () => pick(NAME_A) + '·' + pick(NAME_B);

  /* ---------- 声音：BGM 无缝循环 + WebAudio 合成音效 ----------
     一个按钮管静音，悬停滑块分管音效/音乐（和斗地主同一套操作习惯） */
  const SND = (() => {
    const loadV = (k, d) => {
      const v = parseInt(localStorage.getItem(k), 10);
      return Math.min(100, Math.max(0, Number.isNaN(v) ? d : v)) / 100;
    };
    let muted = localStorage.getItem('tgf-mute') === '1';
    let vSfx = loadV('tgf-vol-sfx', 100);
    let vBgm = loadV('tgf-vol-bgm', 55);
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
    const note = (f, t, dur, type = 'sine', vol = 0.12) => {
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
      buy:     () => { note(520, 0, 0.07, 'triangle', 0.12); note(392, 0.07, 0.1, 'triangle', 0.1); },
      sell:    () => { note(784, 0, 0.07, 'triangle', 0.12); note(1046, 0.08, 0.12, 'triangle', 0.12); },
      day:     () => { note(330, 0, 0.1, 'sine', 0.08); note(440, 0.1, 0.14, 'sine', 0.08); },
      luck:    () => [660, 880, 1100].forEach((f, i) => note(f, i * 0.07, 0.12, 'triangle', 0.09)),
      ouch:    () => { note(220, 0, 0.16, 'sawtooth', 0.1); note(165, 0.13, 0.22, 'sawtooth', 0.09); },
      bust:    () => [700, 500, 700, 500].forEach((f, i) => note(f, i * 0.11, 0.1, 'square', 0.1)),
      win:     () => [523, 659, 784].forEach((f, i) => note(f, i * 0.08, 0.14, 'triangle', 0.11)),
      lose:    () => { note(311, 0, 0.18); note(233, 0.16, 0.3); },
      jackpot: () => [523, 659, 784, 1046, 1318].forEach((f, i) => note(f, i * 0.09, 0.18, 'triangle', 0.12)),
      end:     () => [523, 659, 784, 1046].forEach((f, i) => note(f, i * 0.12, 0.22, 'triangle', 0.12)),
      dead:    () => { note(330, 0, 0.3, 'sine', 0.12); note(233, 0.28, 0.4, 'sine', 0.12); note(175, 0.6, 0.6, 'sine', 0.12); },
    };
    const bgmLoad = () => {
      if (buf || loading) return;
      loading = true;
      fetch('bgm.mp3')
        .then((r) => r.arrayBuffer())
        .then((ab) => new Promise((res, rej) => ac().decodeAudioData(ab, res, rej)))
        .then((b) => {
          // 掐掉 mp3 编码器的首尾静音垫，循环点落在有声样本上
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
    const duck = () => {
      if (!bGain) return;
      const c = ac(), t = c.currentTime;
      try {
        bGain.gain.cancelScheduledValues(t);
        bGain.gain.setValueAtTime(bGain.gain.value, t);
        bGain.gain.linearRampToValueAtTime(bgmTarget() * 0.4, t + 0.05);
        bGain.gain.linearRampToValueAtTime(Math.max(0.002, bgmTarget()), t + 0.8);
      } catch (e) { /* 让不了就不让 */ }
    };
    return {
      play: (n) => { if (muted || !vSfx || !seq[n]) return; try { duck(); seq[n](); } catch (e) { /* 无声胜有声 */ } },
      bgm: bgmPlay,
      kick: () => { if (wantBgm && !bSrc) bgmPlay(); },
      resume: () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
      muted: () => muted,
      setMuted: (m) => { muted = m; localStorage.setItem('tgf-mute', m ? '1' : '0'); if (m) bgmFadeOut(true); else bgmPlay(); },
      setSfx: (v) => { vSfx = v; localStorage.setItem('tgf-vol-sfx', Math.round(v * 100)); if (master) master.gain.value = v; },
      setBgm: (v) => {
        vBgm = v; localStorage.setItem('tgf-vol-bgm', Math.round(v * 100));
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

  /* ---------- 状态 ---------- */
  let S = null;
  let playerName = localStorage.getItem('tgf-name') || '';
  let goods = [];      // 本局上架的普通商品
  let allGoods = [];   // 普通 + 黑市
  const byId = (id) => allGoods.find((g) => g.id === id);

  const newGame = () => {
    const M = MODES[mode];
    DAYS = M.days;
    goods = [...COMMON_POOL].sort(() => Math.random() - 0.5).slice(0, 12)
      .sort((a, b) => a.min - b.min);
    allGoods = goods.concat(MARKET_RARES, BLACK_POOL);
    S = {
      day: 1, cash: M.cash, deposit: 0, debt: M.debt,
      health: 100, wh: 0, inv: {}, prices: {}, prev: {}, avail: {},
      hist: {}, tip: null, lotto: { tickets: [], last: null }, over: false,
      blackVip: false, casinoVip: false, // 验资通过后本局放行
      heat: 1, bribedDay: 0, karma: 0,
      casinoPL: 0, diceHist: [], numHist: [], raceLast: null,
      teaDay: 0, bloodDay: 0,
    };
    S.stock = {};
    allGoods.forEach((g) => {
      S.prices[g.id] = rand(g.min, g.max);
      S.hist[g.id] = { lo: S.prices[g.id], hi: S.prices[g.id] };
      S.avail[g.id] = Math.random() < (g.black ? 0.4 : g.rare ? 0.25 : 0.9);
      S.stock[g.id] = S.avail[g.id] ? supplyFor(g) : 0;
    });
    rollHeat();
    $('gameLog').innerHTML = '';
    // 记一次开局（游玩统计，静默失败）
    fetch(API + '/games/tgf/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }).catch(() => {});
    log(`【${M.label}】第 1 天。你揣着 ${fmt(M.cash)} 现金和 ${fmt(M.debt)} 高利贷进了城。债主说：${DAYS} 天后见。`);
    $('statDayMax').textContent = DAYS;
    $('barDays').textContent = `TRADE · SURVIVE · ${DAYS} DAYS`;
    switchTab('market');
    render();
  };

  /* 仓租：保底 + 净资产百分比 */
  const rentFor = (w) => w.rate === 0 ? 0 : Math.max(w.base, Math.ceil(Math.max(0, netWorth()) * w.rate));

  /* ---------- 价格体系：随机游走 + 软边界 + 事件 ---------- */
  const rollPrices = () => {
    rollHeat();
    S.prev = { ...S.prices };
    allGoods.forEach((g) => {
      let p = S.prices[g.id];
      // 黑市货波动 ±45%，普通货 ±28%
      const vol = g.black ? 0.45 : 0.28;
      let f = 1 + (Math.random() * 2 - 1) * vol;
      // 软边界：越界后强力均值回归，底价顶价不再是铁板
      if (p < g.min * 0.8) f = Math.max(f, 1.15);
      if (p > g.max * 1.2) f = Math.min(f, 0.85);
      p = Math.max(1, Math.round(p * f));
      p = Math.min(Math.round(g.max * 1.5), Math.max(Math.round(g.min * 0.5), p));
      S.prices[g.id] = p;
      S.avail[g.id] = Math.random() < (g.black ? 0.4 : g.rare ? 0.25 : 0.88);
      S.stock[g.id] = S.avail[g.id] ? supplyFor(g) : 0;
      S.hist[g.id].lo = Math.min(S.hist[g.id].lo, p);
      S.hist[g.id].hi = Math.max(S.hist[g.id].hi, p);
    });

    // 昨日小道消息兑现（75% 灵验）
    if (S.tip) {
      const { id, dir } = S.tip;
      if (Math.random() < 0.75) {
        const g = byId(id);
        applyEvent(g, dir);
        log(`📰 小道消息应验了！【${g.name}】${dir > 0 ? '疯涨' : '崩盘'}！`);
      } else {
        log('📰 昨天的小道消息是个屁，白等了。');
      }
      S.tip = null;
    } else if (Math.random() < 0.5) {
      // 常规市场事件
      const pool = goods.filter((g) => S.avail[g.id]);
      if (pool.length) {
        const g = pick(pool);
        const dir = Math.random() < 0.5 ? 1 : -1;
        applyEvent(g, dir);
        log((dir > 0 ? '📈 ' : '📉 ') + pick(dir > 0 ? SPIKE_MSGS : CRASH_MSGS).replace('{g}', g.name));
      }
    }

    // 30% 概率放出明日小道消息
    if (Math.random() < 0.3) {
      const g = pick(allGoods);
      const dir = Math.random() < 0.5 ? 1 : -1;
      S.tip = { id: g.id, dir };
      log(`📰 小道消息：明天【${g.name}】可能${dir > 0 ? '大涨' : '大跌'}（仅供参考，别全信）`);
    }

    MARKET_RARES.forEach((g) => {
      if (S.avail[g.id]) log(`✨ 市场稀货：今天有人出【${g.name}】，仅 ${S.stock[g.id]} 件`);
    });
    BLACK_POOL.forEach((g) => {
      if (S.avail[g.id] && S.blackVip) log(`🌑 黑市线报：今晚有人出手【${g.name}】`);
    });
  };

  /* 每日货源：贵货稀缺——这是 2019 原版就有的「库存」机制回归 */
  const supplyFor = (g) => {
    if (g.black) return rand(1, 6);
    if (g.rare) return rand(2, 10);
    if (g.max <= 500) return rand(200, 999);
    if (g.max <= 5000) return rand(60, 300);
    if (g.max <= 20000) return rand(15, 60);
    return rand(3, 12); // 比特币 / 进口汽车这类硬通货
  };

  /* 市场事件强度分层：便宜货能暴涨暴跌，贵货波澜有限 */
  const applyEvent = (g, dir) => {
    const p = S.prices[g.id];
    if (dir > 0) {
      const mul = g.max <= 5000 ? rand(3, 7) : g.max <= 50000 ? rand(2, 4) : 1 + rand(5, 15) / 10;
      const cap = g.max * (g.max <= 5000 ? 6 : g.max <= 50000 ? 3 : 2);
      S.prices[g.id] = Math.min(cap, Math.round(p * mul));
    } else {
      const div = g.max <= 5000 ? rand(3, 7) : rand(2, 4);
      S.prices[g.id] = Math.max(1, Math.floor(p / div));
    }
    S.hist[g.id].lo = Math.min(S.hist[g.id].lo, S.prices[g.id]);
    S.hist[g.id].hi = Math.max(S.hist[g.id].hi, S.prices[g.id]);
  };

  const invCount = () => Object.values(S.inv).reduce((s, i) => s + i.qty, 0);
  const capNow = () => WH[S.wh].cap;
  const netWorth = () =>
    S.cash + S.deposit - S.debt +
    Object.entries(S.inv).reduce((s, [id, i]) => s + i.qty * (S.prices[id] || 0), 0);
  const blackUnlocked = () => netWorth() >= BLACK_UNLOCK;
  const casinoOpen = () => S.cash > 0 && netWorth() > 0;

  /* 善心减罚：每 1 万善心罚款减 10%，至多减半 */
  const fineCut = () => Math.min(0.5, Math.floor((S.karma || 0) / 10000) * 0.1);
  const fineAmt = (base) => Math.ceil(base * (1 - fineCut()));
  const mercyNote = () => fineCut() > 0 ? `（社区大妈联名求情，罚款已减 ${Math.round(fineCut() * 100)}%）` : '';

  /* ---------- 过一天 ---------- */
  const nextDay = () => {
    if (S.over) return;
    S.day += 1;
    if (S.day > DAYS) return endGame(null, true); // 按第 40 天收盘价结算
    SND.play('day');

    S.deposit = Math.floor(S.deposit * (1 + DEPOSIT_RATE));
    if (S.debt > 0) S.debt = Math.ceil(S.debt * (1 + DEBT_RATE));

    // 仓租：现金 → 存款 → 挂账进高利贷
    const rent = rentFor(WH[S.wh]);
    if (rent > 0) {
      if (S.cash >= rent) S.cash -= rent;
      else if (S.cash + S.deposit >= rent) { S.deposit -= rent - S.cash; S.cash = 0; log(`🏪 仓租 ${fmt(rent)}：现金不够，从存款里扣了`); }
      else { S.debt += rent; log(`🏪 仓租 ${fmt(rent)} 付不出！房东把账卖给了你的债主（欠债 +${fmt(rent)}）`); }
    }

    // 彩票开奖（昨日购买，今日开）
    drawLottery();

    const nightHold = HEATS[S.heat].hold; // 昨夜的风声决定今晨查抄概率
    rollPrices();

    // 隔夜持有黑货被查
    const blackHeld = BLACK_POOL.filter((g) => S.inv[g.id]?.qty > 0);
    if (blackHeld.length && Math.random() < nightHold) {
      const fine = fineAmt(Math.ceil(S.cash * 0.3));
      let seized = 0;
      blackHeld.forEach((g) => { seized += S.inv[g.id].qty; delete S.inv[g.id]; });
      S.cash -= fine;
      S.health -= rand(5, 12);
      SND.play('bust');
      log(`🚨 凌晨突击检查！${seized} 件黑货全部没收，罚款 ${fmt(fine)}，还挨了两下${mercyNote()}`);
    }

    if (Math.random() < 0.35) {
      const ev = pick(LIFE_EVENTS);
      if (ev.cash) {
        const v = rand(Math.min(...ev.cash), Math.max(...ev.cash));
        S.cash = Math.max(0, S.cash + v);
        SND.play(v >= 0 ? 'luck' : 'ouch');
        log((v >= 0 ? '🍀 ' : '💸 ') + ev.msg.replace('{v}', fmt(Math.abs(v))));
      } else {
        const v = rand(Math.min(...ev.health), Math.max(...ev.health));
        S.health = Math.min(100, S.health + v);
        SND.play(v >= 0 ? 'luck' : 'ouch');
        log((v >= 0 ? '💪 ' : '🤢 ') + ev.msg.replace('{v}', Math.abs(v)));
      }
    }

    if (S.debt >= 50000 && Math.random() < 0.5) {
      const dmg = rand(8, 18);
      S.health -= dmg;
      SND.play('ouch');
      log(`👊 债主带着两位纹身壮汉来「关心」你。健康 -${dmg}`);
    }

    if (S.health <= 0) return endGame('猝死街头', false);
    render();
  };

  /* ---------- 交易（Popover） ---------- */
  let trade = null;

  const openTrade = (mode, id, anchor) => {
    if (S.over) return;
    const g = byId(id);
    const price = S.prices[id];
    const held = S.inv[id]?.qty || 0;
    if (mode === 'buy' && !S.avail[id]) return log('🚫 ' + g.name + ' 今天没货');

    const affordable = Math.floor((S.cash + S.deposit) / price); // 存款可自动取出补足
    const maxQty = mode === 'buy'
      ? Math.min(affordable, capNow() - invCount(), S.stock[id])
      : held;
    if (mode === 'buy' && maxQty <= 0) {
      return log(
        affordable <= 0 ? `💰 就算掏空银行也买不起一件 ${g.name}`
        : S.stock[id] <= 0 ? `📭 ${g.name} 今日货源已被扫空`
        : `📦 仓储满了（${capNow()} 件），去租仓库`
      );
    }
    if (mode === 'sell' && maxQty <= 0) return log('🎒 你没有 ' + g.name);

    trade = { mode, id, price, maxQty };
    $('popTitle').innerHTML = (mode === 'buy' ? '买入' : '卖出') + ' · ' + g.name + (g.black ? ' <i class="badge black">黑</i>' : '');
    const h = S.hist[id];
    const avg = held ? Math.round(S.inv[id].cost / held) : null;
    $('popMeta').innerHTML =
      `<span>现价 <b>${fmt(price)}</b></span>` +
      `<span>本局波动 ${fmt(h.lo)} ~ ${fmt(h.hi)}</span>` +
      (held ? `<span>持仓 ×${held} · 均价 <b class="${price >= avg ? 'up' : 'down'}">${fmt(avg)}</b></span>` : '') +
      (g.black ? `<span class="bad">⚠ 风声「${HEATS[S.heat].label}」：被抓概率 ${Math.round(HEATS[S.heat].trade * 100)}%（罚款+没收）</span>` : '');
    $('popQty').value = maxQty;
    $('popQty').max = maxQty;
    updatePopTotal();

    const pop = $('tradePop');
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const pw = 280;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw)) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    $('popQty').focus();
    $('popQty').select();
  };

  const updatePopTotal = () => {
    if (!trade) return;
    const qty = Math.max(1, Math.min(trade.maxQty, Number($('popQty').value) || 0));
    const total = qty * trade.price;
    const needBank = trade.mode === 'buy' && total > S.cash;
    $('popTotal').innerHTML =
      `${trade.mode === 'buy' ? '花费' : '进账'} <b>${fmt(total)}</b>` +
      (needBank ? ` <em class="dim">（现金不足，自动从存款取 ${fmt(total - S.cash)}）</em>` : '');
    $('popOk').textContent = trade.mode === 'buy' ? `买入 ${qty} 件` : `卖出 ${qty} 件`;
  };

  const closeTrade = () => { $('tradePop').hidden = true; trade = null; };

  const doTrade = () => {
    if (!trade) return;
    const qty = Math.max(1, Math.min(trade.maxQty, Number($('popQty').value) || 0));
    const g = byId(trade.id);
    const total = trade.price * qty;

    // 黑市交易风险（概率随当日风声浮动）
    if (g.black && Math.random() < HEATS[S.heat].trade) {
      SND.play('bust');
      const fine = fineAmt(Math.ceil((S.cash + S.deposit) * 0.2));
      if (trade.mode === 'buy') {
        payFrom(total + fine);
        log(`🚨 交易黑【${g.name}】时被便衣抓个正着！货款打水漂，再罚 ${fmt(fine)}${mercyNote()}`);
      } else {
        const slot = S.inv[trade.id];
        slot.qty -= qty; slot.cost = Math.max(0, slot.cost - Math.round((slot.cost / (slot.qty + qty)) * qty));
        if (slot.qty <= 0) delete S.inv[trade.id];
        payFrom(fine);
        log(`🚨 出手【${g.name}】时对方是钓鱼执法！${qty} 件全部没收，罚款 ${fmt(fine)}${mercyNote()}`);
      }
      closeTrade();
      render();
      return;
    }

    if (trade.mode === 'buy') {
      payFrom(total);
      S.stock[trade.id] = Math.max(0, S.stock[trade.id] - qty);
      const slot = S.inv[trade.id] || { qty: 0, cost: 0 };
      slot.qty += qty; slot.cost += total;
      S.inv[trade.id] = slot;
      SND.play('buy');
      log(`🛒 买入 ${g.name} ×${qty}，花费 ${fmt(total)}`);
    } else {
      const slot = S.inv[trade.id];
      const costPart = Math.round((slot.cost / slot.qty) * qty);
      slot.qty -= qty; slot.cost -= costPart;
      if (slot.qty <= 0) delete S.inv[trade.id];
      S.cash += total;
      const profit = total - costPart;
      SND.play(profit >= 0 ? 'sell' : 'ouch');
      log(`💰 卖出 ${g.name} ×${qty}，进账 ${fmt(total)}（${profit >= 0 ? '赚' : '亏'} ${fmt(Math.abs(profit))}）`);
    }
    closeTrade();
    render();
  };

  // 花钱：现金优先，不够自动从存款取
  const payFrom = (amount) => {
    if (S.cash >= amount) { S.cash -= amount; return; }
    const fromBank = amount - S.cash;
    S.cash = 0;
    S.deposit = Math.max(0, S.deposit - fromBank);
  };

  /* ---------- 银行 / 还债 / 医院 / 仓库 ---------- */
  const bank = (kind, amount) => {
    if (S.over) return;
    const v = amount ?? (Number($('bankAmount').value) || 0);
    if (v <= 0) return;
    if (kind === 'in') { const put = Math.min(v, S.cash); if (put > 0) { S.cash -= put; S.deposit += put; log(`🏦 存入 ${fmt(put)}`); } }
    if (kind === 'out') { const take = Math.min(v, S.deposit); if (take > 0) { S.deposit -= take; S.cash += take; log(`🏦 取出 ${fmt(take)}`); } }
    renderBank(); render();
  };

  const repay = () => {
    if (S.over) return;
    if (S.debt <= 0) return log('🤝 你没有欠债，债主甚至有点想你。');
    const pay = Math.min(S.cash + S.deposit, S.debt);
    if (pay <= 0) return log('💸 身无分文，拿什么还债？');
    payFrom(pay);
    S.debt -= pay;
    log(`🤝 还债 ${fmt(pay)}${S.debt === 0 ? '，无债一身轻！' : `，还欠 ${fmt(S.debt)}`}`);
    render();
  };

  const heal = () => {
    if (S.over || S.health >= 100) return;
    const price = 120;
    const points = Math.min(100 - S.health, Math.floor((S.cash + S.deposit) / price));
    if (points <= 0) return log('🏥 医生看了看你的钱包，摇了摇头。');
    payFrom(points * price);
    S.health += points;
    log(`🏥 治疗 ${points} 点健康，花费 ${fmt(points * price)}`);
    render();
  };

  const renderBank = () => { $('bankCash').textContent = fmt(S.cash); $('bankSaved').textContent = fmt(S.deposit); };

  const renderWh = () => {
    $('whList').innerHTML = WH.map((w, i) => `
      <div class="wh-row ${i === S.wh ? 'on' : ''}">
        <b>${w.name}</b>
        <span>容量 ${w.cap} 件 · ${w.rate ? `租金 净资产的 ${(w.rate * 100).toFixed(1)}%/天（现约 ${fmt(rentFor(w))}，保底 ${fmt(w.base)}）` : '免费'}</span>
        ${i === S.wh ? '<em>使用中</em>' : `<button data-wh="${i}">${i > S.wh ? '租用' : '换回'}</button>`}
      </div>`).join('');
  };

  const switchWh = (i) => {
    if (invCount() > WH[i].cap) return log(`📦 货太多（${invCount()} 件），塞不进${WH[i].name}`);
    S.wh = i;
    log(`🏪 切换为【${WH[i].name}】容量 ${WH[i].cap}${WH[i].rate ? ` · 租金约 ${fmt(rentFor(WH[i]))}/天` : ''}`);
    renderWh(); render();
  };

  /* ---------- 澳门皇家 ---------- */
  let horses = [];
  const HORSE_NAMES = ['追风少年', '老骥伏枥', '咖喱盖饭', '一马平川', '蜗牛快跑'];
  const horseMood = (s) => s >= 85 ? '状态神勇' : s >= 60 ? '跃跃欲试' : s >= 40 ? '心不在焉' : '昨晚喝多了';
  const rollHorses = () => {
    horses = [1, 2, 3, 4, 5].map((n) => {
      const strength = rand(20, 100);
      return { n, name: HORSE_NAMES[n - 1], strength, odds: +(1.2 + (100 - strength) / 28).toFixed(1) };
    });
    $('horseList').innerHTML = horses.map((h) =>
      `<label class="horse"><input type="radio" name="horse" value="${h.n}"><b>${h.name}</b><i>${horseMood(h.strength)}</i><em>${h.odds}×</em></label>`).join('');
  };

  const raceBet = () => {
    if (!guardCasino()) return;
    const sel = document.querySelector('input[name=horse]:checked');
    const bet = Number($('raceBet').value) || 0;
    if (!sel) return log('🏇 先选一匹马');
    if (bet <= 0 || bet > S.cash) return log('🏇 下注金额不对（只收现金）');
    const total = horses.reduce((s, h) => s + h.strength, 0);
    let r = Math.random() * total, winner = horses[0];
    for (const h of horses) { r -= h.strength; if (r <= 0) { winner = h; break; } }
    S.cash -= bet;
    const mine = Number(sel.value);
    S.raceLast = winner.name;
    if (winner.n === mine) {
      const win = Math.floor(bet * horses.find((h) => h.n === mine).odds);
      S.cash += win;
      S.casinoPL += win - bet;
      SND.play('win');
      log(`🏇 【${winner.name}】率先冲线！你押中了，赢得 ${fmt(win)}`);
    } else {
      S.casinoPL -= bet;
      SND.play('lose');
      log(`🏇 【${winner.name}】夺冠，你押的【${horses.find((h) => h.n === mine).name}】在半路吃草。-${fmt(bet)}`);
    }
    rollHorses(); render();
  };

  const diceBet = (big) => {
    if (!guardCasino()) return;
    const bet = Number($('diceBet').value) || 0;
    if (bet <= 0 || bet > S.cash) return log('🎲 下注金额不对');
    const d = rand(1, 6);
    S.cash -= bet;
    S.diceHist = S.diceHist.concat(d >= 4 ? '大' : '小').slice(-10);
    const won = (big && d >= 4) || (!big && d <= 3);
    if (won) { const win = Math.floor(bet * 1.95); S.cash += win; S.casinoPL += win - bet; SND.play('win'); log(`🎲 骰子开 ${d} 点（${d >= 4 ? '大' : '小'}），你赢了 ${fmt(win)}`); }
    else { S.casinoPL -= bet; SND.play('lose'); log(`🎲 骰子开 ${d} 点（${d >= 4 ? '大' : '小'}），庄家笑纳 ${fmt(bet)}`); }
    render();
  };

  const numBet = () => {
    if (!guardCasino()) return;
    const guess = Number($('numGuess').value);
    const bet = Number($('numBet').value) || 0;
    if (!(guess >= 0 && guess <= 9)) return log('🔢 猜 0-9 之间的数字');
    if (bet <= 0 || bet > S.cash) return log('🔢 下注金额不对');
    const n = rand(0, 9);
    S.cash -= bet;
    S.numHist = S.numHist.concat(n).slice(-10);
    if (n === guess) { const win = bet * 9; S.cash += win; S.casinoPL += win - bet; SND.play('jackpot'); log(`🔢 开出 ${n}！猜中了，赢 ${fmt(win)}（9 倍）`); }
    else { S.casinoPL -= bet; SND.play('lose'); log(`🔢 开出 ${n}，你猜 ${guess}。差之毫厘 -${fmt(bet)}`); }
    render();
  };

  const guardCasino = () => {
    if (S.over) return false;
    if (!casinoOpen()) { log('🎰 门卫拦住了你：「本店只接待资产为正的客人。」'); return false; }
    return true;
  };

  /* ---------- 社区服务 ---------- */
  const scratch = () => {
    if (S.over) return;
    const price = 20;
    if (S.cash < price) return log('🎫 刮刮乐 20 一张，你摸了摸口袋走开了');
    S.cash -= price;
    const r = Math.random();
    let win = 0;
    if (r < 0.001) win = 100000;
    else if (r < 0.02) win = 2000;
    else if (r < 0.10) win = 200;
    else if (r < 0.25) win = 50;
    else if (r < 0.45) win = 10;
    S.cash += win;
    SND.play(win >= 2000 ? 'jackpot' : win > 0 ? 'win' : 'lose');
    log(win >= 2000 ? `🎫 刮刮乐刮出 ${fmt(win)}！！手都在抖！` : win > 0 ? `🎫 刮出 ${fmt(win)}，回了点血` : '🎫 「谢谢惠顾」。谢什么谢。');
    render();
  };

  const buyLottery = () => {
    if (S.over) return;
    const num = ($('lottoNum').value || '').padStart(3, '0');
    const qty = Math.max(1, Math.min(50, Number($('lottoQty').value) || 1));
    if (!/^\d{3}$/.test(num)) return log('🎟️ 号码要三位数字（000-999）');
    const cost = qty * 2;
    if (S.cash < cost) return log('🎟️ 2 元一注，现金不够');
    S.cash -= cost;
    S.lotto.tickets.push({ num, qty });
    log(`🎟️ 购入彩票【${num}】×${qty} 注，明天开奖`);
    renderLotto(); render();
  };

  const drawLottery = () => {
    if (!S.lotto.tickets.length) { S.lotto.last = null; return; }
    const winning = String(rand(0, 999)).padStart(3, '0');
    let winQty = 0;
    S.lotto.tickets.forEach((t) => { if (t.num === winning) winQty += t.qty; });
    const prize = winQty * 2000;
    if (prize > 0) { S.cash += prize; SND.play('jackpot'); log(`🎉 彩票开奖【${winning}】——你中了 ${winQty} 注，狂揽 ${fmt(prize)}！！`); }
    else log(`🎟️ 彩票开奖【${winning}】，你的号码全军覆没`);
    S.lotto.last = winning;
    S.lotto.tickets = [];
    renderLotto();
  };

  const renderLotto = () => {
    $('lottoHeld').textContent = S.lotto.tickets.length
      ? S.lotto.tickets.map((t) => `${t.num}×${t.qty}`).join('、')
      : '无';
    $('lottoLast').textContent = S.lotto.last || '—';
  };

  /* 茶馆·包打听：花钱买明日内幕（走小道消息机制，75% 灵验） */
  const buyTip = () => {
    if (S.over) return;
    if (S.teaDay === S.day) return log('☕ 茶博士摆摆手：「今天说得够多了，明天请早。」');
    if (S.cash + S.deposit < 500) return log('☕ 打听消息要 500，你连茶钱都掏不出来');
    payFrom(500);
    S.teaDay = S.day;
    const g = pick(allGoods);
    const dir = Math.random() < 0.5 ? 1 : -1;
    S.tip = { id: g.id, dir };
    log(`☕ 茶博士压低声音：「明天【${g.name}】怕是要${dir > 0 ? '起飞' : '砸手里'}……」（信不信由你）`);
    render();
  };

  /* 献血站：救急的 800 块 */
  const donateBlood = () => {
    if (S.over) return;
    if (S.bloodDay === S.day) return log('🩸 护士：「一天最多抽一次，想钱想疯了？」');
    if (S.health <= 30) return log('🩸 护士看了眼你的脸色，直接拒收：「先去治病吧。」');
    S.bloodDay = S.day;
    S.health -= 12;
    S.cash += 800;
    log('🩸 献血 400cc，领到营养补贴 800。健康 -12，头有点晕');
    render();
  };

  /* 慈善捐款：攒善心，黑市罚款打折 */
  const donate = () => {
    if (S.over) return;
    const v = Math.floor(Number($('donateAmt').value) || 0);
    if (v <= 0) return log('❤️ 献爱心也得先填个数');
    if (S.cash + S.deposit < v) return log('❤️ 心意到了，钱没到');
    payFrom(v);
    S.karma += v;
    $('donateAmt').value = '';
    const cut = Math.round(fineCut() * 100);
    log(`❤️ 捐出 ${fmt(v)}，累计善心 ${fmt(S.karma)}${cut ? `（黑市罚款已减 ${cut}%）` : ''}`);
    render();
  };

  /* 打点治安队：压一级风声，每天一次 */
  const bribe = () => {
    if (S.over) return;
    if (S.heat === 0) return log('🥃 今晚本来就风平浪静，钱留着吧');
    if (S.bribedDay === S.day) return log('🥃 今天已经打点过了，做人不能太贪');
    const cost = Math.max(2000, Math.ceil(Math.max(0, netWorth()) * 0.02));
    if (S.cash + S.deposit < cost) return log(`🥃 打点一次要 ${fmt(cost)}，你掏不出来`);
    payFrom(cost);
    S.heat -= 1;
    S.bribedDay = S.day;
    log(`🥃 你请治安队喝了顿好的（-${fmt(cost)}），今夜风声降为「${HEATS[S.heat].label}」`);
    render();
  };

  /* ---------- 智能提醒 ---------- */
  const notice = () => {
    const left = DAYS - S.day;
    const stock = invCount();
    const blackHeld = BLACK_POOL.some((g) => S.inv[g.id]?.qty > 0);
    if (S.health <= 30) return ['bad', `🚑 健康仅剩 ${S.health}，再不治疗就要猝死了`];
    if (left <= 0 && stock > 0) return ['bad', `⏰ 最后一天！${stock} 件存货今晚按收盘价折算，能出手的赶紧出手`];
    if (left <= 2 && stock > 0) return ['warn', `⏰ 只剩 ${left + 1} 天，手里 ${stock} 件货记得找高点清仓`];
    if (blackHeld) return ['warn', `🌑 你正持有黑货，今夜风声「${HEATS[S.heat].label}」——${Math.round(HEATS[S.heat].hold * 100)}% 概率被突击检查（没收+罚款）`];
    if (S.debt >= 50000) return ['bad', `👊 欠债 ${fmt(S.debt)} 已引起债主注意——快还债！`];
    if (S.debt > 0 && S.cash + S.deposit >= S.debt) return ['warn', `💡 你的钱已够还清 ${fmt(S.debt)} 欠债（日息 10%），早还早解脱`];
    if (S.deposit === 0 && S.cash > 20000 && S.debt === 0) return ['tip', '💡 现金闲着也是闲着，存银行每天躺赚 0.5%'];
    if (stock >= capNow()) return ['warn', `📦 仓储满了（${stock}/${capNow()}），租个仓库吃大行情？`];
    return null;
  };

  /* ---------- 结算与排行 ---------- */
  const API = 'https://api.azi36.com';

  const rankHtml = (list) => list.length
    ? list.map((r, i) => {
        const m = r.mode || 30;
        const died = r.day && r.day < m ? `·第${r.day}天卒` : '';
        return `<li><b>${i + 1}.</b> ${esc(r.name)}<em>${m}天局${died}</em> <span class="${r.score >= 0 ? 'up' : 'down'}">${fmt(r.score)}</span> <em>${esc(r.date || '')}</em></li>`;
      }).join('')
    : '<li>暂无记录，等你开张。</li>';

  const endGame = (deathReason, natural) => {
    S.over = true;
    closeTrade();
    const score = netWorth();
    SND.play(deathReason || score < 0 ? 'dead' : 'end');
    const day = natural ? DAYS : S.day;
    const best = JSON.parse(localStorage.getItem('tgf-rank') || '[]');
    best.push({ name: playerName, score, day, mode, date: new Date().toISOString().slice(0, 10) });
    best.sort((a, b) => b.score - a.score);
    localStorage.setItem('tgf-rank', JSON.stringify(best.slice(0, 10)));

    $('endTitle').textContent = deathReason ? '💀 ' + deathReason
      : score >= 100000000 ? '🐲 富可敌国！'
      : score >= 10000000 ? '👑 商界传奇'
      : score >= 1000000 ? '🏆 财务自由！'
      : score >= 0 ? '🎉 活着回来了' : '🕳️ 血本无归';
    $('endDetail').innerHTML =
      `最终净资产：<b class="${score >= 0 ? 'up' : 'down'}">${fmt(score)}</b>（存货按当日行情折算）<br>` +
      (deathReason ? `你倒在了第 ${S.day} 天。` : `${DAYS} 天贸易生涯结束。`) +
      (S.karma > 0 ? `<br>行善积德 ${fmt(S.karma)}——好人有好报（大概）。` : '');

    $('endRankNote').textContent = '正在上传战绩……';
    $('endRank').innerHTML = rankHtml(best.slice(0, 5));
    // 只在盖棺定论这一刻上传一次，之后没有任何补交入口
    if (!S.uploaded) {
      S.uploaded = true;
      fetch(API + '/games/tgf/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, score, day, mode }),
      }).then((r) => r.json()).then((d) => {
        if (!d.ok) throw 0;
        $('endRankNote').textContent = `🌍 ${MODES[mode].label}全球第 ${d.rank} 名！`;
        $('endRank').innerHTML = rankHtml(d.top.slice(0, 5));
      }).catch(() => { $('endRankNote').textContent = '💾 本机记录（全球榜暂时联系不上）'; });
    }

    $('endModal').showModal();
    render();
  };

  /* 排行榜弹窗：分难度页签 + 本机记录，前三名戴奖牌 */
  // 日期统一显示为 MM-DD（老记录的 2026/8/16 也归一）
  const rankDate = (d) => esc(String(d || '').replace(/\//g, '-').replace(/^\d{4}-/, ''));

  const rankRow = (r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    const m = r.mode || 30;
    const died = r.day && r.day < m ? `<i class="badge poor">第${r.day}天卒</i>` : '';
    return `<tr class="${i < 3 ? 'r' + (i + 1) : ''}">
      <td class="r-no">${medal}</td>
      <td>${esc(r.name)} ${died}</td>
      <td class="num"><b class="${r.score >= 0 ? 'up' : 'down'}">${fmt(r.score)}</b></td>
      <td class="num">${r.day || '—'}</td>
      <td class="num"><span class="dim">${rankDate(r.date)}</span></td>
    </tr>`;
  };

  const renderRankRows = (list, emptyMsg) => {
    $('rankBody').innerHTML = list.length
      ? list.map(rankRow).join('')
      : `<tr><td colspan="5" class="rank-empty">${emptyMsg}</td></tr>`;
  };

  const loadRank = (tab) => {
    document.querySelectorAll('.rank-tabs button').forEach((b) =>
      b.classList.toggle('on', b.dataset.rank === tab));
    if (tab === 'local') {
      renderRankRows(JSON.parse(localStorage.getItem('tgf-rank') || '[]'), '本机还没有战绩，去闯一局');
      return;
    }
    renderRankRows([], '加载中……');
    fetch(`${API}/games/tgf/rank?mode=${tab}`).then((r) => r.json())
      .then((d) => renderRankRows(d.top || [], '虚位以待——第一个上榜的会是你吗？'))
      .catch(() => renderRankRows([], '全球榜暂时联系不上'));
  };

  const showRank = () => {
    $('rankModal').showModal();
    loadRank(String(mode));
  };

  /* ---------- 页签 ---------- */
  let tab = 'market';
  const switchTab = (t) => {
    tab = t;
    document.querySelectorAll('.tgf-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.tgf-panel').forEach((p) => { p.hidden = p.id !== 'tab-' + t; });
    if (t === 'casino' && S?.casinoVip && !horses.length) rollHorses();
    render();
  };

  /* ---------- 渲染 ---------- */
  const log = (msg) => {
    const el = document.createElement('div');
    el.textContent = `[第${Math.min(S.day, DAYS)}天] ${msg}`;
    $('gameLog').prepend(el);
    while ($('gameLog').children.length > 80) $('gameLog').lastChild.remove();
  };

  const marketRow = (g) => {
    const p = S.prices[g.id];
    const prev = S.prev[g.id];
    const held = S.inv[g.id];
    const avail = S.avail[g.id];
    const avg = held ? Math.round(held.cost / held.qty) : null;
    const pct = prev ? Math.round(((p - prev) / prev) * 100) : 0;
    const trend = !prev || p === prev ? '' : p > prev
      ? ` <span class="up">▲${pct}%</span>` : ` <span class="down">▼${Math.abs(pct)}%</span>`;
    const cantAfford = avail && p > S.cash + S.deposit;
    const stock = S.stock[g.id] || 0;
    const soldOut = avail && stock <= 0;
    const badge = (g.black ? '<i class="badge black">黑</i>' : g.rare ? '<i class="badge rare">稀</i>' : '')
      + (!avail ? '<i class="badge out">断货</i>' : soldOut ? '<i class="badge out">已扫空</i>' : '')
      + (cantAfford ? '<i class="badge poor">买不起</i>' : '');
    const holdCell = held
      ? `×${held.qty} <em class="${p >= avg ? 'up' : 'down'}">均 ${fmt(avg)}</em>`
      : '<em class="dim">—</em>';
    return `<tr class="${held ? 'held' : ''} ${!avail ? 'na' : ''}">
      <td>${g.name}${badge}</td>
      <td class="num"><b>${fmt(p)}</b>${trend}</td>
      <td class="num">${avail ? (stock > 0 ? stock : '<em class="dim">0</em>') : '<em class="dim">—</em>'}</td>
      <td class="num">${holdCell}</td>
      <td class="ops">
        <button data-buy="${g.id}" ${avail && !cantAfford && stock > 0 ? '' : 'disabled'}>买</button>
        <button data-sell="${g.id}" ${held ? '' : 'disabled'}>卖</button>
      </td>
    </tr>`;
  };

  const render = () => {
    $('statDay').textContent = Math.min(S.day, DAYS);
    $('statCash').textContent = fmt(S.cash);
    $('statDeposit').textContent = fmt(S.deposit);
    $('statDebt').textContent = S.debt > 0 ? fmt(S.debt) : '已还清';
    $('statDebt').className = S.debt > 0 ? 'bad' : 'good';
    const worth = netWorth();
    $('statWorth').textContent = fmt(worth);
    $('statWorth').className = worth >= 0 ? 'brand' : 'bad';
    $('statHealth').textContent = S.health;
    $('healthBar').style.width = Math.max(0, S.health) + '%';
    $('healthBar').className = S.health < 40 ? 'low' : '';
    const cnt = invCount();
    $('statCap').textContent = `${cnt}/${capNow()}`;
    $('capBar').style.width = Math.min(100, (cnt / capNow()) * 100) + '%';

    const n = S.over ? null : notice();
    $('noticeBar').hidden = !n;
    if (n) { $('noticeBar').className = 'tgf-notice ' + n[0]; $('noticeBar').textContent = n[1]; }

    const marketList = goods.concat(MARKET_RARES.filter((g) => S.avail[g.id] || S.inv[g.id]));
    $('marketBody').innerHTML = marketList.map(marketRow).join('');

    // 黑市 / 赌场：验资通过前只见门房
    $('blackGate').hidden = S.blackVip;
    $('blackFloor').hidden = !S.blackVip;
    if (S.blackVip) {
      $('blackBody').innerHTML = BLACK_POOL.filter((g) => S.avail[g.id] || S.inv[g.id]).map(marketRow).join('')
        || '<tr><td colspan="5" class="dim" style="text-align:center;padding:24px">今晚黑市静悄悄，明天再来</td></tr>';
    }
    $('casinoGate').hidden = S.casinoVip;
    $('casinoFloor').hidden = !S.casinoVip;

    // 黑市风声条
    const H = HEATS[S.heat];
    $('heatStrip').className = 'heat-strip ' + H.cls;
    $('heatState').textContent = H.label;
    $('heatOdds').textContent = `交易被抓 ${Math.round(H.trade * 100)}% · 持货过夜 ${Math.round(H.hold * 100)}%`;
    const bribeCost = Math.max(2000, Math.ceil(Math.max(0, netWorth()) * 0.02));
    $('bribeBtn').textContent = `🥃 打点治安队（${fmt(bribeCost)}）`;
    $('bribeBtn').disabled = S.over || S.heat === 0 || S.bribedDay === S.day;

    // 赌场：战绩 + 路子
    const pl = S.casinoPL;
    $('casinoPL').innerHTML = pl === 0 ? '<em class="dim">未开张</em>'
      : `<b class="${pl > 0 ? 'up' : 'down'}">${pl > 0 ? '+' : ''}${fmt(pl)}</b>`;
    $('raceLast').textContent = S.raceLast || '—';
    $('diceHist').innerHTML = S.diceHist.length
      ? S.diceHist.map((v) => `<i class="bead ${v === '大' ? 'b-big' : 'b-small'}">${v}</i>`).join('')
      : '<span class="dim">暂无记录</span>';
    $('numHist').innerHTML = S.numHist.length
      ? S.numHist.map((v) => `<i class="bead">${v}</i>`).join('')
      : '<span class="dim">暂无记录</span>';

    // 社区
    $('teaNote').textContent = S.teaDay === S.day ? '已买，明日见分晓' : '未买';
    $('karmaVal').textContent = fmt(S.karma) + (fineCut() ? `（罚款减 ${Math.round(fineCut() * 100)}%）` : '');

    $('nextDayBtn').disabled = S.over;
  };

  /* ---------- 事件绑定 ---------- */
  document.querySelectorAll('.tgf-tab').forEach((b) =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));

  document.addEventListener('click', (e) => {
    const buy = e.target.dataset?.buy;
    const sell = e.target.dataset?.sell;
    if (buy) return openTrade('buy', buy, e.target);
    if (sell) return openTrade('sell', sell, e.target);
    // 点击 Popover 外部时关闭
    if (trade && !$('tradePop').contains(e.target)) closeTrade();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTrade(); });

  $('popQty').addEventListener('input', updatePopTotal);
  $('popQty').addEventListener('keydown', (e) => { if (e.key === 'Enter') doTrade(); });
  $('popMax').addEventListener('click', () => { $('popQty').value = trade.maxQty; updatePopTotal(); });
  $('popOk').addEventListener('click', doTrade);
  $('popCancel').addEventListener('click', closeTrade);

  $('nextDayBtn').addEventListener('click', nextDay);
  $('bankBtn').addEventListener('click', () => { renderBank(); $('bankModal').showModal(); });
  $('bankIn').addEventListener('click', () => bank('in'));
  $('bankOut').addEventListener('click', () => bank('out'));
  $('bankAllIn').addEventListener('click', () => bank('in', S.cash));
  $('bankAllOut').addEventListener('click', () => bank('out', S.deposit));
  $('repayBtn').addEventListener('click', repay);
  $('healBtn').addEventListener('click', heal);
  $('whBtn').addEventListener('click', () => { renderWh(); $('whModal').showModal(); });
  $('whList').addEventListener('click', (e) => { const i = e.target.dataset?.wh; if (i != null) switchWh(Number(i)); });
  $('rankBtn').addEventListener('click', showRank);

  /* 验资仪式 */
  $('blackVerify').addEventListener('click', () => {
    const w = netWorth();
    if (w >= BLACK_UNLOCK) {
      S.blackVip = true;
      log('🌑 门房清点完你的家底，掀开了门帘：「大哥里边请，都是自己人。」');
      render();
    } else {
      $('blackGateMsg').textContent = `门房用鼻孔看了你一眼：「净资产 ${fmt(w)}？先去攒攒吧。」（还差 ${fmt(BLACK_UNLOCK - w)}）`;
    }
  });
  $('casinoVerify').addEventListener('click', () => {
    if (casinoOpen()) {
      S.casinoVip = true;
      log('🎰 门卫微微欠身：「欢迎光临澳门皇家，祝您手气亨通。」');
      if (!horses.length) rollHorses();
      render();
    } else {
      $('casinoGateMsg').textContent = netWorth() <= 0
        ? '门卫瞥了眼你的负资产：「先去把债还了吧，朋友。」'
        : '门卫：「兜里连现金都没有，进去看别人玩吗？」';
    }
  });

  $('raceGo').addEventListener('click', raceBet);
  $('diceBig').addEventListener('click', () => diceBet(true));
  $('diceSmall').addEventListener('click', () => diceBet(false));
  $('numGo').addEventListener('click', numBet);
  $('scratchBtn').addEventListener('click', scratch);
  $('lottoBuy').addEventListener('click', buyLottery);
  $('teaBtn').addEventListener('click', buyTip);
  $('bloodBtn').addEventListener('click', donateBlood);
  $('donateBtn').addEventListener('click', donate);
  $('bribeBtn').addEventListener('click', bribe);
  document.querySelectorAll('dialog .tgf-close').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close()));

  /* ---------- 开局流程：窗口内开始面板 ---------- */
  const win = document.querySelector('.tgf-window');

  const showStart = () => {
    win.classList.add('pre');
    $('startPanel').hidden = false;
  };

  const start = () => {
    playerName = ($('playerName').value.trim() || randomName()).slice(0, 12);
    localStorage.setItem('tgf-name', playerName);
    $('barName').textContent = '👤 ' + playerName;
    win.classList.remove('pre');
    $('startPanel').hidden = true;
    SND.bgm();   // 进城，起乐
    newGame();
    // 开局自动把游戏窗口滚到视口顶部
    win.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.querySelectorAll('.mode-card').forEach((c) =>
    c.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach((x) => x.classList.remove('on'));
      c.classList.add('on');
      mode = Number(c.dataset.mode);
    }));

  $('startBtn').addEventListener('click', start);
  $('playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
  $('randomName').addEventListener('click', () => { $('playerName').value = randomName(); });
  $('restartBtn').addEventListener('click', () => { $('endModal').close(); showStart(); });

  document.querySelectorAll('.rank-tabs button').forEach((b) =>
    b.addEventListener('click', () => loadRank(b.dataset.rank)));

  /* 声音总台：点按钮静音，悬停滑块调音量 */
  const ICN_VOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  const ICN_VOLX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>';
  const renderSndBtn = () => {
    $('sndBtn').innerHTML = (SND.muted() ? ICN_VOLX : ICN_VOL) + ' 声音';
    $('sndBtn').title = SND.muted() ? '已静音，点击恢复' : '点击静音 · 悬停调音量';
  };
  $('sndBtn').addEventListener('click', () => { SND.setMuted(!SND.muted()); renderSndBtn(); if (!SND.muted()) SND.play('win'); });
  $('volSfx').value = Math.round(SND.vSfx() * 100);
  $('volBgm').value = Math.round(SND.vBgm() * 100);
  $('volSfx').addEventListener('input', () => { if (SND.muted()) { SND.setMuted(false); renderSndBtn(); } SND.setSfx($('volSfx').value / 100); });
  $('volSfx').addEventListener('change', () => SND.play('buy'));
  $('volBgm').addEventListener('input', () => { if (SND.muted()) { SND.setMuted(false); renderSndBtn(); } SND.setBgm($('volBgm').value / 100); });
  renderSndBtn();

  $('playerName').value = playerName || randomName();
  showStart();

  // 开局面板的游玩统计（静默失败）
  fetch(API + '/games/tgf/play').then((r) => r.json()).then((d) => {
    if (typeof d.plays !== 'number') return;
    $('startStats').textContent = `这座城已被闯荡 ${d.plays.toLocaleString('zh-CN')} 次 · ${d.players.toLocaleString('zh-CN')} 位玩家来过`;
    $('startStats').hidden = false;
  }).catch(() => {});
})();
