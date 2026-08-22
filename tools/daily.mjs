/* ============================================================
   日报生成器：node tools/daily.mjs ai | crypto | all [--date 2026-08-22]

   每天早上由 .github/workflows/daily.yml 跑一次，产物直接进仓库：
     daily/<kind>/<日期>.html   当期归档（noindex）
     daily/<kind>/index.html    最新一期 + 归档列表（进索引）
   只用免费、无需密钥的公开接口；任一来源拉不到就在页面上写明「没拿到」，
   不让一个来源拖垮整页。没有模型参与，只列事实，不写观点。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://azi36.com';
const UA = 'azi36-daily/1.0 (+https://azi36.com/daily/)';
const DAY = 24 * 3600 * 1000;

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
const kinds = argv.includes('all') ? ['ai', 'crypto'] : argv.filter(a => a === 'ai' || a === 'crypto');
if (!kinds.length) { console.error('用法：node tools/daily.mjs ai | crypto | all [--date YYYY-MM-DD]'); process.exit(2); }
const di = argv.indexOf('--date');
/* 日期按北京时间：工作流在 UTC 00:30 跑，北京已经是早上 */
const today = di >= 0 ? argv[di + 1] : new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const since = Date.now() - DAY;

/* ---------- 小工具 ---------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v, d = 0) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = v => (v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%');
const short = (s, max = 160) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
const strip = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
const hm = t => { const d = new Date(t); return isNaN(d) ? '' : String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' UTC'; };

async function get(url, as = 'json', timeout = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : '*/*' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return as === 'json' ? r.json() : r.text();
  } finally { clearTimeout(t); }
}

/* 一个来源一个 section；拉不到就写明，不抛 */
async function section(title, note, fn) {
  try {
    const html = await fn();
    return { title, note, html, ok: true };
  } catch (e) {
    console.error(`  ✗ ${title}: ${e.message}`);
    return { title, note, html: `<p class="dl-empty">这个来源今天没拿到（${esc(e.message)}），明天再试。</p>`, ok: false };
  }
}

