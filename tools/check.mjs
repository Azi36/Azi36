#!/usr/bin/env node
/* ============================================================
   全站一致性体检 —— 手写 14 个 HTML 的代价是「改一处忘一页」，
   这个脚本就是专门抓这种漏改的。零依赖，node tools/check.mjs 直接跑。

   顺手还能生成 sitemap：node tools/check.mjs --write-sitemap

   加了新页面：只需在下面 PAGES 里补一行，其余检查自动覆盖。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://azi36.com';

/* 频道导航的唯一真相：改这里就等于要求所有页面跟上 */
const CHANNELS = ['首页', '博客', '产品', '游戏', '音乐'];

/* 全站共享的资源：版本号必须所有页面完全一致，否则 CDN 会缓存出两份 */
const SHARED = ['assets/style.css', 'assets/site.js', 'assets/player.js'];

/* 页面清单：文件 · 相对前缀 · 线上路径（null = 不进索引） */
const PAGES = [
  ['index.html', '', '/'],
  ['404.html', '/', null],
  ['blog/index.html', '../', '/blog/'],
  ['blog/github-pages.html', '../', '/blog/github-pages.html'],
  ['blog/cloudflare-cdn.html', '../', '/blog/cloudflare-cdn.html'],
  ['products/index.html', '../', '/products/'],
  ['games/index.html', '../', '/games/'],
  ['games/aim/index.html', '../../', '/games/aim/'],
  ['games/ddz/index.html', '../../', '/games/ddz/'],
  ['games/tgf/index.html', '../../', '/games/tgf/'],
  ['music/index.html', '../', '/music/'],
  ['fable/index.html', '../', '/fable/'],
  ['products/az-im.html', '../', '/products/az-im.html'],
  ['products/az-term.html', '../', '/products/az-term.html'],
  ['products/az-design.html', '../', '/products/az-design.html'],
  ['products/az-chain.html', '../', '/products/az-chain.html'],
  ['daily/ai/index.html', '../../', '/daily/ai/'],
  ['daily/crypto/index.html', '../../', '/daily/crypto/'],
];
/* 日报归档页由工作流每天生成一张，不手工登记：按目录扫进来（不进 sitemap，索引只认当期） */
for (const kind of ['ai', 'crypto']) {
  const dir = path.join(ROOT, 'daily', kind);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (/^\d{4}-\d{2}-\d{2}\.html$/.test(f)) PAGES.push([`daily/${kind}/${f}`, '../../', null]);
  }
}

/* 不该出现在成品里的占位文案 */
const PLACEHOLDERS = ['产品页地址', 'TODO：', 'lorem ipsum', '待补充'];

const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

/* ---------- 0. 仓库里的 HTML 有没有漏登记 ---------- */
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
  return out;
};
const known = new Set(PAGES.map(p => p[0]));
for (const f of walk(ROOT)) {
  if (!known.has(f)) fail(f, '新页面没登记进 tools/check.mjs 的 PAGES（sitemap 和体检都会漏掉它）');
}

/* ---------- 逐页检查 ---------- */
const versions = {};   // 资源 → { 版本号: [页面…] }

