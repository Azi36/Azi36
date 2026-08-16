/* ============================================
   azi36.com 全站交互脚本
   滚动显现 · 卡片光斑 · 导航阴影 · 数字滚动
   ============================================ */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 0. Twemoji：emoji 统一渲染成 SVG ----------
     CDN 加载失败时优雅降级为系统 emoji */
  const emojify = el => { if (window.twemoji) twemoji.parse(el, { folder: 'svg', ext: '.svg' }); };
  emojify(document.body);

  /* ---------- 1. 导航：滚动后加阴影 ---------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 2. 滚动显现动画 ----------
     自动作用于 main 的直接子元素和所有卡片，
     同一网格里的卡片会依次错开出现 */
  const targets = [];
  document.querySelectorAll('main > *').forEach(el => targets.push(el));
  // 注意：便利贴（.now-card）自带旋转 transform，不能进逐卡 reveal 名单
  document.querySelectorAll('.card-grid .card').forEach((el, i) => {
    el.style.setProperty('--d', (i % 6) * 70 + 'ms'); // 错开延迟
    targets.push(el);
  });

  if (reduceMotion) {
    targets.forEach(el => el.classList.add('visible'));
  } else {
    targets.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(el => io.observe(el));
  }

  /* ---------- 3. 卡片鼠标光斑追踪 ---------- */
  if (!reduceMotion) {
    document.querySelectorAll('.card, .feature').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- 6. 打字机文案 ----------
     用法：<p data-typer='["句子一","句子二"]'><span class="typer-text"></span></p> */
  const typer = document.querySelector('[data-typer]');
  if (typer) {
    let lines = [];
    try { lines = JSON.parse(typer.dataset.typer); } catch (e) { /* 格式错误则跳过 */ }
    const textEl = typer.querySelector('.typer-text');
    if (textEl && lines.length) {
      if (reduceMotion) {
        textEl.textContent = lines[0]; // 关闭动效时静态显示第一句
      } else {
        let li = 0, ci = 0, deleting = false;
        const step = () => {
          const line = lines[li];
          if (!deleting) {
            textEl.textContent = line.slice(0, ++ci);
            if (ci === line.length) { deleting = true; setTimeout(step, 2400); return; }
            setTimeout(step, 95);
          } else {
            textEl.textContent = line.slice(0, --ci);
            if (ci === 0) { deleting = false; li = (li + 1) % lines.length; setTimeout(step, 450); return; }
            setTimeout(step, 40);
          }
        };
        setTimeout(step, 500);
      }
    }
  }

  /* ---------- 6.1 点击涟漪：在点击位置扩散一圈品牌色圆环 ---------- */
  if (!reduceMotion) {
    document.addEventListener('pointerdown', e => {
      const ring = document.createElement('span');
      ring.className = 'click-ring';
      ring.style.left = e.clientX + 'px';
      ring.style.top = e.clientY + 'px';
      document.body.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove());
    });
  }

  /* ---------- 6.2 社交图标彩蛋：点击冒气泡 ---------- */
  document.querySelectorAll('.footer-social a[data-say]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      let tip = a.querySelector('.say-tip');
      if (!tip) {
        tip = document.createElement('span');
        tip.className = 'say-tip';
        a.appendChild(tip);
      }
      tip.textContent = a.dataset.say;
      tip.classList.remove('show');
      void tip.offsetWidth; // 重启动画
      tip.classList.add('show');
    });
  });

  /* ---------- 6.4 文章目录：自动生成 + 滚动高亮 ----------
     页面上放 <nav class="toc-list"></nav>，自动收集 .article 里的 h2 */
  const tocList = document.querySelector('.toc-list');
  const article = document.querySelector('.article');
  if (tocList && article) {
    const heads = article.querySelectorAll('h2');
    heads.forEach((h, i) => {
      if (!h.id) h.id = 'sec-' + (i + 1);
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      tocList.appendChild(a);
    });
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        tocList.querySelectorAll('a').forEach(x => x.classList.remove('on'));
        const link = tocList.querySelector('a[href="#' + e.target.id + '"]');
        if (link) link.classList.add('on');
      });
    }, { rootMargin: '-70px 0px -65% 0px' });
    heads.forEach(h => spy.observe(h));
  }

  /* ---------- 6.4b 日记目录：静态锚点 + 同款滚动高亮 ---------- */
  const diaryToc = document.querySelector('.diary-toc');
  if (diaryToc) {
    const entries = document.querySelectorAll('.diary-entry[id]');
    const dspy = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        diaryToc.querySelectorAll('a').forEach(x => x.classList.remove('on'));
        const link = diaryToc.querySelector('a[href="#' + e.target.id + '"]');
        if (link) link.classList.add('on');
      });
    }, { rootMargin: '-70px 0px -55% 0px' });
    entries.forEach(el => dspy.observe(el));
  }

  /* ---------- 6.5 推荐列表：分类筛选 + 折叠（统一状态机） ----------
     .rec-list 可选配前置 .filter-row 和 data-collapse="5"；
     · 只在「当前分类的匹配数」超过上限时才显示展开按钮
     · 按钮文案实时显示当前分类的条数
     · 切换分类自动重置为折叠态 */
  document.querySelectorAll('.rec-list').forEach(list => {
    const prev = list.previousElementSibling;
    const filterRow = prev && prev.classList.contains('filter-row') ? prev : null;
    const limit = parseInt(list.dataset.collapse, 10) || 0;
    const rows = [...list.querySelectorAll('.rec')];
    if (!filterRow && !limit) return;

    let tag = 'all';
    let folded = true;
    let btn = null;

    const match = r => tag === 'all' || (r.dataset.tags || '').split(/\s+/).includes(tag);

    const render = () => {
      const total = rows.filter(match).length;
      let shown = 0;
      rows.forEach(r => {
        let show = match(r);
        if (show && limit && folded && shown >= limit) show = false;
        if (show) shown++;
        r.classList.toggle('hidden', !show);
      });
      if (btn) {
        const need = total > limit; // 当前分类数量不足时按钮直接消失
        btn.style.display = need ? '' : 'none';
        if (need) btn.textContent = folded ? '展开全部 ' + total + ' 条 ▾' : '收起 ▴';
      }
    };

    if (limit && rows.length > limit) {
      btn = document.createElement('button');
      btn.className = 'rec-more';
      btn.addEventListener('click', () => { folded = !folded; render(); });
      list.appendChild(btn);
    }

    if (filterRow) {
      const chips = filterRow.querySelectorAll('.filter-chip');
      chips.forEach(chip => chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        tag = chip.dataset.tag;
        folded = true; // 换分类回到折叠初始态
        render();
      }));
    }

    render();
  });

  /* ---------- 6.7 首页「最近在忙」三件小玩具 ---------- */
  // ① 打磨进度：缓缓逼近 100% 但永远到不了
  const pct = document.getElementById('polishPct');
  if (pct && !reduceMotion) {
    let v = 87.3;
    setInterval(() => {
      v += (99.99 - v) * 0.012 + Math.random() * 0.015;
      if (v > 99.99) v = 99.99;
      pct.textContent = v.toFixed(2) + '%';
    }, 800);
  }

  // ② 灵感充能：点灯泡 +1，本地累计，逢 10 撒花
  const bulb = document.getElementById('bulbBtn');
  const sparkCount = document.getElementById('sparkCount');
  if (bulb && sparkCount) {
    let n = parseInt(localStorage.getItem('azi-spark') || '0', 10);
    sparkCount.textContent = n;
    bulb.addEventListener('click', () => {
      n++;
      localStorage.setItem('azi-spark', n);
      sparkCount.textContent = n;
      bulb.classList.add('lit');
      setTimeout(() => bulb.classList.remove('lit'), 500);
      const f = document.createElement('span');
      f.className = 'spark-float';
      f.textContent = '+1';
      bulb.appendChild(f);
      f.addEventListener('animationend', () => f.remove());
      if (n % 10 === 0 && window.aziConfetti) {
        const r = bulb.getBoundingClientRect();
        window.aziConfetti(r.left + r.width / 2, r.top);
      }
    });
  }

  // ③ 借口生成器：点卡片轮换一句新借口
  const excuseText = document.getElementById('excuseText');
  const excuseCard = document.getElementById('excuseCard');
  if (excuseText && excuseCard) {
    const EXCUSES = [
      '真的在写了（刚新建了文件夹）。',
      '灵感马上就来，先眯十分钟。',
      '写了三行，删了五行，越写越少。',
      '别催了别催了，这就动笔 QAQ',
      '题目想好了，正文还在脑子里。（又绕回来了）',
    ];
    let ei = -1;
    const next = () => {
      ei = (ei + 1) % EXCUSES.length;
      excuseText.style.opacity = '0';
      setTimeout(() => {
        excuseText.textContent = EXCUSES[ei];
        excuseText.style.opacity = '1';
      }, 150);
    };
    excuseCard.addEventListener('click', next);
    excuseCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
    });
  }

  /* ---------- 6.8 访客计数 ----------
     后端在自有服务器（经 api.azi36.com 暴露）；
     同一会话只计一次，API 不可达时静默隐藏 */
  const visitEl = document.getElementById('visitCount');
  if (visitEl) {
    const API = 'https://api.azi36.com';
    const path = sessionStorage.getItem('azi-counted') ? '/count' : '/hit';
    fetch(API + path).then(r => r.json()).then(d => {
      if (typeof d.total !== 'number') return;
      sessionStorage.setItem('azi-counted', '1');
      visitEl.textContent = ' · 第 ' + d.total.toLocaleString() + ' 次到访'
        + (typeof d.people === 'number' ? ' · 你是第 ' + d.people.toLocaleString() + ' 位路过的朋友' : '');
      visitEl.hidden = false;
    }).catch(() => { /* 后端未就绪时保持隐藏 */ });
  }

  /* ---------- 6.9 文章阅读统计 + 点赞 ----------
     每篇文章一个 slug（data-page）；阅读同一会话只计一次 */
  const pageStats = document.getElementById('pageStats');
  if (pageStats) {
    const API = 'https://api.azi36.com';
    const slug = pageStats.dataset.page;
    const likeBtn = document.getElementById('pageLike');

    const renderStats = (d) => {
      if (typeof d.reads !== 'number') return;
      document.getElementById('psReads').textContent =
        `读过 ${d.reads.toLocaleString()} 次 · ${d.readers.toLocaleString()} 人`;
      likeBtn.querySelector('i').textContent = d.likes;
      if (d.liked) likeBtn.classList.add('on');
      pageStats.hidden = false;
    };

    // 每次打开都记一次「读过」（人数按 IP 去重由服务端负责；刷子有每日限量兜底）
    fetch(`${API}/pages/${slug}/hit`, { method: 'POST' })
      .then(r => r.json()).then(renderStats).catch(() => {});

    likeBtn.addEventListener('click', () => {
      if (likeBtn.classList.contains('on')) return;
      likeBtn.classList.add('on');
      fetch(`${API}/pages/${slug}/like`, { method: 'POST' })
        .then(r => r.json()).then(d => {
          if (typeof d.likes === 'number') likeBtn.querySelector('i').textContent = d.likes;
        }).catch(() => {});
    });
  }

  /* ---------- 6.10 文章留言板 ----------
     留言与点赞走后端（PG 落库，按 data-page 归属文章）；点过赞的 id 记在本地防手滑 */
  const msgList = document.getElementById('msgList');
  if (msgList) {
    const API = 'https://api.azi36.com';
    const msgPage = msgList.closest('.msg-board').dataset.page || 'home';
    const escMsg = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const likedSet = new Set(JSON.parse(localStorage.getItem('azi-liked') || '[]'));

    const msgRow = (m) => `
      <div class="msg">
        <div class="msg-head"><b>${escMsg(m.name)}</b><time>${escMsg(m.date || '')}</time></div>
        <p>${escMsg(m.text)}</p>
        <button class="msg-like${likedSet.has(String(m.id)) ? ' on' : ''}" data-like="${m.id}" aria-label="点赞">
          ♥ <i>${m.likes || 0}</i>
        </button>
      </div>`;

    const renderMsgs = (msgs) => {
      msgList.innerHTML = msgs.length
        ? msgs.map(msgRow).join('')
        : '<p class="msg-empty">留言本还空着——第一页留给你。</p>';
    };

    fetch(`${API}/msgs?page=${msgPage}`).then(r => r.json())
      .then(d => renderMsgs(d.msgs || []))
      .catch(() => { msgList.innerHTML = '<p class="msg-empty">留言本暂时打不开，回头再来。</p>'; });

    document.getElementById('msgSend').addEventListener('click', () => {
      const name = document.getElementById('msgName').value.trim();
      const text = document.getElementById('msgText').value.trim();
      if (!text) { document.getElementById('msgText').focus(); return; }
      const btn = document.getElementById('msgSend');
      btn.disabled = true; btn.textContent = '寄出中…';
      fetch(API + '/msgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text, page: msgPage }),
      }).then(r => r.json()).then(d => {
        btn.disabled = false; btn.textContent = '留下';
        if (!d.ok) { btn.textContent = d.error || '没发出去'; setTimeout(() => { btn.textContent = '留下'; }, 2000); return; }
        document.getElementById('msgText').value = '';
        const empty = msgList.querySelector('.msg-empty');
        if (empty) empty.remove();
        msgList.insertAdjacentHTML('afterbegin', msgRow(d.msg));
      }).catch(() => { btn.disabled = false; btn.textContent = '网络开小差了'; setTimeout(() => { btn.textContent = '留下'; }, 2000); });
    });

    msgList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-like]');
      if (!btn) return;
      const id = btn.dataset.like;
      if (likedSet.has(id)) return;
      likedSet.add(id);
      localStorage.setItem('azi-liked', JSON.stringify([...likedSet]));
      btn.classList.add('on');
      fetch(`${API}/msgs/${id}/like`, { method: 'POST' }).then(r => r.json()).then(d => {
        if (typeof d.likes === 'number') btn.querySelector('i').textContent = d.likes;
      }).catch(() => {});
    });
  }

  /* ---------- 7. 撒花特效（全站可用） ----------
     用法：window.aziConfetti(x, y) —— 在屏幕坐标处炸开一片 emoji。
     粒子放在 popover 宿主里：popover 与 dialog 同属顶层（top layer），
     每次爆炸前重新 show 一次即可压在最晚打开的弹窗之上 */
  window.aziConfetti = function (x, y) {
    if (reduceMotion) return;
    let layer = document.getElementById('aziConfettiLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'aziConfettiLayer';
      layer.setAttribute('popover', 'manual');
      layer.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;' +
        'background:none;border:0;margin:0;padding:0;pointer-events:none;overflow:hidden;';
      document.body.appendChild(layer);
    }
    try {
      if (layer.matches(':popover-open')) layer.hidePopover();
      layer.showPopover();
    } catch (e) { /* 老浏览器没有 Popover API：粒子仍会落在 body 层 */ }
    const host = layer.isConnected && layer.matches(':popover-open') ? layer : document.body;
    const EMO = ['🎉', '✨', '🎊', '⭐', '💙'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.textContent = EMO[i % EMO.length];
      s.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y +
        'px;font-size:' + (12 + Math.random() * 14) + 'px;pointer-events:none;z-index:9999;';
      host.appendChild(s);
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      s.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' +
          (Math.sin(ang) * dist + 130) + 'px) rotate(' + (Math.random() * 360 - 180) + 'deg)', opacity: 0 }
      ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' })
        .onfinish = () => s.remove();
    }
  };

  /* ---------- 8. 可交互终端（首页） ----------
     点击终端即可输入命令，输入 help 查看全部 */
  const termBody = document.querySelector('.terminal-body');
  const termInput = document.querySelector('.term-input');
  if (termBody && termInput) {
    const inputLine = termInput.closest('.line');
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    /* 按实际渲染高度裁剪：长输出换行也不会撑爆窗口 */
    const trim = () => {
      while (termBody.scrollHeight > termBody.clientHeight) {
        const first = termBody.querySelector('.line');
        if (!first || first === inputLine) break;
        first.remove();
      }
    };
    const print = (html, cls) => {
      const d = document.createElement('div');
      d.className = 'line' + (cls ? ' ' + cls : '');
      d.innerHTML = html;
      emojify(d);
      termBody.insertBefore(d, inputLine);
      trim();
    };
    const CMDS = {
      'help': () => 'whoami · ls · cat 灵感.md · open 分享/推荐/游戏 · date · clear ……还有几条藏起来的，自己猜',
      'whoami': () => '今天最好看的访客',
      'ls': () => '分享/&nbsp;&nbsp;推荐/&nbsp;&nbsp;游戏/&nbsp;&nbsp;灵感.md',
      'cat 灵感.md': () => '「先把网站做完」…… ✓ 已完成',
      'date': () => new Date().toLocaleString('zh-CN'),
      'pwd': () => '/home/azi36/摸鱼中',
      'uname': () => 'AziOS 1.0（矮子内核 · 从不蓝屏）',
      'git status': () => 'On branch main · nothing to commit，摸鱼 tree clean',
      'rm -rf 拖延症': () => '删除失败：资源正被 azi36 进程占用',
      'ping': () => 'pong!（延迟：看心情）',
      'exit': () => '退出失败：你已经是网站的一部分了',
      'hi': () => '你好呀，欢迎光临 👋',
      '你好': () => '你好呀，欢迎光临 👋',
      'clear': () => {
        [...termBody.querySelectorAll('.line')].forEach(l => { if (l !== inputLine) l.remove(); });
        return null;
      },
      'open 分享': () => { setTimeout(() => location.href = 'shares/', 400); return '正在打开分享…'; },
      'open 推荐': () => { setTimeout(() => location.href = 'links/', 400); return '正在打开推荐…'; },
      'open 游戏': () => { setTimeout(() => location.href = 'games/', 400); return '正在打开游戏…'; },
      'fable': () => { setTimeout(() => location.href = 'fable/', 600); return '找 C某F 是吧？带你去看它的打工日记…'; },
      'sudo fable': () => '权限不足：它只听甲方的（甲方也不太听得动）',
    };
    let interacted = false; // 访客碰过终端后，停止循环播放开机剧本
    document.querySelector('.terminal').addEventListener('click', () => {
      interacted = true;
      termInput.focus();
    });
    termInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const cmd = termInput.value.trim();
      termInput.value = '';
      if (!cmd) return;
      print('<span class="prompt">$</span>' + esc(cmd));
      if (/^sudo\s+rm/.test(cmd)) { print('😱 想什么呢', 'out'); return; }
      const fn = CMDS[cmd];
      if (fn) { const r = fn(); if (r) print(r, 'out'); }
      else print('command not found: ' + esc(cmd) + '（试试 help）', 'out');
    });

    /* 开机小剧本：逐字打出命令，中途报一次错再重试成功 */
    if (!reduceMotion) {
      [...termBody.querySelectorAll('.line')].forEach(l => { if (l !== inputLine) l.remove(); });
      inputLine.style.display = 'none';

      const typeCmd = cmd => new Promise(done => {
        const d = document.createElement('div');
        d.className = 'line';
        d.innerHTML = '<span class="prompt">$</span><span></span><span class="term-caret"></span>';
        termBody.insertBefore(d, inputLine);
        trim();
        const slot = d.children[1];
        let i = 0;
        const t = setInterval(() => {
          slot.textContent = cmd.slice(0, ++i);
          if (i >= cmd.length) {
            clearInterval(t);
            const c = d.querySelector('.term-caret');
            if (c) c.remove();
            trim();
            setTimeout(done, 320);
          }
        }, 58);
      });

      const BOOT = [
        { cmd: 'whoami', out: 'Azi36', cls: 'out' },
        { cmd: 'npm run 灵感', out: 'Error: 灵感余额不足', cls: 'out err' },
        { cmd: 'npm run 灵感 --force', out: '✓ 强行执行成功，网站已上线', cls: 'out ok' },
        { cmd: 'status', out: '● 在线 · 慢慢更新中', cls: 'out' },
      ];

      const wait = ms => new Promise(r => setTimeout(r, ms));

      const playBoot = async () => {
        [...termBody.querySelectorAll('.line')].forEach(l => { if (l !== inputLine) l.remove(); });
        inputLine.style.display = 'none';
        for (const step of BOOT) {
          await typeCmd(step.cmd);
          print(esc(step.out), step.cls);
          await wait(480);
        }
        inputLine.style.display = ''; // 剧本演完，把输入行交还给访客
        trim();
      };

      (async () => {
        await wait(700);
        await playBoot();
        // 没人动终端就隔一会儿再演一遍；访客一碰就永久谢幕
        while (!interacted) {
          await wait(9000);
          if (interacted) break;
          await playBoot();
        }
      })();
    }
  }
})();