/* RSS / Atom 极简解析：只要 title / link / date / summary，够用 */
function feedItems(xml) {
  const items = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/g) || [];
  for (const b of blocks) {
    const tag = (name) => { const m = b.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`)); return m ? strip(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim() : ''; };
    let link = tag('link');
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/); link = m ? m[1] : ''; }
    const date = tag('pubDate') || tag('published') || tag('updated') || tag('dc:date');
    items.push({ title: tag('title'), link, date: date ? new Date(date) : null, summary: tag('description') || tag('summary') });
  }
  return items;
}

const list = rows => `<ol class="dl">${rows.join('')}</ol>`;
const row = ({ href, title, meta, summary }) =>
  `<li class="dl-item"><a class="dl-title" href="${esc(href)}" target="_blank" rel="noopener">${esc(title)}</a>` +
  (meta ? `<span class="dl-meta">${meta}</span>` : '') +
  (summary ? `<p class="dl-sum">${esc(summary)}</p>` : '') + '</li>';

/* ============================================================
   AI 日报
   ============================================================ */
const AI_RE = /\b(AI|A\.I\.|LLM|GPT|Claude|Gemini|Llama|Mistral|OpenAI|Anthropic|DeepSeek|Qwen|transformer|diffusion|agent|agentic|machine learning|deep learning|neural|model|inference|RAG|copilot|chatbot)\b|大模型|人工智能/i;

async function buildAI() {
  const secs = await Promise.all([
    section('Hacker News · AI 热帖', '过去 24 小时，按分数排，标题里得沾 AI 的边', async () => {
      const d = await get(`https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${Math.floor(since / 1000)},points>20&hitsPerPage=300`);
      const hits = (d.hits || []).filter(h => h.title && AI_RE.test(h.title)).sort((a, b) => b.points - a.points).slice(0, 15);
      if (!hits.length) throw new Error('没有匹配的帖子');
      return list(hits.map(h => row({
        href: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        title: h.title,
        meta: `${n(h.points)} 分 · ${n(h.num_comments || 0)} 评论 · <a href="https://news.ycombinator.com/item?id=${h.objectID}" target="_blank" rel="noopener">讨论</a>`,
      })));
    }),
    section('Hugging Face · 每日论文', '社区投票选出来的，按票数排', async () => {
      const d = await get('https://huggingface.co/api/daily_papers?limit=12');
      const items = (Array.isArray(d) ? d : []).filter(x => x.paper).sort((a, b) => (b.paper.upvotes || 0) - (a.paper.upvotes || 0)).slice(0, 12);
      if (!items.length) throw new Error('列表为空');
      return list(items.map(x => row({
        href: `https://huggingface.co/papers/${x.paper.id}`,
        title: x.paper.title,
        meta: `${n(x.paper.upvotes || 0)} 票 · <a href="https://arxiv.org/abs/${esc(x.paper.id)}" target="_blank" rel="noopener">arXiv</a>`,
        summary: short(x.paper.summary, 200),
      })));
    }),
    section('arXiv · 新提交', 'cs.AI / cs.CL / cs.LG 最近提交的 10 篇，按时间排，不挑', async () => {
      const xml = await get('https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10', 'text');
      const items = feedItems(xml).filter(i => i.title);
      if (!items.length) throw new Error('列表为空');
      return list(items.map(i => row({ href: i.link, title: i.title, meta: i.date ? esc(i.date.toISOString().slice(0, 10)) : '', summary: short(i.summary, 180) })));
    }),
    section('GitHub · 本周新仓库', '最近 7 天创建、带 llm 话题、星最多的 10 个', async () => {
      const from = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
      // 搜索限定词之间不支持 OR，只认一个话题；未登录每分钟 10 次，一天一次够用
      const d = await get(`https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:llm created:>${from}`)}&sort=stars&order=desc&per_page=10`);
      const items = d.items || [];
      if (!items.length) throw new Error('列表为空');
      return list(items.map(r => row({ href: r.html_url, title: r.full_name, meta: `★ ${n(r.stargazers_count)}${r.language ? ' · ' + esc(r.language) : ''}`, summary: short(r.description, 140) })));
    }),
  ]);
  return secs;
}

/* ============================================================
   币圈日报
   ============================================================ */
async function buildCrypto() {
  const secs = await Promise.all([
    section('市值前十', 'CoinGecko 免费接口，有延迟；涨跌是过去 24 小时', async () => {
      const d = await get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h');
      if (!Array.isArray(d) || !d.length) throw new Error('列表为空');
      const rows = d.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.symbol.toUpperCase())}</b> <span>${esc(c.name)}</span></td>` +
        `<td>$${n(c.current_price, c.current_price < 1 ? 4 : 2)}</td>` +
        `<td class="${c.price_change_percentage_24h >= 0 ? 'up' : 'down'}">${pct(c.price_change_percentage_24h)}</td>` +
        `<td>$${n(c.market_cap / 1e9, 1)}B</td></tr>`).join('');
      return `<div class="mk-wrap"><table class="mk"><thead><tr><th>#</th><th>币种</th><th>价格</th><th>24h</th><th>市值</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }),
    section('全市场', '总市值、BTC 占比、24 小时成交额', async () => {
      const g = (await get('https://api.coingecko.com/api/v3/global')).data;
      if (!g) throw new Error('没有 data');
      const chg = g.market_cap_change_percentage_24h_usd;
      return `<div class="mk-stats">` +
        `<div><em>总市值</em><b>$${n(g.total_market_cap.usd / 1e12, 2)}T</b><span class="${chg >= 0 ? 'up' : 'down'}">${pct(chg)}</span></div>` +
        `<div><em>24h 成交</em><b>$${n(g.total_volume.usd / 1e9, 0)}B</b></div>` +
        `<div><em>BTC 占比</em><b>${n(g.market_cap_percentage.btc, 1)}%</b></div>` +
        `<div><em>ETH 占比</em><b>${n(g.market_cap_percentage.eth, 1)}%</b></div>` +
        `</div>`;
    }),
    section('恐惧与贪婪指数', 'alternative.me，0 极度恐惧 → 100 极度贪婪', async () => {
      const d = await get('https://api.alternative.me/fng/?limit=2');
      const [now, prev] = d.data || [];
      if (!now) throw new Error('没有数据');
      const v = Number(now.value);
      return `<div class="fng"><div class="fng-bar"><i style="left:${v}%"></i></div>` +
        `<div class="fng-row"><b>${v}</b><span>${esc(now.value_classification)}</span>` +
        (prev ? `<small>昨天 ${esc(prev.value)} · ${esc(prev.value_classification)}</small>` : '') + `</div></div>`;
    }),
    section('要闻', 'CoinDesk 与 Cointelegraph 的 RSS，过去 24 小时，按时间倒序；标题原文，不翻译不点评', async () => {
      const feeds = [
        ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
        ['Cointelegraph', 'https://cointelegraph.com/rss'],
      ];
      const all = [];
      for (const [src, url] of feeds) {
        try {
          const items = feedItems(await get(url, 'text'));
          for (const i of items) if (i.title && i.date && i.date.getTime() > since) all.push({ ...i, src });
        } catch (e) { console.error(`  · ${src}: ${e.message}`); }
      }
      all.sort((a, b) => b.date - a.date);
      if (!all.length) throw new Error('两个源都没拿到');
      return list(all.slice(0, 16).map(i => row({ href: i.link, title: i.title, meta: `${esc(i.src)} · ${hm(i.date)}` })));
    }),
  ]);
  return secs;
}

/* ============================================================
   页面模板：跟站内其他页一样的头、导航、页脚，体检脚本会逐项查
   ============================================================ */
const KIND = {
  ai: { name: 'AI 日报', emoji: '🤖', desc: 'Hacker News 上的 AI 热帖、Hugging Face 每日论文、arXiv 新提交、GitHub 本周新仓库，每天早上自动整理。只列事实，不带观点。' },
  crypto: { name: '币圈日报', emoji: '🪙', desc: '市值前十行情、全市场数据、恐惧贪婪指数、CoinDesk 与 Cointelegraph 要闻，每天早上自动整理。只列事实，不推荐任何币种。' },
};

const NAV = (active) => ['首页', '博客', '产品', '游戏', '音乐'].map((c, i) => {
  const href = ['../../', '../../blog/', '../../products/', '../../games/', '../../music/'][i];
  return `        <a href="${href}"${c === active ? ' class="active"' : ''}>${c}</a>`;
}).join('\n');

function page({ kind, date, secs, archive, latest }) {
  const k = KIND[kind];
  const title = `${k.name} ${date} · Azi36`;
  const canon = latest ? `${SITE}/daily/${kind}/` : null;
  const head = canon
    ? `  <link rel="canonical" href="${canon}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Azi36">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(k.desc)}">
  <meta property="og:url" content="${canon}">
  <meta property="og:image" content="${SITE}/assets/img/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">`
    : `  <meta name="robots" content="noindex">`;
  const failed = secs.filter(s => !s.ok).length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(k.desc)}">
${head}
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#101116" media="(prefers-color-scheme: dark)">
  <script>try{var t=localStorage.getItem("azi-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
  <link rel="stylesheet" href="../../assets/style.css?v=${VER.css}">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preconnect" href="https://api.azi36.com" crossorigin>
  <script src="https://cdn.jsdelivr.net/npm/@twemoji/api@15.1.0/dist/twemoji.min.js" crossorigin="anonymous" defer></script>
  <script src="../../assets/site.js?v=${VER.js}" defer></script>
  <script src="../../assets/player.js?v=${VER.player}" defer></script>
  <link rel="icon" href="../../assets/favicon.svg">
</head>
<body class="ch-green">

  <header class="site-header">
    <div class="container">
      <a class="site-logo" href="../../">
        <span class="logo-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 34 24 13l10 21" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="33.5" cy="13.5" r="3.4" fill="#ffb02e"/></svg></span>
        <span class="wordmark">Azi<b>36</b></span>
      </a>
      <nav class="site-nav">
${NAV('产品')}
      </nav>
      <div class="nav-side">
        <span class="nav-status"><em class="nav-emo">😊</em>Keep Smile ~</span>
        <button class="theme-toggle" type="button" aria-label="切换深浅色" title="切换深浅色">
          <svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>
          <svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
        </button>
        <a class="nav-gh" href="https://github.com/Azi36" aria-label="GitHub"><img src="../../assets/img/avatar.png" alt="Azi36"></a>
      </div>
    </div>
  </header>

  <main class="container daily">
    <div class="daily-head">
      <div>
        <div class="kicker">${k.emoji} DAILY · 每天早上自动生成</div>
        <h1>${esc(k.name)} <time datetime="${date}">${date}</time></h1>
        <p class="page-desc">${esc(k.desc)}${failed ? ` 今天有 ${failed} 个来源没拿到，页内已标明。` : ''}</p>
      </div>
      <nav class="daily-switch" aria-label="切换日报">
        <a href="../ai/"${kind === 'ai' ? ' class="on"' : ''}>🤖 AI 日报</a>
        <a href="../crypto/"${kind === 'crypto' ? ' class="on"' : ''}>🪙 币圈日报</a>
      </nav>
    </div>

${secs.map(s => `    <section class="dl-sec">
      <h2>${esc(s.title)}<small>${esc(s.note)}</small></h2>
      ${s.html}
    </section>`).join('\n\n')}

    <section class="dl-sec dl-archive">
      <h2>往期<small>每天一期，留最近 ${ARCHIVE_KEEP} 期</small></h2>
      <div class="daily-arch">
${archive.map(d => `        <a href="${d}.html"${d === date ? ' class="on"' : ''}>${d}</a>`).join('\n')}
      </div>
      <p class="dl-empty">来源都是免费公开接口，内容与链接归原作者所有；这里只做聚合，不改一字。</p>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="site-logo" href="../../">
          <span class="logo-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 34 24 13l10 21" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="33.5" cy="13.5" r="3.4" fill="#ffb02e"/></svg></span>
          <span class="wordmark">Azi<b>36</b></span>
        </a>
        <p class="footer-tag">把灵感慢慢掏出来，别急！</p>
      </div>
      <div class="footer-cols">
        <div class="footer-col mystery">
          <a href="../../">首页</a>
          <a href="../../blog/">博客</a>
          <a href="../../products/">产品</a>
          <a href="../../games/">游戏</a>
          <a href="../../music/">音乐</a>
        </div>
      </div>
    </div>
    <div class="container footer-meta">
      <span>© 2026 Azi36 · No Rights Reserved.</span>
      <a class="meta-top" href="#">回到顶部 ↑</a>
    </div>
    <div class="footer-ghost" aria-hidden="true">AZI36</div>
  </footer>

</body>
</html>
`;
}