for (const [file, rel, canon] of PAGES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { fail(file, '文件不存在'); continue; }
  const s = fs.readFileSync(fp, 'utf8');
  const isAbs = rel === '/';   // 404 必须全用绝对路径
  // 查链接时先把注释去掉：注释里常写 <img src="…"> 之类的示例，不算真链接
  const live = s.replace(/<!--[\s\S]*?-->/g, '');
  // (?<![-\w]) 用来避开 data-src / xlink:href 这类同名后缀属性
  const LINK_RE = /(?<![-\w])(?:src|href)="(?!https?:|\/\/|#|data:|mailto:|javascript:)([^"?#]+)/g;

  /* 1. 共享资源版本号 */
  for (const asset of SHARED) {
    const base = asset.split('/').pop();
    const m = s.match(new RegExp(base.replace('.', '\\.') + '\\?v=(\\d+)'));
    if (!m) { fail(file, `没引用 ${asset}`); continue; }
    ((versions[asset] ??= {})[m[1]] ??= []).push(file);
  }

  /* 2. head 里的必备项 */
  if (!/<title>[^<]+<\/title>/.test(s)) fail(file, '缺 <title>');
  if (!/<meta name="description" content="[^"]{10,}">/.test(s)) fail(file, '缺 description（或太短）');
  if (!s.includes(`<link rel="icon" href="${rel}assets/favicon.svg">`)) fail(file, `favicon 应为 ${rel}assets/favicon.svg`);
  if (!s.includes('rel="preconnect"')) fail(file, '缺 preconnect');
  if (!/<meta name="theme-color"/.test(s)) fail(file, '缺 theme-color');
  if (!s.includes('localStorage.getItem("azi-theme")')) fail(file, 'head 缺防白闪的主题内联脚本');

  /* 3. 分享卡片 / 索引 */
  if (canon === null) {
    if (!s.includes('name="robots" content="noindex"')) fail(file, '这页不该进索引，缺 noindex');
  } else {
    if (!s.includes(`<link rel="canonical" href="${SITE}${canon}">`)) fail(file, `canonical 应为 ${SITE}${canon}`);
    for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card']) {
      if (!s.includes(`"${p}"`)) fail(file, `缺 ${p}`);
    }
    const ogUrl = (s.match(/property="og:url" content="([^"]+)"/) || [])[1];
    if (ogUrl && ogUrl !== SITE + canon) fail(file, `og:url 是 ${ogUrl}，应为 ${SITE}${canon}`);
    const desc = (s.match(/name="description" content="([^"]+)"/) || [])[1];
    const ogDesc = (s.match(/property="og:description" content="([^"]+)"/) || [])[1];
    if (desc && ogDesc && desc !== ogDesc) fail(file, 'description 和 og:description 不一致');
  }

  /* 4. 导航与页脚：五个频道一个都不能少（v1.3 加音乐时 404 页就漏过） */
  const nav = (s.match(/<nav class="site-nav">([\s\S]*?)<\/nav>/) || [])[1];
  if (!nav) fail(file, '找不到 <nav class="site-nav">');
  else for (const ch of CHANNELS) if (!nav.includes(`>${ch}<`)) fail(file, `导航缺「${ch}」`);

  // 音乐页和游戏子页用的是只有版权行的精简页脚，没有频道列就跳过；
  // 但只要有频道列，五个频道就得齐（v1.3 加音乐时 404 和游戏首页都漏过）
  const fcol = (s.match(/<div class="footer-col mystery">([\s\S]*?)<\/div>/) || [])[1];
  if (fcol) {
    for (const ch of CHANNELS) if (!fcol.includes(`>${ch}<`)) fail(file, `页脚缺「${ch}」`);
  } else if (s.includes('class="footer-cols"')) {
    fail(file, '有 footer-cols 但找不到频道列');
  }

  /* 5. 深浅色开关 */
  if (!s.includes('class="theme-toggle"')) fail(file, '导航缺深浅色开关');

  /* 6. 404 只能用绝对路径：它会为任意深层路径服务，相对路径必挂 */
  if (isAbs) {
    for (const m of live.matchAll(/(?<![-\w])(?:src|href)="(?!https?:|\/|#|data:|mailto:)([^"]+)"/g)) {
      fail(file, `用了相对路径 "${m[1]}"，404 页必须用 / 开头的绝对路径`);
    }
  }

  /* 7. 站内链接指向的文件真的存在吗 */
  if (!isAbs) {
    for (const m of live.matchAll(LINK_RE)) {
      const target = m[1];
      if (target.startsWith('/')) continue;
      let abs = path.resolve(path.dirname(fp), target);
      if (target.endsWith('/') || !path.basename(target).includes('.')) abs = path.join(abs, 'index.html');
      if (!fs.existsSync(abs)) fail(file, `链接指向不存在的文件：${target}`);
    }
  }

  /* 8. 占位文案 */
  for (const ph of PLACEHOLDERS) if (s.includes(ph)) fail(file, `还留着占位文案「${ph}」`);

  /* 9. 栏目标题里的计数要跟实际条目数对得上
     （下架 Small.im 时「好用的网站」就忘了改数，一直写着 8 其实只有 7） */
  for (const block of live.split(/<div class="section-title"/).slice(1)) {
    const m = block.match(/>([^<>]{2,12})\s*<span class="count">(\d+)<\/span>/);
    if (!m) continue;
    const [, title, claimed] = m;
    const upto = block.split(/<div class="(?:section-title|md-title)"/)[0];
    const actual = (upto.match(/class="(?:rec|card|prod)(?:"| )/g) || []).length;
    if (actual && Number(claimed) !== actual) {
      fail(file, `「${title.trim()}」计数写着 ${claimed}，实际有 ${actual} 条`);
    }
  }
}

/* ---------- 9. 版本号必须全站一致 ---------- */
for (const [asset, byVer] of Object.entries(versions)) {
  const vers = Object.keys(byVer);
  if (vers.length > 1) {
    const detail = vers.map(v => `v=${v}（${byVer[v].length} 页：${byVer[v].slice(0, 3).join(', ')}${byVer[v].length > 3 ? '…' : ''}）`).join(' / ');
    problems.push(`${asset}: 版本号分叉成 ${vers.length} 份 → ${detail}\n    同一个文件两个 URL，CDN 会各缓存一份，旧的那份还会发霉`);
  }
}

