/* ============================================================
   日报生成器：node tools/daily.mjs ai | crypto | all [--date 2026-08-22]

   每天早上由 .github/workflows/daily.yml 跑一次，产物直接进仓库：
     daily/<kind>/<日期>.html   当期归档（noindex）
     daily/<kind>/index.html    最新一期 + 归档列表（进索引）

   来源只用免费、无需密钥的公开接口；任一来源拉不到就在页面上写明，不拖垮整页。
   翻译和「今日要点」走 GitHub Models（工作流里用 GITHUB_TOKEN 就能调，不用另放密钥）；
   模型不可用时退回原文列表，要点一节写明没生成。模型只做翻译和挑重点，不写观点。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://azi36.com';
const UA = 'azi36-daily/1.0 (+https://azi36.com/daily/)';
const DAY = 24 * 3600 * 1000;
const ARCHIVE_KEEP = 30;

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

async function get(url, as = 'json', timeout = 15000, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...init, headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : '*/*', ...(init.headers || {}) }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 429 ? '（限流）' : ''));
    return as === 'json' ? r.json() : r.text();
  } finally { clearTimeout(t); }
}

/* 一个来源一个 section；拉不到就写明，不抛。
   fn 返回 { items: [...] } 或 { html }：条目型的走翻译，行情型的直接渲染 */