/* 共享资源版本号跟首页走：首页加一，日报下次生成自动跟上，不会分叉 */
const VER = (() => {
  const s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const v = re => (s.match(re) || [])[1];
  return { css: v(/style\.css\?v=(\d+)/), js: v(/site\.js\?v=(\d+)/), player: v(/player\.js\?v=(\d+)/) };
})();
const ARCHIVE_KEEP = 30;

/* ---------- 主流程 ---------- */
for (const kind of kinds) {
  console.log(`生成 ${KIND[kind].name} ${today}`);
  const secs = kind === 'ai' ? await buildAI() : await buildCrypto();
  const dir = path.join(ROOT, 'daily', kind);
  fs.mkdirSync(dir, { recursive: true });

  /* 归档：留最近 N 期，更早的删掉（仓库别无限长） */
  const dates = new Set(fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).map(f => f.slice(0, 10)));
  dates.add(today);
  const archive = [...dates].sort().reverse();
  for (const d of archive.slice(ARCHIVE_KEEP)) fs.unlinkSync(path.join(dir, d + '.html'));
  const kept = archive.slice(0, ARCHIVE_KEEP);

  fs.writeFileSync(path.join(dir, today + '.html'), page({ kind, date: today, secs, archive: kept, latest: false }));
  fs.writeFileSync(path.join(dir, 'index.html'), page({ kind, date: today, secs, archive: kept, latest: true }));
  console.log(`  → daily/${kind}/${today}.html · index.html（${secs.filter(s => s.ok).length}/${secs.length} 个来源正常）`);
}