/* ---------- 10. 深色规则必须成对 ----------
   深色有两条路：手动切的 [data-theme="dark"]，和跟随系统的
   prefers-color-scheme + :not([data-theme="light"])。CSS 没法把两者合成一条，
   所以每条深色规则都得写两遍——只写一遍的后果是「手动切深色好看，
   跟随系统就不生效」，这种 bug 肉眼很难发现（棋盘格、频道色都栽过）。
   这里要求：同一个选择器尾巴在两种写法下都存在，且声明内容一致。 */
{
  const css = fs.readFileSync(path.join(ROOT, 'assets/style.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = (body) => body.split(';').map(d => d.trim().replace(/\s+/g, ' ')).filter(Boolean).sort();
  const same = (a, b) => decls(a).join('|') === decls(b).join('|');

  const attrRules = [...css.matchAll(/:root\[data-theme="dark"\]([^,{]*)\{([^}]*)\}/g)]
    .map(m => ({ tail: m[1].trim(), body: m[2] }));
  const mediaRules = [...css.matchAll(/:root:not\(\[data-theme="light"\]\)([^,{]*)\{([^}]*)\}/g)]
    .map(m => ({ tail: m[1].trim(), body: m[2] }));

  for (const r of attrRules) {
    const twins = mediaRules.filter(m => m.tail === r.tail);
    const label = `:root[data-theme="dark"] ${r.tail || '(自身)'}`;
    if (!twins.length) {
      problems.push(`assets/style.css: ${label} 没有跟随系统的孪生规则\n` +
        `    补一条 @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) ${r.tail} { …一样的声明… } }`);
    } else if (!twins.some(t => same(t.body, r.body))) {
      problems.push(`assets/style.css: ${label} 与它的媒体查询孪生规则声明不一致\n` +
        `    两边必须逐条一样，否则手动切深色和跟随系统会长得不一样`);
    }
  }
}

/* ---------- 11. 辅助文件 ---------- */
for (const f of ['robots.txt', 'sitemap.xml', 'assets/favicon.svg', 'assets/img/og.png', 'CNAME', '.nojekyll']) {
  if (!fs.existsSync(path.join(ROOT, f))) problems.push(`缺文件：${f}`);
}

/* ---------- sitemap 生成 ---------- */
if (process.argv.includes('--write-sitemap')) {
  const urls = PAGES.filter(p => p[2]).map(p => `  <url><loc>${SITE}${p[2]}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- 由 tools/check.mjs --write-sitemap 生成，别手改 -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  console.log(`已写入 sitemap.xml（${urls.length} 条）`);
}

/* ---------- 精选区必须是 main 的直接子元素 ----------
   加 № 003 那张卡时在 design 站踩过：卡片插到了 `</section>` 和下一个
   `<section>` 中间，HTML 完全合法，链接和版本号也全过，但版式是坏的 ——
   上面多出一截（前一个块的下外边距没人吃掉），下面又不留间距。
   横幅的 `margin: 60px 0 8px` 同样只在它是 main 的直接子元素时才成立。
   看不见页面的时候，这类错只能靠结构约束兜住。 */

{
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
    'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

  for (const [file] of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const total = (html.match(/class="[^"]*showcase/g) || []).length;
    if (!total) continue;

    const open = html.search(/<main[\s>]/);
    if (open < 0) { fail(file, '有精选区却没有 <main>'); continue; }
    const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
    re.lastIndex = html.indexOf('>', open) + 1;

    let depth = 0, direct = 0, m;
    while ((m = re.exec(html)) !== null) {
      const [, slash, tag, attrs] = m;
      const name = tag.toLowerCase();
      if (name === 'main' && slash) break;
      if (VOID.has(name) || /\/\s*$/.test(attrs)) continue;
      if (slash) { depth--; continue; }
      if (depth === 0 && /class="[^"]*showcase/.test(attrs)) direct++;
      depth++;
    }
    if (direct !== total) {
      fail(file, `${total} 个精选区里只有 ${direct} 个是 <main> 的直接子元素`
        + '（上下外边距靠这一层撑，套进别的容器里间距就不对了）');
    }
  }
}

/* ---------- 结果 ---------- */
if (problems.length) {
  console.error(`\n体检不通过，${problems.length} 处问题：\n`);
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('');
  process.exit(1);
}
console.log(`体检通过：${PAGES.length} 个页面，导航 / 版本号 / 分享卡片 / 站内链接全部一致。`);