async function section(title, note, fn) {
  try {
    const r = await fn();
    return { title, note, ok: true, ...r };
  } catch (e) {
    console.error(`  ✗ ${title}: ${e.message}`);
    return { title, note, ok: false, html: `<p class="dl-empty">这个来源今天没拿到（${esc(e.message)}），明天再试。</p>` };
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

/* ============================================================
   AI 日报
   ============================================================ */
const AI_RE = /\b(AI|A\.I\.|LLM|GPT|Claude|Gemini|Llama|Mistral|OpenAI|Anthropic|DeepSeek|Qwen|transformer|diffusion|agent|agentic|machine learning|deep learning|neural|model|inference|RAG|copilot|chatbot)\b|大模型|人工智能/i;

async function buildAI() {
  return Promise.all([
    section('Hacker News · AI 热帖', '过去 24 小时，按分数排，标题里得沾 AI 的边', async () => {
      const d = await get(`https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${Math.floor(since / 1000)},points>20&hitsPerPage=300`);
      const hits = (d.hits || []).filter(h => h.title && AI_RE.test(h.title)).sort((a, b) => b.points - a.points).slice(0, 15);
      if (!hits.length) throw new Error('没有匹配的帖子');
      return { items: hits.map(h => ({
        href: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        title: h.title,
        meta: `${n(h.points)} 分 · ${n(h.num_comments || 0)} 评论 · <a href="https://news.ycombinator.com/item?id=${h.objectID}" target="_blank" rel="noopener">讨论</a>`,
      })) };
    }),
    section('Hugging Face · 每日论文', '社区投票选出来的，按票数排', async () => {
      const d = await get('https://huggingface.co/api/daily_papers?limit=12');
      const items = (Array.isArray(d) ? d : []).filter(x => x.paper).sort((a, b) => (b.paper.upvotes || 0) - (a.paper.upvotes || 0)).slice(0, 12);
      if (!items.length) throw new Error('列表为空');
      return { items: items.map(x => ({
        href: `https://huggingface.co/papers/${x.paper.id}`,
        title: x.paper.title,
        meta: `${n(x.paper.upvotes || 0)} 票 · <a href="https://arxiv.org/abs/${esc(x.paper.id)}" target="_blank" rel="noopener">arXiv</a>`,
        summary: short(x.paper.summary, 200),
      })) };
    }),
    section('arXiv · 新提交', 'cs.AI / cs.CL / cs.LG 最近提交的 10 篇，按时间排，不挑', async () => {
      const xml = await get('https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10', 'text');
      const items = feedItems(xml).filter(i => i.title);
      if (!items.length) throw new Error('列表为空');
      return { items: items.map(i => ({ href: i.link, title: i.title, meta: i.date ? esc(i.date.toISOString().slice(0, 10)) : '', summary: short(i.summary, 180) })) };
    }),
    section('GitHub · 本周新仓库', '最近 7 天创建、带 llm 话题、星最多的 10 个', async () => {
      const from = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
      // 搜索限定词之间不支持 OR，只认一个话题；未登录每分钟 10 次，一天一次够用
      const d = await get(`https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:llm created:>${from}`)}&sort=stars&order=desc&per_page=10`);
      const items = d.items || [];
      if (!items.length) throw new Error('列表为空');
      return { items: items.map(r => ({ href: r.html_url, title: r.full_name, keep: true, meta: `★ ${n(r.stargazers_count)}${r.language ? ' · ' + esc(r.language) : ''}`, summary: short(r.description, 140) })) };
    }),
  ]);
}

/* ============================================================
   币圈日报
   ============================================================ */
async function buildCrypto() {
  return Promise.all([
    section('市值前十', 'CoinGecko 免费接口，有延迟；涨跌是过去 24 小时', async () => {
      const d = await get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h');
      if (!Array.isArray(d) || !d.length) throw new Error('列表为空');
      const rows = d.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.symbol.toUpperCase())}</b> <span>${esc(c.name)}</span></td>` +
        `<td>$${n(c.current_price, c.current_price < 1 ? 4 : 2)}</td>` +
        `<td class="${c.price_change_percentage_24h >= 0 ? 'up' : 'down'}">${pct(c.price_change_percentage_24h)}</td>` +
        `<td>$${n(c.market_cap / 1e9, 1)}B</td></tr>`).join('');
      return { html: `<div class="mk-wrap"><table class="mk"><thead><tr><th>#</th><th>币种</th><th>价格</th><th>24h</th><th>市值</th></tr></thead><tbody>${rows}</tbody></table></div>`,
        facts: [d.slice(0, 3).map(c => `${c.symbol.toUpperCase()} $${n(c.current_price, 2)}（${pct(c.price_change_percentage_24h)}）`).join(' · ')] };
    }),
    section('全市场', '总市值、BTC 占比、24 小时成交额', async () => {
      const g = (await get('https://api.coingecko.com/api/v3/global')).data;
      if (!g) throw new Error('没有 data');
      const chg = g.market_cap_change_percentage_24h_usd;
      return { html: `<div class="mk-stats">` +
        `<div><em>总市值</em><b>$${n(g.total_market_cap.usd / 1e12, 2)}T</b><span class="${chg >= 0 ? 'up' : 'down'}">${pct(chg)}</span></div>` +
        `<div><em>24h 成交</em><b>$${n(g.total_volume.usd / 1e9, 0)}B</b></div>` +
        `<div><em>BTC 占比</em><b>${n(g.market_cap_percentage.btc, 1)}%</b></div>` +
        `<div><em>ETH 占比</em><b>${n(g.market_cap_percentage.eth, 1)}%</b></div>` +
        `</div>`,
        facts: [`总市值 $${n(g.total_market_cap.usd / 1e12, 2)}T（24h ${pct(chg)}），BTC 占比 ${n(g.market_cap_percentage.btc, 1)}%`] };
    }),
    section('恐惧与贪婪指数', 'alternative.me，0 极度恐惧 → 100 极度贪婪', async () => {
      const d = await get('https://api.alternative.me/fng/?limit=2');
      const [now, prev] = d.data || [];
      if (!now) throw new Error('没有数据');
      const v = Number(now.value);
      return { html: `<div class="fng"><div class="fng-bar"><i style="left:${v}%"></i></div>` +
        `<div class="fng-row"><b>${v}</b><span>${esc(now.value_classification)}</span>` +
        (prev ? `<small>昨天 ${esc(prev.value)} · ${esc(prev.value_classification)}</small>` : '') + `</div></div>`,
        facts: [`恐惧贪婪指数 ${v}（${now.value_classification}）${prev ? '，昨天 ' + prev.value : ''}`] };
    }),
    section('要闻', 'CoinDesk 与 Cointelegraph 的 RSS，过去 24 小时，按时间倒序', async () => {
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
      return { items: all.slice(0, 16).map(i => ({ href: i.link, title: i.title, meta: `${esc(i.src)} · ${hm(i.date)}`, summary: short(i.summary, 160) })) };
    }),
  ]);
}

/* ============================================================
   翻译 + 今日要点
   有模型（任何 OpenAI 兼容接口，密钥放仓库 Secrets）：按节翻译 + 挑要点。
   没模型：标题走 MyMemory 免费机翻（每天有字数配额，只翻标题），要点按热度自动挑。
   两条路都走不通就原文列表，页面上写明。
   ============================================================ */
const LLM_KEY = process.env.AZI_LLM_KEY || '';
const LLM_URL = process.env.AZI_LLM_URL || 'https://api.deepseek.com/chat/completions';
const LLM_MODEL = process.env.AZI_LLM_MODEL || 'deepseek-chat';

async function ask(system, user) {
  const r = await get(LLM_URL, 'json', 120000, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + LLM_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const text = r.choices?.[0]?.message?.content || '{}';
  return JSON.parse(text);
}

/* 没模型时的机翻：MyMemory，免费、无密钥；一次一条，中间歇一下别触发限流 */
async function mtTitles(secs) {
  let done = 0;
  for (const s of secs) {
    for (const i of s.items || []) {
      if (i.keep || /[一-鿿]/.test(i.title)) continue;
      try {
        const d = await get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(short(i.title, 300))}&langpair=en|zh-CN&de=daily@azi36.com`);
        const t = d?.responseData?.translatedText;
        if (d?.responseStatus === 200 && t && !/QUOTA|LIMIT/i.test(t)) { i.zh = { title: t.trim(), summary: '' }; done++; }
        else if (/QUOTA|LIMIT/i.test(t || '')) { console.error('  · MyMemory 配额用完，剩下的留原文'); return done; }
      } catch (e) { console.error('  · MyMemory: ' + e.message); }
      await new Promise(r => setTimeout(r, 250));
    }
  }
  return done;
}

/* 没模型时的要点：按热度挑——分数、票数、时间，各来源取前一两条 */
function briefByHeat(secs) {
  const score = (s, i, k) => {
    const m = String(i.meta || '');
    const num = Number((m.match(/([\d,]+) (?:分|票)/) || [])[1]?.replace(/,/g, '') || 0);
    return num ? num : (s.title.startsWith('要闻') ? 1000 - k * 10 : 0);   // 要闻按时间倒序，越靠前越新
  };
  const pool = [];
  for (const s of secs) (s.items || []).forEach((i, k) => { if (!i.keep) pool.push({ s, i, v: score(s, i, k) }); });
  pool.sort((a, b) => b.v - a.v);
  // 行情类来源没有条目，只有几句事实（价格、总市值、恐贪），先把它们放进要点
  const picked = secs.flatMap(s => s.facts || []).slice(0, 3).map(f => ({ title: f, text: '', refs: [] }));
  const per = new Map(), seen = new Set();   // 每个来源最多两条；同一件事两家都报的只留一条
  const key = t => String(t).toLowerCase().replace(/[^a-z0-9一-鿿]/g, '').slice(0, 24);
  for (const p of pool) {
    if (picked.length >= 5) break;
    const c = per.get(p.s.title) || 0;
    if (c >= 2 || seen.has(key(p.i.title))) continue;
    per.set(p.s.title, c + 1);
    seen.add(key(p.i.title));
    // 没模型就没有中文摘要，不把英文原文直接铺出来；说明栏只写来源和热度
    picked.push({ title: p.i.zh ? p.i.zh.title : p.i.title, text: `${p.s.title.split(' · ')[0]} · ${String(p.i.meta || '').replace(/<[^>]+>/g, '').split(' · ').slice(0, 2).join(' · ')}`, refs: [p.i] });
  }
  return picked.length >= 3 ? picked : null;
}

/* 翻译一节：给 id → {title, summary}，原文保留在条目上，页面可切 */
async function translateSection(sec) {
  const list = sec.items.filter(i => !i.keep);
  if (!list.length) return;
  const payload = list.map((i, k) => ({ id: k, title: i.title, summary: i.summary || '' }));
  const out = await ask(
    '你是技术新闻编辑。把给定条目翻译成简体中文：标题精炼（不超过 40 字），摘要一两句、保留事实与数字；' +
    '产品名、公司名、模型名、论文专有名词保留英文原文。不要评价，不要增加原文没有的内容。' +
    '只输出 JSON：{"items":[{"id":0,"title":"…","summary":"…"}]}，条目数和 id 必须与输入一致。',
    JSON.stringify({ items: payload }),
  );
  const map = new Map((out.items || []).map(x => [Number(x.id), x]));
  list.forEach((i, k) => {
    const t = map.get(k);
    if (!t || !t.title) return;
    i.zh = { title: String(t.title).trim(), summary: String(t.summary || '').trim() };
  });
}

/* 今日要点：从所有条目里挑 3–5 条最值得知道的，一两句说清为什么 */
async function brief(kind, secs) {
  const pool = [];
  for (const s of secs) for (const i of s.items || []) pool.push({ id: pool.length, src: s.title, title: i.title, summary: short(i.summary || '', 120), ref: i });
  const facts = secs.flatMap(s => s.facts || []);
  if (!pool.length && !facts.length) return null;
  const who = kind === 'ai'
    ? '读者是关注 AI 的中文开发者。优先：重要发布、重大研究结果、行业里真正会影响做事方式的事。'
    : '读者是关注加密市场的中文读者。优先：影响整个市场的监管、安全事件、大机构动向、明显的行情变化。绝不给投资建议，不预测价格，不推荐币种。';
  const out = await ask(
    `你是日报编辑。${who} 从候选条目里挑出今天最值得知道的 3 到 5 件事，用简体中文写，每件一句话标题（不超过 30 字）加一到两句说明（只陈述事实，不评价）。` +
    '每件事注明它来自哪些候选条目的 id（可以多个，把同一件事的不同报道合并）。' +
    '只输出 JSON：{"brief":[{"title":"…","text":"…","ids":[0,3]}]}。',
    JSON.stringify({ facts, candidates: pool.map(p => ({ id: p.id, src: p.src, title: p.title, summary: p.summary })) }),
  );
  const items = (out.brief || []).slice(0, 5).map(b => ({
    title: String(b.title || '').trim(),
    text: String(b.text || '').trim(),
    refs: (b.ids || []).map(id => pool[Number(id)]).filter(Boolean).map(p => p.ref),
  })).filter(b => b.title);
  return items.length ? items : null;
}

/* ============================================================
   渲染
   ============================================================ */
const row = (i) => {
  const zh = i.zh;
  return `<li class="dl-item">` +
    `<a class="dl-title" href="${esc(i.href)}" target="_blank" rel="noopener">${esc(zh ? zh.title : i.title)}</a>` +
    (zh ? `<span class="dl-orig dl-orig-title">${esc(i.title)}</span>` : '') +
    (i.meta ? `<span class="dl-meta">${i.meta}</span>` : '') +
    (zh && zh.summary ? `<p class="dl-sum">${esc(zh.summary)}</p>` : '') +
    (i.summary ? `<p class="dl-sum${zh ? ' dl-orig' : ''}">${esc(i.summary)}</p>` : '') +
    `</li>`;
};

const KIND = {
  ai: { name: 'AI 日报', emoji: '🤖', desc: 'Hacker News 上的 AI 热帖、Hugging Face 每日论文、arXiv 新提交、GitHub 本周新仓库，每天早上自动整理并译成中文，先给要点再给全表。只列事实，不带观点。' },
  crypto: { name: '币圈日报', emoji: '🪙', desc: '市值前十行情、全市场数据、恐惧贪婪指数、CoinDesk 与 Cointelegraph 要闻，每天早上自动整理并译成中文，先给要点再给全表。只列事实，不推荐任何币种。' },
};

const NAV = (active) => ['首页', '博客', '产品', '游戏', '音乐'].map((c, i) => {
  const href = ['../../', '../../blog/', '../../products/', '../../games/', '../../music/'][i];
  return `        <a href="${href}"${c === active ? ' class="active"' : ''}>${c}</a>`;
}).join('\n');

function page({ kind, date, secs, briefItems, briefNote, translated, archive, latest }) {
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

  const briefHtml = briefItems
    ? `<ol class="brief">${briefItems.map(b => `<li><b>${esc(b.title)}</b><p>${esc(b.text)}</p>` +
        (b.refs.length === 1
          ? `<small><a href="${esc(b.refs[0].href)}" target="_blank" rel="noopener">查看来源 ↗</a></small>`
          : b.refs.length ? `<small>${b.refs.map(r => `<a href="${esc(r.href)}" target="_blank" rel="noopener">${esc(short(r.zh ? r.zh.title : r.title, 36))}</a>`).join('')}</small>` : '') +
        `</li>`).join('')}</ol>`
    : `<p class="dl-empty">今天没生成要点，下面是各来源的完整列表。</p>`;

  const secHtml = secs.map(s => `    <section class="dl-sec">
      <h2>${esc(s.title)}<small>${esc(s.note)}</small></h2>
      ${s.items ? `<ol class="dl">${s.items.map(row).join('')}</ol>` : s.html}
    </section>`).join('\n\n');

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
      <div class="daily-tools">
        <nav class="daily-switch" aria-label="切换日报">
          <a href="../ai/"${kind === 'ai' ? ' class="on"' : ''}>🤖 AI 日报</a>
          <a href="../crypto/"${kind === 'crypto' ? ' class="on"' : ''}>🪙 币圈日报</a>
        </nav>
        ${translated ? `<button class="orig-toggle" type="button" data-toggle-orig aria-pressed="false">显示原文</button>` : ''}
      </div>
    </div>

    <section class="dl-sec dl-brief">
      <h2>今日要点<small>${esc(briefNote)}</small></h2>
      ${briefHtml}
    </section>

${secHtml}

    <section class="dl-sec dl-archive">
      <h2>往期<small>每天一期，留最近 ${ARCHIVE_KEEP} 期</small></h2>
      <div class="daily-arch">
${archive.map(d => `        <a href="${d}.html"${d === date ? ' class="on"' : ''}>${d}</a>`).join('\n')}
      </div>
      <p class="dl-empty">来源都是免费公开接口，内容与链接归原作者所有；中文为机器翻译，以原文为准，点「显示原文」可对照。</p>
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

/* ---------- 主流程 ---------- */
for (const kind of kinds) {
  console.log(`生成 ${KIND[kind].name} ${today}`);
  const secs = kind === 'ai' ? await buildAI() : await buildCrypto();

  let translated = false, briefItems = null, briefNote = '从下面所有来源里挑出来的，三到五件';
  if (LLM_KEY) {
    for (const s of secs) {
      if (!s.items) continue;
      try { await translateSection(s); translated = true; }
      catch (e) { console.error(`  ✗ 翻译「${s.title}」: ${e.message}`); }
    }
    try { briefItems = await brief(kind, secs); }
    catch (e) { console.error(`  ✗ 要点: ${e.message}`); }
  } else {
    console.error('  · 没有 AZI_LLM_KEY，标题走免费机翻，要点按热度挑');
  }
  if (!translated) {
    const done = await mtTitles(secs);
    if (done) { translated = true; console.log(`  · 机翻了 ${done} 条标题`); }
  }
  if (!briefItems) {
    briefItems = briefByHeat(secs);
    briefNote = '今天没有模型挑选，按分数 / 票数 / 时间自动取的，每个来源最多两条';
  }

  const dir = path.join(ROOT, 'daily', kind);
  fs.mkdirSync(dir, { recursive: true });

  /* 归档：留最近 N 期，更早的删掉（仓库别无限长） */
  const dates = new Set(fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).map(f => f.slice(0, 10)));
  dates.add(today);
  const archive = [...dates].sort().reverse();
  for (const d of archive.slice(ARCHIVE_KEEP)) fs.unlinkSync(path.join(dir, d + '.html'));
  const kept = archive.slice(0, ARCHIVE_KEEP);

  const opts = { kind, date: today, secs, briefItems, briefNote, translated, archive: kept };
  fs.writeFileSync(path.join(dir, today + '.html'), page({ ...opts, latest: false }));
  fs.writeFileSync(path.join(dir, 'index.html'), page({ ...opts, latest: true }));
  console.log(`  → daily/${kind}/${today}.html · index.html（${secs.filter(s => s.ok).length}/${secs.length} 个来源正常${translated ? '，已翻译' : ''}${briefItems ? '，要点 ' + briefItems.length + ' 条' : ''}）`);
}
