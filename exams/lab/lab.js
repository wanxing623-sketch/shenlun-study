/* ============================================================
   申论练习室 · 新增模块
   把“练习室”的练习 / 批改 / 素材 / 进度能力接入本工作台
   数据：exams/lab/lab-data.js（window.SH_LAB）
   设计：沿用本项目设计令牌，深浅色自动适配
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const LS = window.__LS || localStorage;

  /* ---------- 数据 ---------- */
  function raw() {
    const d = window.SH_LAB;
    if (!d) return null;
    if (d.__norm) return d;
    const arr = k => (Array.isArray(d[k]) ? d[k].map(o => Object.assign({}, o)) : []);
    const out = {
      summary: arr('summary'), essay: arr('essay'), drill: arr('drill'),
      quotes: arr('quotes'), swaps: arr('swaps'), frames: arr('frames'),
      cases: arr('cases'), phrases: arr('phrases'),
      __norm: true
    };
    out.summary.sort((a, b) => String(b.year || '9999').localeCompare(String(a.year || '9999')));
    window.SH_LAB = out;
    return out;
  }

  /* ---------- 基础工具 ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayShift = n => { const d = new Date(); d.setDate(d.getDate() + n); return todayStr(d); };
  const countChars = s => String(s || '').replace(/\s/g, '').length;
  const norm = s => String(s || '').replace(/[\s，。、；：""''（）()《》〈〉…—·,.!?！？:;"'~`\-]/g, '');
  const cut = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''));

  let toastT;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2000);
  }
  /* 确认弹窗：优先用工作台的弹窗（样式统一），降级到原生 confirm */
  function ask(msg, okText, onOk) {
    if (typeof window.SH_CONFIRM === 'function') window.SH_CONFIRM(msg, onOk, okText || '确定');
    else if (window.confirm(msg)) onOk();
  }

  function softScroll(el) {
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 状态（独立命名空间，不动原有键） ---------- */
  const KEY = 'sh_lab_v1';
  const DEF = { rec: {}, drafts: {}, fav: [], days: {}, rubric: {} };
  let S = loadS();
  function loadS() {
    try {
      const raw = JSON.parse(LS.getItem(KEY) || 'null');
      if (!raw) return JSON.parse(JSON.stringify(DEF));
      return Object.assign(JSON.parse(JSON.stringify(DEF)), raw);
    } catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function saveS() { try { LS.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 无痕模式忽略 */ } }

  /* ---------- 题库池 ---------- */
  const LABEL = { sum: '短材料小题', essay: '大作文拆解', drill: '标题分论点训练' };
  let POOL = { sum: [], essay: [], drill: [] };
  let BYID = {};
  function build() {
    const d = raw();
    if (!d) return false;
    POOL = {
      sum: d.summary.map(x => Object.assign({}, x, { _m: 'sum' })),
      essay: d.essay.map(x => Object.assign({}, x, { _m: 'essay' })),
      drill: d.drill.map(x => Object.assign({}, x, { _m: 'drill' }))
    };
    BYID = {};
    Object.keys(POOL).forEach(k => POOL[k].forEach(x => { BYID[x.id] = x; }));
    return true;
  }
  const ALL = () => [...POOL.sum, ...POOL.essay, ...POOL.drill];
  const IDX = (m, id) => (POOL[m] || []).findIndex(x => x.id === id) + 1;

  function typeGroup(t) {
    const s = String(t || '');
    if (/对策|建议|措施/.test(s)) return '提出对策';
    if (/分析|理解|评析|比较|认识|词句/.test(s)) return '综合分析';
    return '概括';
  }
  const draftOf = id => S.drafts[id] || {};

  /* ---------- 结构检查（分论点） ---------- */
  function checkStructure(draft) {
    const out = [];
    const d = raw() || { swaps: [] };
    const args = [draft.a1, draft.a2, draft.a3].map(x => String(x || '').trim());
    const filled = args.filter(Boolean);
    if (filled.length < 3) out.push({ lv: 'bad', t: `分论点只写了 ${filled.length} 条，考场上一般需要 3 条` });
    const starts = filled.map(a => a.slice(0, 2));
    const dup = starts.length >= 2 && starts.some((s, i) => starts.findIndex(x => x === s) !== i);
    out.push(dup
      ? { lv: 'warn', t: '分论点起手字重复（如三个“要”），建议错开为“把……／让……／说到底……”' }
      : { lv: 'ok', t: '分论点起手字已错开' });
    const lens = filled.map(a => a.length);
    if (lens.length >= 2) {
      const gap = Math.max.apply(null, lens) - Math.min.apply(null, lens);
      out.push(gap <= 2
        ? { lv: 'warn', t: '三条分论点字数几乎相同，段落会显得呆板，建议长短错落' }
        : { lv: 'ok', t: '分论点长短有变化' });
    }
    const bad = (d.swaps || []).filter(s => !s.soft && filled.join('').includes(s.bad)).map(s => s.bad);
    out.push(bad.length
      ? { lv: 'warn', t: '出现高频滥词：' + bad.join('、') + '（见素材库 · 替换词典）' }
      : { lv: 'ok', t: '未发现高频滥词' });
    const hasNot = filled.filter(a => a.includes('不是') && a.includes('而是')).length;
    out.push(hasNot > 1
      ? { lv: 'warn', t: '“不是……而是……”用了多次，这种句式一篇只留一处最有力' }
      : { lv: 'ok', t: '句式没有过度重复' });
    if (!filled.join('').match(/\d+/)) out.push({ lv: 'warn', t: '分论点里没有具体数字或物象，容易空泛' });
    return out;
  }

  /* ---------- 要点覆盖评分 ---------- */
  function pointList(answer) {
    const txt = String(answer || '');
    let pts = txt.split(/\n+/).map(s => s.trim()).filter(s => s.length > 6)
      .filter(s => /^(\d{1,2}\s*[.、)）]|[一二三四五六七八九十]{1,3}\s*[、.])/.test(s));
    if (pts.length < 3) {
      // 不用正则后行断言（旧版 Safari 会直接报错），手工按句读切分
      const parts = []; let cur = '';
      for (let i = 0; i < txt.length; i++) {
        cur += txt[i];
        if ('。；！？\n'.indexOf(txt[i]) >= 0) { parts.push(cur.trim()); cur = ''; }
      }
      if (cur.trim()) parts.push(cur.trim());
      pts = parts.filter(s => s.length > 10);
    }
    return pts.map(s => s.replace(/^(\d{1,2}\s*[.、)）]|[一二三四五六七八九十]{1,3}\s*[、.])\s*/, '').trim())
      .filter(s => s.length > 6).slice(0, 10);
  }
  function grams(s) {
    const t = norm(s), set = new Set();
    for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3));
    return set;
  }
  function overlapScore(item, text) {
    const pts = pointList(item.answer);
    const U = grams(text);
    const chunks = String(text || '').split(/[。；;，,！!？?\n]+/).map(s => s.trim())
      .filter(s => countChars(s) >= 6).map(s => grams(s));
    let hitCount = 0;
    const cov = pts.map(p => {
      const P = grams(p);
      let c1 = 0;
      if (P.size) { let n = 0; P.forEach(g => { if (U.has(g)) n++; }); c1 = n / P.size; }
      let c2 = 0;
      chunks.forEach(sg => {
        if (!sg.size) return;
        let n = 0; sg.forEach(g => { if (P.has(g)) n++; });
        const v = n / sg.size; if (v > c2) c2 = v;
      });
      const sim = Math.max(c1, c2);
      const hit = sim >= 0.34;
      if (hit) hitCount++;
      return { p, sim, hit };
    });
    return { points: cov, hitCount, total: pts.length, score: pts.length ? Math.round(hitCount / pts.length * 100) : 0 };
  }

  function scoreItem(item, draft) {
    const text = Object.values(draft || {}).join(' ');
    const keys = item.keys || [];
    const isSum = item._m === 'sum';
    if (isSum && (!keys.length || item.matcher === 'overlap')) {
      const ov = overlapScore(item, text);
      const n = countChars(text), notes = [];
      if (item.limit) {
        if (n > item.limit) notes.push(`写了 ${n} 字，超出上限 ${item.limit} 字——考场上超出部分不计数`);
        else if (n < item.limit * 0.65) notes.push(`写了 ${n} 字，上限 ${item.limit} 字，还有空间再补一两条要点`);
      }
      return {
        mode: 'overlap', points: ov.points, hitCount: ov.hitCount, total: ov.total,
        hits: ov.points.filter(p => p.hit).map(p => p.p),
        missed: ov.points.filter(p => !p.hit).map(p => p.p),
        kw: ov.score, struct: 100, score: ov.score, notes, keys: [], structOnly: false
      };
    }
    const T = norm(text);
    const hits = keys.filter(k => T.includes(norm(k)));
    const missed = keys.filter(k => !T.includes(norm(k)));
    let kw = keys.length ? Math.round(hits.length / keys.length * 100) : null;
    let struct = 100; const notes = [];
    if (!isSum) {
      const t = String(draft.title || '').trim();
      const args = [draft.a1, draft.a2, draft.a3].map(x => String(x || '').trim());
      const end = String(draft.end || '').trim();
      let s = 0;
      if (t.length >= 4) s += 25; else notes.push('标题未写或过短（建议 4—14 字）');
      const filled = args.filter(a => a.length >= 10).length;
      s += filled * 15;
      if (filled < 3) notes.push(`只有 ${filled} 条分论点达到 10 字以上，建议三条都写足`);
      if (end.length >= 12) s += 15; else notes.push('收尾句未写或过短（建议 30—60 字）');
      if (args.filter(Boolean).length === 3) s += 15;
      struct = Math.min(100, s);
    }
    if (kw === null) kw = struct;
    const structOnly = !keys.length;
    const score = isSum ? kw : (structOnly ? struct : Math.round(kw * 0.35 + struct * 0.65));
    return { mode: structOnly ? 'struct' : 'keys', hits, missed, kw, struct, score, notes, keys, structOnly };
  }

  /* ---------- 参考排版 ---------- */
  function answerRows(text) {
    const lines = String(text || '').split(/\n+/).map(t => t.trim()).filter(Boolean);
    let n = 0; const out = [];
    lines.forEach(t => {
      if (/^([一二三四五六七八九十]{1,3}、|【)/.test(t) && t.length <= 32) { out.push(`<div class="lb-refsec"><span class="idx">条</span>${esc(t)}</div>`); return; }
      const m = t.match(/^(\d{1,2})\s*[.、)）]\s*(.+)$/);
      n++;
      out.push(`<div class="lb-refpt"><span class="n">${pad(m ? m[1] : n)}</span><span>${esc(m ? m[2] : t)}</span></div>`);
    });
    return out.join('') || `<p class="lb-para">${esc(text)}</p>`;
  }
  function modelParas(text) {
    const ps = String(text || '').split(/\n+/).map(t => t.trim()).filter(Boolean);
    if (!ps.length) return '';
    const [head, ...rest] = ps;
    const isTitle = head.length <= 30 && !/[。；]/.test(head) && rest.length >= 2;
    return (isTitle ? `<p class="mtitle">${esc(head)}</p>` : `<p>${esc(head)}</p>`)
      + rest.map(t => `<p>${esc(t)}</p>`).join('');
  }
  function materialHTML(item) {
    const mat = item.material || '';
    if (!mat) return '';
    if (mat.indexOf('【材料') >= 0) {
      return mat.split(/(?=【材料)/).filter(Boolean).map(seg => {
        const m = seg.match(/^【材料\s*(\d+)】([\s\S]*)$/);
        if (!m) return `<p>${esc(seg)}</p>`;
        const body = m[2].trim().split('\n').filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
        return `<div class="msec"><div class="mlab">材料 ${esc(m[1])}</div>${body}</div>`;
      }).join('');
    }
    return mat.split('\n').filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  }
  function ringSVG(p) {
    const r = 32, c = 2 * Math.PI * r, off = c * (1 - p / 100);
    const col = p >= 80 ? 'var(--ok)' : p >= 55 ? 'var(--gold)' : 'var(--accent)';
    return `<svg width="78" height="78" viewBox="0 0 78 78" aria-hidden="true">
      <circle cx="39" cy="39" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
      <circle cx="39" cy="39" r="${r}" fill="none" stroke="${col}" stroke-width="5"
        stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round"
        transform="rotate(-90 39 39)"/></svg>
      <span class="val">${p}<small>%</small></span>`;
  }

  /* ---------- 进度记录 ---------- */
  function finalize(item, score) {
    const prev = S.rec[item.id] || { n: 0, best: 0 };
    const gap = score >= 80 ? 3 : score >= 55 ? 2 : 1;
    S.rec[item.id] = {
      n: (prev.n || 0) + 1,
      best: Math.max(prev.best || 0, score),
      last: score, next: dayShift(gap), at: todayStr()
    };
    const t = todayStr();
    S.days[t] = (S.days[t] || 0) + 1;
    saveS();
  }
  function calcStreak() {
    let n = 0;
    for (let i = 0; i < 400; i++) { if (S.days[dayShift(-i)]) n++; else if (i > 0) break; }
    return n;
  }
  function avgScore() {
    const v = Object.values(S.rec).map(r => r.best).filter(x => typeof x === 'number');
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  }

  const LAB = { ACT: {}, CUR: null, GRIDS: [], ANN: null, PARAS: [], BRUSH: 'y' };

  /* ---------- 分段 & 筛选状态 ---------- */
  let TAB = 'home';
  let FILT = { sum: { q: '', type: '全部', page: 1 }, essay: { q: '', region: '全部', page: 1 }, drill: { q: '', page: 1 } };
  const PAGE = 20;

  function hayOf(x) {
    return [x.title, x.source, x.type, x.theme, x.topic, x.region, x.year, x.paper, x.stem, x.req]
      .filter(Boolean).join(' ').toLowerCase();
  }
  function filtered(k) {
    const f = FILT[k];
    let list = POOL[k];
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(x => hayOf(x).includes(q)); }
    if (k === 'sum' && f.type && f.type !== '全部') list = list.filter(x => typeGroup(x.type) === f.type);
    if (k === 'essay' && f.region && f.region !== '全部') list = list.filter(x => String(x.region || '') === f.region);
    return list;
  }

  /* ============================================================
     视图
     ============================================================ */

  /* ---------- 总览 ---------- */
  function viewHome() {
    const due = ALL().filter(x => S.rec[x.id] && S.rec[x.id].next <= todayStr());
    const fresh = POOL.sum.filter(x => !S.rec[x.id]);
    const queue = (due.length ? due : fresh).slice(0, 4);
    const avg = avgScore();
    const done = Object.keys(S.rec).length;
    const total = ALL().length;
    const d = raw() || { quotes: [] };
    const q = d.quotes.length ? d.quotes[Math.floor(Math.random() * d.quotes.length)] : null;
    return `
    <div class="lb-hero">
      <div>
        <div class="lb-kicker">练习室 / 概览</div>
        <h2>短材料练要点，大作文练骨架</h2>
        <p>小题写完立刻给出<b>要点覆盖</b>，大作文只写标题、三条分论点与收尾句，系统按<b>关键词 + 结构</b>打分，并对照题库参考答案。<br>
        收入 ${POOL.sum.length} 道小题、${POOL.essay.length} 篇大作文、${POOL.drill.length} 组标题分论点专项拆练，以及 ${(d.quotes || []).length} 句金句 · ${(d.cases || []).length} 个案例 · ${(d.swaps || []).length} 组滥词替换 · ${(d.frames || []).length} 张骨架。</p>
      </div>
      <div class="lb-hero-cta">
        <button class="primary" data-lb="tab" data-tab="sum">开始练小题</button>
        <button class="secondary" data-lb="tab" data-tab="essay">看大作文</button>
      </div>
    </div>

    <div class="lb-modegrid">
      <button class="lb-modecard" data-lb="tab" data-tab="sum">
        <div class="n">01</div><b>短材料小题</b>
        <span>概括 / 分析 / 对策，材料 1—3 段。分条写答案，交卷后逐条比对参考要点，标出漏掉的。</span>
        <em>${POOL.sum.length} 道 · 建议 15—25 分钟</em>
      </button>
      <button class="lb-modecard" data-lb="tab" data-tab="essay">
        <div class="n">02</div><b>大作文拆解</b>
        <span>整卷材料 + 原题。只写标题、三条分论点、收尾句，练“立得住”，再对照范文段落。</span>
        <em>${POOL.essay.length} 篇 · 含题库参考范文</em>
      </button>
      <button class="lb-modecard" data-lb="tab" data-tab="drill">
        <div class="n">03</div><b>标题 · 分论点训练</b>
        <span>给主题，限时 12 分钟出标题 + 三条分论点首句 + 收尾句，附骨架提示与失分点。</span>
        <em>${POOL.drill.length} 组 · 每组配范文</em>
      </button>
    </div>

    <div class="lb-stats">
      <div class="lb-stat"><small>已练题目</small><b>${done}</b><span>／ ${total} 道</span></div>
      <div class="lb-stat"><small>平均得分率</small><b>${avg === null ? '—' : avg + '%'}</b><span>取每题最佳</span></div>
      <div class="lb-stat"><small>连续打卡</small><b>${calcStreak()}</b><span>天</span></div>
      <div class="lb-stat"><small>今天待复习</small><b>${due.length}</b><span>到期 ${due.length} 道</span></div>
    </div>

    <div class="lb-card">
      <h3>${due.length ? '今天该复习的' : '从这几道开始'}</h3>
      <div class="lb-duelist">
        ${queue.length ? queue.map((x, i) => `
          <button class="lb-duerow" data-lb="go" data-m="${x._m}" data-id="${esc(x.id)}">
            <span class="n">${pad(i + 1)}</span>
            <span class="t">${esc(x.title || x.theme || x.source || '未命名')}
              <small>${LABEL[x._m]}${x.region ? ' · ' + esc(x.region) : ''}${x.year ? ' · ' + esc(x.year) : ''}</small></span>
            <span class="lb-chip">${x._m === 'sum' ? (x.limit ? '≤ ' + esc(x.limit) + ' 字' : '小题') : '骨架'}</span>
          </button>`).join('') : '<div class="lb-empty">还没有题目数据</div>'}
      </div>
    </div>

    ${q ? `<div class="lb-card"><h3>随机金句</h3><div class="lb-quote"><p>${esc(q.t)}</p><div class="m"><span>#${esc(q.tag)}</span></div></div></div>` : ''}
    `;
  }

  /* ---------- 题库列表 ---------- */
  function listView(k) {
    const metas = {
      sum: ['短材料小题', '概括 · 分析 · 对策', '把各卷小题拆下来单练：只放这一题对应的材料，写完立刻看要点覆盖与参考答案。'],
      essay: ['大作文拆解', '材料齐全的国考 / 省考作文', '每份卷子的最后一题（大作文）＋原卷材料。只写标题、三条分论点、收尾句，再对照参考框架与范文。'],
      drill: ['标题 · 分论点训练', '八组主题 · 每组配范文', '给主题，练标题、分论点首句、收尾句。每组配骨架提示、失分点与范文片段。']
    }[k];
    const f = FILT[k];
    const items = filtered(k);
    const shown = items.slice(0, f.page * PAGE);
    const rows = shown.map((x, i) => {
      const rec = S.rec[x.id];
      const band = !rec ? '' : rec.best >= 80 ? '' : rec.best >= 55 ? ' mid' : ' lo';
      const sub = k === 'sum'
        ? [x.type, x.region, x.year ? x.year + ' 年' : '', x.limit ? '≤ ' + x.limit + ' 字' : '']
        : k === 'essay'
          ? [x.source, x.limit || '', x.score ? x.score + ' 分' : '']
          : [x.theme, x.limit || ''];
      return `<button class="lb-row" data-lb="go" data-m="${k}" data-id="${esc(x.id)}">
        <span class="idx">${pad(IDX(k, x.id))}</span>
        <span>
          <span class="ttl">${esc(x.title || x.theme || x.source || '未命名')}</span>
          <span class="sub">${sub.filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('')}</span>
        </span>
        <span class="score${band}">${rec ? '最佳 ' + rec.best + '%' : '未练'}</span>
      </button>`;
    }).join('');

    const more = items.length > shown.length
      ? `<button class="load-more" data-lb="more" data-k="${k}">加载更多（还有 ${items.length - shown.length} 道）</button>` : '';

    let filterExtra = '';
    if (k === 'sum') {
      const types = ['全部', '概括', '综合分析', '提出对策'];
      filterExtra = `<div class="chip-row">${types.map(t => `<button class="chip${f.type === t ? ' active' : ''}" data-lb="ftype" data-k="${k}" data-v="${t}">${t}</button>`).join('')}</div>`;
    } else if (k === 'essay') {
      const regs = ['全部', ...Array.from(new Set(POOL.essay.map(x => x.region).filter(Boolean))).slice(0, 16)];
      filterExtra = `<div class="chip-row">${regs.map(t => `<button class="chip${f.region === t ? ' active' : ''}" data-lb="fregion" data-k="${k}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
    }

    return `
    <div class="lb-kicker">练习室 / ${esc(metas[1])}</div>
    <h1 style="font-size:clamp(20px,2.4vw,24px);margin:6px 0 6px">${esc(metas[0])}</h1>
    <p style="color:var(--muted);font-size:13px;margin:0 0 14px;max-width:66ch">${esc(metas[2])}</p>
    <div class="toolbar">
      <div class="mini-search">⌕ <input data-lb="q" data-k="${k}" placeholder="搜索题干、来源、年份…" value="${esc(f.q)}" autocomplete="off"/></div>
      <button class="mini-btn" data-lb="rand" data-k="${k}">⤨ 随机一题</button>
      <span class="lb-small lb-dim" style="margin-left:auto">共 ${POOL[k].length} 道，筛选后 ${items.length} 道</span>
    </div>
    ${filterExtra}
    ${rows ? `<div class="lb-rows">${rows}</div>` : '<div class="lb-empty">没有匹配的题目，换个关键词或清空筛选。</div>'}
    ${more}`;
  }

  /* ---------- 练习页 ---------- */
  function practiceView(m, item) {
    const isSum = m === 'sum';
    const draft = draftOf(item.id);
    const head = isSum
      ? `<span class="lb-chip tag">${esc(item.type || '小题')}</span>${item.limit ? `<span class="lb-chip">≤ ${esc(item.limit)} 字</span>` : ''}${item.minutes ? `<span class="lb-chip">建议 ${esc(item.minutes)} 分钟</span>` : ''}`
      : `<span class="lb-chip tag">${esc(item.type || item.theme || LABEL[m])}</span>${item.limit ? `<span class="lb-chip">${esc(item.limit)}</span>` : ''}${item.minutes ? `<span class="lb-chip">建议 ${esc(item.minutes)} 分钟</span>` : ''}`;
    const title = isSum ? (item.title || item.source || '小题') : (item.theme || item.source || LABEL[m]);
    const sub = isSum ? [item.source, item.region, item.year].filter(Boolean).join(' · ') : [item.source, item.region].filter(Boolean).join(' · ');

    const editor = isSum ? `
      <div class="lb-field">
        <label for="lb_answer_g">作答（标准作文方格纸 · 点格子落笔，每格一字；回车换行）</label>
        <div class="kk-grid-host" id="lb_answer_g" aria-label="方格作文纸作答区"></div>
        <div class="kk-grid-foot"><span>首行自动缩进两格 · 超出字数上限的格子标红</span><span class="grow"></span><span id="lb_grid_tip"></span></div>
      </div>
      <textarea class="lb-ta" id="lb_answer" aria-hidden="true" tabindex="-1" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">${esc(draft.answer || '')}</textarea>
    ` : `
      <div class="lb-field"><label for="lb_title"><b>01</b>标题（4—14 字，最好含本题独有概念）</label>
        <div class="kk-grid-host" id="lb_title_g" aria-label="标题 方格纸"></div>
        <textarea class="lb-input" id="lb_title" aria-hidden="true" tabindex="-1" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">${esc(draft.title || '')}</textarea></div>
      <div class="lb-field"><label for="lb_a1"><b>02</b>分论点一（方格纸，点格子即可改写）</label>
        <div class="kk-grid-host" id="lb_a1_g" aria-label="分论点一 方格纸"></div>
        <textarea class="lb-input" id="lb_a1" aria-hidden="true" tabindex="-1" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">${esc(draft.a1 || '')}</textarea></div>
      <div class="lb-field"><label for="lb_a2"><b>03</b>分论点二（起手字要与上一条不同）</label>
        <div class="kk-grid-host" id="lb_a2_g" aria-label="分论点二 方格纸"></div>
        <textarea class="lb-input" id="lb_a2" aria-hidden="true" tabindex="-1" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">${esc(draft.a2 || '')}</textarea></div>
      <div class="lb-field"><label for="lb_a3"><b>04</b>分论点三</label>
        <div class="kk-grid-host" id="lb_a3_g" aria-label="分论点三 方格纸"></div>
        <textarea class="lb-input" id="lb_a3" aria-hidden="true" tabindex="-1" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">${esc(draft.a3 || '')}</textarea></div>
      <div class="lb-field"><label for="lb_end"><b>05</b>收尾句（30—60 字，不落口号，落在具体的人或事上）</label>
        <div class="kk-grid-host" id="lb_end_g" aria-label="收尾句 方格纸"></div>
        <textarea class="lb-input" id="lb_end" aria-hidden="true" tabindex="-1" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">${esc(draft.end || '')}</textarea></div>
      <div class="lb-checker" id="lb_checker"></div>
    `;

    return `
    <a class="lb-back" href="#" data-lb="tab" data-tab="${m}">← 返回${esc(LABEL[m])}</a>
    <div class="lb-phead">
      <div class="lb-chips">${head}</div>
      <h1>${esc(cut(title, 60))}</h1>
      ${sub ? `<div class="lb-src">${esc(sub)}</div>` : ''}
      ${item.hand ? '<div class="lb-chips" style="margin-top:9px"><span class="lb-chip gold">人工精析</span></div>' : ''}
    </div>

    <div class="lb-ws">
      <div class="lb-pane">
        <div class="label">题目</div>
        <div class="lb-stem">${esc(item.stem || item.task || '')}</div>
        ${item.req ? `<div class="lb-req"><b>作答要求</b>${esc(item.req)}</div>` : ''}
        ${item.task ? `<div class="lb-req"><b>本次只写</b>${esc(item.task)}</div>` : ''}
        ${item.skeleton ? `<div class="lb-req"><b>骨架</b>${esc(item.skeleton)}</div>` : ''}
        ${item.material ? `<div class="lb-mat" id="lb_mat_wrap">
          <div class="lb-mat-hd">
            <span class="lb-mat-t">给定资料 <b>${countChars(item.material)}</b> 字</span>
            <span class="kk-brushes" id="lb_brushes"></span>
          </div>
          <div class="lb-mat-body" id="lb_mat"></div>
          <div class="lb-mat-ft">
            <span class="kk-annbar" id="lb_annbar"></span>
            <span class="grow"></span>
            <button class="lb-btnsm" data-lb="clearann">清空标注</button>
          </div>
        </div>` : ''}
      </div>

      <div class="lb-pane">
        <div class="label">作答区</div>
        ${editor}
        <div class="lb-dock">
          <div class="info">
            <span id="lb_wc">0 字</span>
            <div class="bar"><i id="lb_wbar"></i></div>
            <span class="mono" id="lb_timer">00:00</span>
          </div>
          <div class="acts">
            <button class="lb-btnsm" data-lb="clear">清空</button>
            <button class="lb-btnsm" data-lb="reveal">看答案</button>
            <button class="primary" data-lb="submit">交卷批改</button>
          </div>
        </div>
      </div>
    </div>
    <div class="lb-result" id="lb_result"></div>`;
  }

  /* ---------- 结果 ---------- */
  function resultHTML(m, item, draft) {
    const sc = scoreItem(item, draft);
    const isSum = m === 'sum';
    const dims = ['审题立意', '结构分论点', '说理论证', '语言表达', '字数规范'];
    const prior = S.rubric[item.id] || {};
    const next = POOL[m][(POOL[m].findIndex(x => x.id === item.id) + 1) % POOL[m].length];
    const vTitle = sc.score >= 80 ? '这一题可以收手' : sc.score >= 55 ? '思路对，要点还差几条' : '先看参考要点，再重写一遍';
    const detail = isSum
      ? (sc.mode === 'overlap' ? `覆盖要点 ${sc.hitCount}/${sc.total}` : `要点命中 ${sc.hits.length}/${sc.keys.length}`)
      : (sc.structOnly ? `结构 ${sc.struct}%` : `关键词 ${sc.kw}%　·　结构 ${sc.struct}%`);
    const band = sc.score >= 80 ? '' : sc.score >= 55 ? ' mid' : ' lo';

    let missHTML = '';
    if (sc.mode === 'overlap') {
      const missed = sc.points.filter(p => !p.hit);
      if (missed.length) missHTML = `<div class="lb-miss"><h4>漏掉 ${missed.length} 条要点</h4>
        <ol>${missed.slice(0, 5).map(p => `<li>${esc(cut(p.p, 56))}</li>`).join('')}</ol>
        ${missed.length > 5 ? `<div class="lb-small lb-dim" style="margin-top:6px">还有 ${missed.length - 5} 条，见下方逐条对照。</div>` : ''}</div>`;
    } else if (sc.keys.length) {
      const miss = sc.keys.filter(k => !sc.hits.includes(k));
      if (miss.length) missHTML = `<div class="lb-miss"><h4>漏掉 ${miss.length} 个采分关键词</h4>
        <div class="lb-keylist">${miss.map(k => `<span class="lb-key miss">${esc(k)}</span>`).join('')}</div></div>`;
    }

    let panel = '';
    if (sc.mode === 'overlap') {
      panel = `<details class="lb-pts"${sc.score < 80 ? ' open' : ''}>
        <summary><span>逐条对照参考答案的 ${sc.total} 条要点</span><span class="lb-small lb-dim">百分比＝字面相似度</span></summary>
        ${sc.points.map((p, i) => `<div class="lb-pt${p.hit ? ' hit' : ''}">
          <span class="pn">${pad(i + 1)}</span><span>${esc(cut(p.p, 96))}</span><span class="pm">${Math.round(p.sim * 100)}%</span></div>`).join('')}
      </details>`;
    } else if (sc.keys.length) {
      panel = `<div class="lb-card" style="margin-top:12px"><h3>采分关键词</h3>
        <div class="lb-keylist">${sc.keys.map(k => `<span class="lb-key ${sc.hits.includes(k) ? 'hit' : 'miss'}">${esc(k)}</span>`).join('')}</div></div>`;
    }

    const structHTML = isSum ? '' : `<div class="lb-card" style="margin-top:12px"><h3>结构检查</h3>
      <div class="lb-checker">${checkStructure(draft).map(c => `<div class="lb-ck ${c.lv === 'ok' ? '' : c.lv}"><span class="dot"></span><span>${esc(c.t)}</span></div>`).join('')}</div></div>`;

    let ref = '';
    if (isSum) {
      ref = `<section class="lb-ref" id="lb_ref">
        <div class="lb-refhd"><span class="tag">参考答案</span><span class="note">题库整理版 · 非官方答案</span></div>
        ${answerRows(item.answer)}
        ${item.note ? `<div class="lb-tipbox" style="margin-top:16px"><div class="h">说明</div>${esc(item.note)}</div>` : ''}
        ${item.tips ? `<div class="lb-pitfall">${esc(item.tips)}</div>` : ''}
      </section>`;
    } else {
      const r = item.ref || {};
      const titles = r.titles || [], args = r.args || [];
      let sec = 0;
      const secT = t => { sec++; return `<h3 class="lb-refsec"><span class="idx">${pad(sec)}</span>${esc(t)}</h3>`; };
      ref = `<section class="lb-ref" id="lb_ref">
        <div class="lb-refhd"><span class="tag">参考答案</span><span class="note">${item.auto ? '题库范文 · 非官方答案' : '精析参考框架'}</span></div>
        ${titles.length ? secT('参考标题') + titles.map(t => `<div class="lb-quote"><p>${esc(t.t)}</p><div class="m"><span>${esc(t.why || '')}</span></div></div>`).join('') : ''}
        ${r.thesis ? secT('总论点') + `<p class="lb-para">${esc(r.thesis)}</p>` : ''}
        ${args.length ? secT(item.auto ? '参考分论点（取自范文段落首句）' : '参考分论点与论据落点')
          + args.map((a, i) => `<div class="lb-argref">
              <div class="lb-chips" style="margin-bottom:6px"><span class="lb-chip tag">分论点 ${i + 1}</span>${a.type ? `<span class="lb-chip">${esc(a.type)}</span>` : ''}</div>
              <div class="p">${esc(a.p)}</div>
              ${a.how ? `<div class="how"><b>${item.auto ? '提示' : '论据落点'}</b>　${esc(a.how)}</div>` : ''}
            </div>`).join('') : ''}
        ${r.ending ? secT('参考收尾句') + `<p class="lb-para">${esc(r.ending)}</p>` : ''}
        ${r.model ? secT(item.auto ? '本题参考范文' : '范文片段') + `<div class="lb-model">${modelParas(r.model)}</div>` : ''}
        ${(item.pitfalls && item.pitfalls.length) ? secT('本题失分点') + item.pitfalls.map(p => `<div class="lb-pitfall">${esc(p)}</div>`).join('') : ''}
        ${item.hint ? `<div class="lb-tipbox" style="margin-top:16px"><div class="h">审题思路</div>${esc(item.hint)}</div>` : ''}
        ${(item.skills && item.skills.length) ? secT('本题练点') + `<div class="lb-chips">${item.skills.map(s => `<span class="lb-chip gold">${esc(s)}</span>`).join('')}</div>` : ''}
      </section>`;
    }

    return `
    <div class="lb-scorehero${band}">
      <div class="lb-ring">${ringSVG(sc.score)}</div>
      <div class="lb-verdict">
        <div class="lb-kicker">${sc.mode === 'overlap' ? '要点覆盖率' : sc.structOnly ? '结构完成度' : '本次得分率'}</div>
        <h3>${sc.score}%　${esc(vTitle)}</h3>
        <div class="meta">${detail}　·　字数 ${countChars(Object.values(draft).join(''))}</div>
      </div>
      <div class="lb-actions">
        <button class="secondary" data-lb="jump" data-target="#lb_ref">看参考答案</button>
        ${next ? `<button class="primary" data-lb="go" data-m="${m}" data-id="${esc(next.id)}">下一题 →</button>` : ''}
      </div>
    </div>
    ${missHTML}
    ${sc.notes.length ? `<div class="lb-checker" style="margin-top:12px">${sc.notes.map(n => `<div class="lb-ck warn"><span class="dot"></span><span>${esc(n)}</span></div>`).join('')}</div>` : ''}
    ${panel}
    ${structHTML}
    ${ref}
    <details class="lb-self">
      <summary>自评（读完参考答案再打，1—5 分五项，只存本机）</summary>
      <div class="in">
        <div class="lb-rubric">
          ${dims.map((d, i) => `<div class="lb-rub">
            <span>${d}</span>
            <div class="lb-stars" data-dim="${i}">
              ${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}" class="${(prior[d] || 0) >= v ? 'on' : ''}" aria-label="${d} ${v} 分">★</button>`).join('')}
            </div></div>`).join('')}
        </div>
      </div>
    </details>
    <div class="lb-actions" style="margin-top:16px">
      ${next ? `<button class="primary" data-lb="go" data-m="${m}" data-id="${esc(next.id)}">下一题 →</button>` : ''}
      <button class="secondary" data-lb="tab" data-tab="${m}">返回列表</button>
    </div>`;
  }

  /* ---------- 素材库 ---------- */
  let libTab = 'quotes', libQ = '', libTag = '';
  const favKey = id => 'lab:' + id;
  const isFav = id => S.fav.includes(favKey(id));
  function facetChips(list, getTag) {
    const cnt = {};
    list.forEach(x => { const t = getTag(x); cnt[t] = (cnt[t] || 0) + 1; });
    const tags = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
    return `<div class="lb-facets">
      <button class="lb-facet${libTag === '' ? ' active' : ''}" data-lb="ltag" data-v="">全部 ${list.length}</button>
      ${tags.map(t => `<button class="lb-facet${libTag === t ? ' active' : ''}" data-lb="ltag" data-v="${esc(t)}">${esc(t)} ${cnt[t]}</button>`).join('')}
    </div>`;
  }
  function viewLib() {
    const d = raw() || { quotes: [], cases: [], phrases: [], swaps: [], frames: [] };
    const q = libQ.trim();
    const has = str => !q || String(str || '').includes(q);
    const tabs = [
      ['quotes', '金句', d.quotes.length],
      ['cases', '案例', d.cases.length],
      ['phrases', '规范表述', d.phrases.length],
      ['swaps', '替换词典', d.swaps.length],
      ['frames', '骨架', d.frames.length]
    ];
    let body = '', facets = '';
    if (libTab === 'quotes') {
      const list = d.quotes.filter(x => has(x.t + x.tag) && (!libTag || x.tag === libTag));
      facets = facetChips(d.quotes, x => x.tag);
      body = `<div class="lb-quotes">${list.map((x, i) => `<div class="lb-quote"><p>${esc(x.t)}</p>
        <div class="m"><span>#${esc(x.tag)}</span>
        <button class="lb-star${isFav('q' + i) ? ' on' : ''}" data-lb="fav" data-id="q${i}" aria-label="收藏这句">★</button></div></div>`).join('')}</div>`
        + (list.length ? '' : '<div class="lb-empty">没有匹配的句子，换个词试试。</div>');
    } else if (libTab === 'cases') {
      const list = d.cases.filter(x => has(x.n + x.tag + x.y + x.use) && (!libTag || x.tag === libTag));
      facets = facetChips(d.cases, x => x.tag);
      body = `<div class="lb-cases">${list.map((x, i) => `<div class="lb-case">
        <div class="hd"><b>${esc(x.n)}</b><span class="lb-chip tag">${esc(x.tag)}</span>
          <button class="lb-star${isFav('c' + i) ? ' on' : ''}" data-lb="fav" data-id="c${i}" aria-label="收藏这个案例">★</button></div>
        <p>${esc(x.y)}</p><div class="use"><b>能用在</b>${esc(x.use)}</div></div>`).join('')}</div>`
        + (list.length ? '' : '<div class="lb-empty">没有匹配的案例，换个词试试。</div>');
    } else if (libTab === 'phrases') {
      const list = d.phrases.filter(x => has(x.tag + (x.items || []).join('') + (x.eg || '')));
      body = list.map(x => `<div class="lb-phrase">
        <div class="ph"><span class="lb-chip tag">${esc(x.tag)}</span><span class="lb-small lb-dim">${(x.items || []).length} 条</span></div>
        <div class="lb-pitems">${(x.items || []).map(t => `<span class="lb-pitem">${esc(t)}</span>`).join('')}</div>
        ${x.eg ? `<div class="lb-peg"><b>例句</b>${esc(x.eg)}</div>` : ''}</div>`).join('')
        + (list.length ? '' : '<div class="lb-empty">没有匹配的表述，换个词试试。</div>');
    } else if (libTab === 'swaps') {
      const list = d.swaps.filter(x => has(x.bad + x.better + x.why));
      body = `<p class="lb-small lb-dim" style="margin:0 0 12px">这些词一旦出现，阅卷人立刻判定“背过模板”。左边是滥词，右边是能落地的写法；交卷时的结构检查也会自动标出。</p>`
        + list.map(x => `<div class="lb-swap"><span class="bad">${esc(x.bad)}</span><span class="ar">→</span>
          <span class="good">${esc(x.better)}<span>${esc(x.why)}</span></span></div>`).join('')
        + (list.length ? '' : '<div class="lb-empty">没有匹配的词，换个词试试。</div>');
    } else {
      const ORDER = ['开头', '过渡', '分论点', '结尾', '标题'];
      const grp = k => { const i = ORDER.indexOf(String(k).split('·')[0]); return i < 0 ? ORDER.length : i; };
      const list = d.frames.filter(x => has(x.k + x.use + x.body)).slice().sort((a, b) => grp(a.k) - grp(b.k));
      let last = '';
      body = list.map(x => {
        const g = String(x.k).split('·')[0];
        const head = g !== last ? `<h3 class="lb-refsec"><span class="idx">${pad(grp(x.k) + 1)}</span>${esc(g)}</h3>` : '';
        last = g;
        return head + `<div class="lb-frame"><div class="k">${esc(x.k)}<span class="lb-chip">${esc(x.use)}</span></div><div class="body">${esc(x.body)}</div></div>`;
      }).join('') + (list.length ? '' : '<div class="lb-empty">没有匹配的骨架，换个词试试。</div>');
    }

    const total = d.quotes.length + d.cases.length + d.phrases.length + d.swaps.length + d.frames.length;
    return `
    <div class="lb-kicker">练习室 / 素材库</div>
    <h1 style="font-size:clamp(20px,2.4vw,24px);margin:6px 0 6px">写作素材库</h1>
    <p style="color:var(--muted);font-size:13px;margin:0 0 14px;max-width:66ch">${d.quotes.length} 句金句 · ${d.cases.length} 个真实案例 · ${d.phrases.length} 组规范表述 · ${d.swaps.length} 组滥词替换 · ${d.frames.length} 张骨架。收藏的内容会出现在“我的练习”里，考前扫一遍。</p>
    <div class="lb-libtabs">${tabs.map(([k, l, n]) => `<button class="${libTab === k ? 'active' : ''}" data-lb="ltab" data-v-tab="${k}">${l}<i>${n}</i></button>`).join('')}</div>
    <div class="toolbar"><div class="mini-search">⌕ <input data-lb="lq" id="lb_lq" placeholder="搜索：法治／养老／压舱石……（${total} 条）" value="${esc(libQ)}" autocomplete="off"/></div>
      <span class="lb-small lb-dim" style="margin-left:auto">${libTag ? '已按「' + esc(libTag) + '」筛选' : '点下面的主题缩小范围'}</span></div>
    ${facets}
    ${body}`;
  }

  /* ---------- 我的练习 ---------- */
  function viewMe() {
    const d = raw() || { quotes: [], cases: [] };
    const recs = Object.entries(S.rec).sort((a, b) => String(a[1].next || '').localeCompare(String(b[1].next || '')));
    const avg = avgScore();
    const spark = recs.slice(-12).map(([, r]) => `<i style="height:${Math.max(6, r.best)}%" title="${r.best}%"></i>`).join('');
    const favs = S.fav.map(k => {
      const id = String(k).replace('lab:', '');
      const n = Number(id.slice(1));
      const arr = id[0] === 'q' ? d.quotes : id[0] === 'c' ? d.cases : [];
      return arr[n] || null;
    }).filter(Boolean);
    return `
    <div class="lb-kicker">练习室 / 我的练习</div>
    <h1 style="font-size:clamp(20px,2.4vw,24px);margin:6px 0 6px">练习记录</h1>
    <p style="color:var(--muted);font-size:13px;margin:0 0 14px;max-width:66ch">记录只保存在这台设备的浏览器里（与原工作台的收藏、笔记分开存放）。换设备可导出 / 导入。</p>
    <div class="lb-stats">
      <div class="lb-stat"><small>已练题目</small><b>${recs.length}</b><span>／ ${ALL().length} 道</span></div>
      <div class="lb-stat"><small>平均得分率</small><b>${avg === null ? '—' : avg + '%'}</b><span>取每题最佳</span></div>
      <div class="lb-stat"><small>连续打卡</small><b>${calcStreak()}</b><span>天</span></div>
      <div class="lb-stat"><small>累计作答</small><b>${Object.values(S.rec).reduce((a, r) => a + (r.n || 0), 0)}</b><span>次</span></div>
    </div>
    <div class="lb-card"><h3>最近 12 次成绩</h3>
      ${spark ? `<div class="lb-spark">${spark}</div>` : '<div class="lb-small lb-dim">还没有记录，练一题就有了。</div>'}
    </div>
    <div class="lb-card"><h3>复习安排（按得分自动排期）</h3>
      <div class="lb-rows">
        ${recs.length ? recs.map(([id, r]) => {
          const it = BYID[id]; if (!it) return '';
          const due = r.next <= todayStr();
          return `<button class="lb-row" data-lb="go" data-m="${it._m}" data-id="${esc(id)}">
            <span class="idx">${pad(IDX(it._m, id))}</span>
            <span><span class="ttl">${esc(cut(it.title || it.theme || it.source || '', 40))}</span>
            <span class="sub"><span>${LABEL[it._m]}</span><span>最佳 ${r.best}%</span><span>${due ? '今天该复习' : '下次 ' + esc(r.next)}</span></span></span>
            <span class="score${r.best >= 80 ? '' : r.best >= 55 ? ' mid' : ' lo'}">${due ? '待复习' : esc(r.next.slice(5))}</span>
          </button>`;
        }).join('') : '<div class="lb-empty">还没有练过的题目。</div>'}
      </div>
    </div>
    <div class="lb-card"><h3>收藏的句子与案例</h3>
      ${favs.length ? favs.map(f => `<div class="lb-pitfall" style="background:var(--surface-2);border-left-color:var(--brand)">${esc(f.t || f.n)}${f.y ? `<span class="lb-small lb-dim" style="display:block;margin-top:4px">${esc(f.y)}</span>` : ''}</div>`).join('') : '<div class="lb-small lb-dim">在素材库里点 ★ 收藏。</div>'}
    </div>
    <div class="lb-card"><h3>备份与重置</h3>
      <div class="lb-actions">
        <button class="secondary" data-lb="export">导出练习记录</button>
        <label class="secondary" style="position:relative;overflow:hidden;cursor:pointer">导入记录
          <input type="file" accept="application/json" id="lb_import" style="position:absolute;inset:0;opacity:0;cursor:pointer">
        </label>
        <button class="secondary" data-lb="reset" style="color:var(--accent);border-color:var(--accent)">清空练习记录</button>
      </div>
      <p class="lb-small lb-dim" style="margin:10px 0 0">导出为 JSON，含草稿、得分与复习时间；清空后不可恢复。</p>
    </div>
    <div class="lb-card"><h3>内容来源</h3>
      <p class="lb-small lb-dim" style="margin:0">小题材料为围绕高频考点编写的训练短文（12 道为人工精析，含采分关键词），其余小题与大作文选自公开国考、省考真题，参考答案为公开题库整理版，非官方答案。批改由本地规则引擎完成，不上传任何数据。</p>
    </div>`;
  }

  /* ============================================================
     渲染到工作台
     ============================================================ */
  const VIEW = document.getElementById('view-lab');
  const MAIN = document.getElementById('lb-main');
  const SEG = document.getElementById('lab-seg');

  function segHTML() {
    const items = [
      ['home', '概览'], ['sum', '小题'], ['essay', '大作文'], ['drill', '标题分论点'], ['lib', '素材库'], ['me', '我的练习']
    ];
    return items.map(([k, l]) => `<button class="${TAB === k ? 'active' : ''}" data-lb="tab" data-tab="${k}">${l}${
      k === 'sum' ? `<i>${POOL.sum.length}</i>` : k === 'essay' ? `<i>${POOL.essay.length}</i>` : k === 'drill' ? `<i>${POOL.drill.length}</i>` : ''
    }</button>`).join('');
  }

  function syncSeg() { if (SEG) SEG.innerHTML = segHTML(); }

  function renderLab() {
    if (!MAIN) return;
    if (!build()) {
      MAIN.innerHTML = '<div class="lb-empty">练习数据加载失败：请确认 <code>exams/lab/lab-data.js</code> 存在。</div>';
      return;
    }
    syncSeg();
    LAB.CUR = null;
    // 保持滚动位置：仅内容区替换
    const y = MAIN.scrollTop;
    MAIN.innerHTML = TAB === 'home' ? viewHome()
      : TAB === 'lib' ? viewLib()
        : TAB === 'me' ? viewMe()
          : listView(TAB);
    if (y) MAIN.scrollTop = y;
    if (typeof syncLabFloat === 'function') syncLabFloat();
  }

  function openItem(m, id) {
    if (!build()) return;
    if (m === 'lib') { TAB = 'lib'; renderLab(); return; }
    const item = POOL[m] && POOL[m].find(x => x.id === id);
    if (!item) { toast('没有找到这道题'); return; }
    TAB = m;
    syncSeg();
    if (TIMER) { clearInterval(TIMER); TIMER = null; }
    LAB.CUR = id;
    LAB.GRIDS = []; LAB.ANN = null;
    MAIN.innerHTML = practiceView(m, item) + '<div id="lb_result"></div>';
    if (VIEW && typeof VIEW.scrollIntoView === 'function') VIEW.scrollIntoView({ behavior: 'auto', block: 'start' });
    bindPractice(m, item);
    const rec = S.rec[item.id];
    if (rec) {
      const box = $('#lb_result');
      if (box) box.innerHTML = `<div class="lb-scorehero" style="margin-top:18px">
        <div class="lb-ring">${ringSVG(rec.best)}</div>
        <div class="lb-verdict"><div class="lb-kicker">上次成绩</div>
          <h3>得分率 ${rec.best}%　·　第 ${rec.n} 次</h3>
          <div class="meta">${rec.next <= todayStr() ? '今天该复习了' : '下次复习 ' + esc(rec.next)}</div></div>
        <div class="lb-actions"><button class="secondary" data-lb="reveal">看参考答案</button></div></div>`;
    }
    if (typeof syncLabFloat === 'function') syncLabFloat();
    // 更新面包屑
    const pt = $('#page-title'), ps = $('#page-subtitle');
    if (pt) pt.textContent = '练习室';
    if (ps) ps.textContent = LABEL[m] + ' · ' + (item.title || item.theme || '');
  }

  /* ---------- 练习页交互 ---------- */
  let TIMER = null;
  /* 方格纸字段映射：小题只有 answer；大作文有 4 个短格 */
  function gridFields(m, item) {
    if (m === 'sum') return [{ k: 'answer', id: 'lb_answer_g', limit: item.limit || 0, rows: 6 }];
    return [
      { k: 'title', id: 'lb_title_g', limit: 16, rows: 1 },
      { k: 'a1', id: 'lb_a1_g', limit: 45, rows: 1 },
      { k: 'a2', id: 'lb_a2_g', limit: 45, rows: 1 },
      { k: 'a3', id: 'lb_a3_g', limit: 45, rows: 1 },
      { k: 'end', id: 'lb_end_g', limit: 70, rows: 2 }
    ];
  }

  function bindPractice(m, item) {
    const isSum = m === 'sum';
    const draft = Object.assign({}, draftOf(item.id));
    const persist = () => { S.drafts[item.id] = Object.assign({}, draft); saveS(); };
    LAB.GRIDS = [];
    LAB.CUR = item.id;

    /* ---- 方格纸 ---- */
    const map = gridFields(m, item);
    map.forEach(f => {
      const host = document.getElementById(f.id);
      if (!host || !window.KL) return;
      const g = KL.Grid({
        el: host, perRow: 20, rows: f.rows, indent: isSum ? 2 : 0, limit: f.limit,
        value: draft[f.k] || '',
        onChange: () => {
          const v = g ? g.getValue() : '';
          draft[f.k] = v;
          persist();
          if (isSum) updateMeter(item); else updateChecker(draft);
        }
      });
      LAB.GRIDS.push(g);
    });
    if (isSum) updateMeter(item); else updateChecker(draft);

    /* ---- 材料标注（与真题作答同一套画笔） ---- */
    const wrap = document.getElementById('lb_mat');
    if (wrap && item.material && window.KL) {
      const paras = String(item.material).replace(/【材料\s*\d+】/g, '\n').split(/\n+/).map(t => t.trim()).filter(Boolean);
      LAB.PARAS = paras;
      const bar = document.getElementById('lb_brushes');
      const barBox = document.getElementById('lb_annbar');
      if (bar) bar.innerHTML = KL.brushBarHTML(LAB.BRUSH || 'y');
      if (barBox) barBox.innerHTML = KL.annBarHTML(LAB.BRUSH || 'y');
      LAB.ANN = KL.Annotator({
        el: '#lb_mat',
        brush: LAB.BRUSH || 'y',
        matIdx: () => 0,
        getMats: () => [{ p: LAB.PARAS }],
        key: () => 'sh_lab_ann_' + item.id,
        countEl: null,
        onAfter: () => {
          const num = document.querySelector('#lb_annbar .kk-ann-num');
          if (num) num.textContent = LAB.ANN ? LAB.ANN.count() : 0;
        },
        onBrush: b => { LAB.BRUSH = b; },
        headHTML: () => ''
      });
      LAB.ANN.render();
      // 首次渲染后补一次计数
      const num = document.querySelector('#lb_annbar .kk-ann-num');
      if (num) num.textContent = LAB.ANN.count();
    } else {
      LAB.ANN = null;
    }

    clearInterval(TIMER);
    const t0 = Date.now();
    TIMER = setInterval(() => {
      const box = document.getElementById('lb_timer');
      if (!box) { clearInterval(TIMER); return; }
      const sec = Math.floor((Date.now() - t0) / 1000);
      const over = item.minutes && sec > item.minutes * 60;
      box.textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}${item.minutes ? ' / ' + item.minutes + '′' : ''}`;
      box.style.color = over ? 'var(--accent)' : '';
    }, 500);

    function submit() {
      if (!Object.values(draft).some(v => String(v || '').replace(/\s/g, '').length >= 4)) { toast('先写一点内容再交卷'); return; }
      const checker = document.getElementById('lb_checker');
      if (checker) checker.style.display = 'none';
      const sc = scoreItem(item, draft);
      finalize(item, sc.score);
      const box = document.getElementById('lb_result');
      if (box) box.innerHTML = resultHTML(m, item, draft);
      toast(`得分率 ${sc.score}%　·　${sc.score >= 80 ? '很稳，保持' : '看要点补一遍'}`);
      softScroll(box);
    }
    function reveal() {
      const sc = scoreItem(item, draft);
      if (!S.rec[item.id]) finalize(item, sc.score); else saveS();
      const box = document.getElementById('lb_result');
      if (box) box.innerHTML = resultHTML(m, item, draft);
      toast('已显示参考答案');
      softScroll(box);
    }
    LAB.ACT = {
      submit, reveal,
      clear() {
        ask('清空本题作答？', '清空', () => {
        map.forEach((f, i) => {
          const g = LAB.GRIDS[i];
          if (g) g.setValue('');
          draft[f.k] = '';
        });
        persist();
        if (isSum) updateMeter(item); else updateChecker(draft);
        const ck = document.getElementById('lb_checker'); if (ck) ck.style.display = '';
        const box = document.getElementById('lb_result'); if (box) box.innerHTML = '';
        });
      },
      clearann() {
        if (!LAB.ANN) return;
        const n = LAB.ANN.ops().length;
        if (!n) { toast('还没有标注'); return; }
        ask('清空这篇材料的全部标注？', '清空', () => {
          LAB.ANN.clearAll();
          toast('已清空 ' + n + ' 处标注');
        });
      }
    };
  }

  function updateMeter(item) {
    const g = LAB.GRIDS && LAB.GRIDS[0];
    const ta = document.getElementById('lb_answer');
    const text = g ? g.getValue() : (ta ? ta.value : '');
    const n = countChars(text);
    const w = document.getElementById('lb_wc'), bar = document.getElementById('lb_wbar');
    const ratio = item.limit ? n / item.limit : 0;
    if (w) w.textContent = `${n} 字${item.limit ? ' ／ ' + item.limit : ''}`;
    if (bar) {
      bar.style.width = Math.min(100, ratio * 100) + '%';
      bar.className = ratio > 1 ? 'over' : ratio >= 0.85 ? 'mid' : '';
    }
    const tip = document.getElementById('lb_grid_tip');
    if (tip) tip.textContent = item.limit ? (n > item.limit ? '超出 ' + (n - item.limit) + ' 字，考场不计入' : n < item.limit * 0.65 ? '还可以再写 ' + (item.limit - n) + ' 字' : '字数在范围内') : '';
  }
  /* 与「真题作答」共用：移动端浮动画笔条（练习室） */
  function syncLabFloat() {
    const f = document.getElementById('kk-float');
    if (!f || !window.KL) return;
    const view = document.getElementById('view-lab');
    const on = view && view.classList.contains('active') && document.getElementById('lb_mat');
    const narrow = window.matchMedia && window.matchMedia('(max-width:760px)').matches;
    if (!on || !narrow || LAB.FLOAT_OFF) { if (f.dataset.ctx === 'lab') { f.hidden = true; f.innerHTML = ''; f.dataset.ctx = ''; } return; }
    f.hidden = false; f.dataset.ctx = 'lab';
    f.innerHTML = '<span class="kk-ann-now"><i class="kk-dot ' + LAB.BRUSH + '"></i></span>'
      + KL.brushBarHTML(LAB.BRUSH)
      + '<button class="kk-float-x" data-float="close" aria-label="收起画笔条">✕</button>';
  }
  document.addEventListener('kk:labfloat', syncLabFloat);

  function updateChecker(draft) {
    const box = document.getElementById('lb_checker'); if (!box) return;
    const filled = [draft.a1, draft.a2, draft.a3].filter(x => String(x || '').trim().length >= 6);
    if (!filled.length) {
      box.innerHTML = '<div class="lb-ck"><span class="dot" style="background:var(--line-strong)"></span><span class="lb-dim">填完分论点后，这里会自动检查：起手字是否重复、长短是否雷同、有没有滥词与具体物象。</span></div>';
      return;
    }
    box.innerHTML = checkStructure(draft).map(c => `<div class="lb-ck ${c.lv === 'ok' ? '' : c.lv}"><span class="dot"></span><span>${esc(c.t)}</span></div>`).join('');
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-lb]');
    if (!el) return;
    const act = el.dataset.lb;
    if (act === 'tab') {
      e.preventDefault();
      if (!VIEW || !VIEW.classList.contains('active')) return;
      TAB = el.dataset.tab;
      if (TIMER) { clearInterval(TIMER); TIMER = null; }
      renderLab();
      if (VIEW && typeof VIEW.scrollIntoView === 'function') VIEW.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!VIEW || !VIEW.classList.contains('active')) { if (act !== 'go') return; }
    if (act === 'go') { e.preventDefault(); openItem(el.dataset.m, el.dataset.id); return; }
    if (act === 'more') { FILT[el.dataset.k].page += 1; renderLab(); return; }
    if (act === 'ftype') { FILT[el.dataset.k].type = el.dataset.v; FILT[el.dataset.k].page = 1; renderLab(); return; }
    if (act === 'fregion') { FILT[el.dataset.k].region = el.dataset.v; FILT[el.dataset.k].page = 1; renderLab(); return; }
    if (act === 'rand') {
      const pool = filtered(el.dataset.k);
      if (!pool.length) { toast('当前筛选没有题目'); return; }
      openItem(el.dataset.k, pool[Math.floor(Math.random() * pool.length)].id); return;
    }
    if (act === 'ltab') { libTab = el.dataset.vTab; libTag = ''; renderLab(); return; }
    if (act === 'ltag') { libTag = el.dataset.v; renderLab(); return; }
    if (act === 'fav') {
      const key = favKey(el.dataset.id);
      const i = S.fav.indexOf(key);
      const on = i < 0;
      if (on) S.fav.push(key); else S.fav.splice(i, 1);
      saveS();
      el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false');
      toast(on ? '已收藏' : '已取消收藏');
      return;
    }
    if (act === 'brush') {
      const b = el.dataset.v;
      LAB.BRUSH = b;
      if (LAB.ANN) LAB.ANN.setBrush(b);
      const bar = document.getElementById('lb_brushes');
      if (bar) bar.innerHTML = KL.brushBarHTML(b);
      const ft = document.getElementById('lb_annbar');
      if (ft) {
        ft.innerHTML = KL.annBarHTML(b);
        const n = ft.querySelector('.kk-ann-num');
        if (n) n.textContent = LAB.ANN ? LAB.ANN.ops().length : 0;
      }
      toast(b === 'x' ? '橡皮：点击句子或划选即可清除标注' : '已选择' + (KL.NAME[b] || '黄') + '色标注笔');
      return;
    }
    if (act === 'clearann') { e.preventDefault(); if (LAB.ACT.clearann) LAB.ACT.clearann(); return; }
    if (act === 'submit' || act === 'reveal' || act === 'clear') {
      e.preventDefault();
      if (LAB.ACT[act]) LAB.ACT[act]();
      return;
    }
    if (act === 'jump') {
      const t = document.querySelector(el.dataset.target); if (t) softScroll(t); return;
    }
    if (act === 'export') {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `shenlun-lab-${todayStr()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      toast('已导出练习记录'); return;
    }
    if (act === 'reset') {
      ask('确定清空练习室的草稿、得分与收藏？此操作不可撤销（不影响原工作台的数据）。', '清空', () => {
        S = JSON.parse(JSON.stringify(DEF)); saveS(); renderLab(); toast('已清空练习记录');
      });
      return;
    }
  });

  /* 画笔：练习室材料标注（与真题作答同一套按钮样式） */
  document.addEventListener('click', e => {
    const b = e.target.closest('.lb-mat [data-brush], #kk-float [data-brush]');
    if (!b) return;
    const view = document.getElementById('view-lab');
    if (!view || !view.classList.contains('active')) return;
    if (document.getElementById('view-workspace') && document.getElementById('view-workspace').classList.contains('active')) return;
    LAB.BRUSH = b.dataset.brush;
    if (LAB.ANN) LAB.ANN.setBrush(LAB.BRUSH);
    const bar = document.getElementById('lb_brushes');
    if (bar) bar.innerHTML = KL.brushBarHTML(LAB.BRUSH);
    const ft = document.getElementById('lb_annbar');
    if (ft) {
      ft.innerHTML = KL.annBarHTML(LAB.BRUSH);
      const n = ft.querySelector('.kk-ann-num');
      if (n) n.textContent = LAB.ANN ? LAB.ANN.ops().length : 0;
    }
    syncLabFloat();
    toast(LAB.BRUSH === 'x' ? '橡皮：点击句子或划选即可清除标注' : '已选择' + (KL.NAME[LAB.BRUSH] || '黄') + '色标注笔');
  });

  // 搜索框 / 导入
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-lb="q"]');
    if (el) {
      const k = el.dataset.k, pos = el.selectionStart;
      FILT[k].q = el.value; FILT[k].page = 1; renderLab();
      const nx = document.querySelector(`[data-lb="q"][data-k="${k}"]`);
      if (nx) { nx.focus(); try { nx.setSelectionRange(pos, pos); } catch (_) { } }
      return;
    }
    if (e.target.id === 'lb_lq') {
      libQ = e.target.value; const pos = e.target.selectionStart; renderLab();
      const nx = document.getElementById('lb_lq');
      if (nx) { nx.focus(); try { nx.setSelectionRange(pos, pos); } catch (_) { } }
    }
  });
  document.addEventListener('click', e => {
    const st = e.target.closest('.lb-stars');
    if (!st) return;
    const b = e.target.closest('button'); if (!b) return;
    const v = Number(b.dataset.v), d = Number(st.dataset.dim);
    const dims = ['审题立意', '结构分论点', '说理论证', '语言表达', '字数规范'];
    // 找到当前题目 id
    const box = document.getElementById('lb_result');
    const recId = LAB.CUR;
    if (!recId) return;
    S.rubric[recId] = S.rubric[recId] || {};
    S.rubric[recId][dims[d]] = v; saveS();
    $$('button', st).forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= v));
    toast('已记录自评');
  });
  // 浮动条关闭（练习室 / 真题作答共用）
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-float="close"]')) return;
    const f = document.getElementById('kk-float');
    if (f && f.dataset.ctx === 'lab') { LAB.FLOAT_OFF = true; f.hidden = true; f.innerHTML = ''; f.dataset.ctx = ''; }
  });

  document.addEventListener('change', e => {
    if (e.target.id !== 'lb_import') return;
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!data || !data.rec) throw new Error('bad');
        S = Object.assign(JSON.parse(JSON.stringify(DEF)), data); saveS(); renderLab(); toast('导入成功');
      } catch (err) { toast('导入失败：文件格式不正确'); }
    };
    rd.readAsText(file);
  });

  /* ============================================================
     嵌入工作台：导航、视图切换、搜索、快捷键
     ============================================================ */
  const searchExtra = q => {
    const d = raw(); if (!d || !q) return [];
    const out = [];
    const hit = s => String(s || '').includes(q);
    d.summary.forEach(x => {
      if (out.length < 4 && hit(x.title + x.stem + x.source)) {
        out.push({ view: 'lab', m: 'sum', id: x.id, type: 'lab', kind: '小题', title: x.title || x.stem, sub: [x.source, x.type].filter(Boolean).join(' · ') });
      }
    });
    d.essay.forEach(x => {
      if (out.length < 8 && hit(x.theme + x.stem + x.source)) {
        out.push({ view: 'lab', m: 'essay', id: x.id, type: 'lab', kind: '大作文', title: x.theme || x.source, sub: x.source || '' });
      }
    });
    d.drill.forEach(x => {
      if (out.length < 10 && hit(x.theme + x.stem + x.skeleton)) {
        out.push({ view: 'lab', m: 'drill', id: x.id, type: 'lab', kind: '训练', title: x.theme, sub: x.skeleton || '' });
      }
    });
    d.quotes.forEach(x => {
      if (out.length < 12 && hit(x.t + x.tag)) {
        out.push({ view: 'lab', m: 'lib', id: 'q', type: 'lab', kind: '金句', title: x.t, sub: '#' + x.tag });
      }
    });
    d.cases.forEach(x => {
      if (out.length < 14 && hit(x.n + x.tag + x.y + x.use)) {
        out.push({ view: 'lab', m: 'lib', id: 'c', type: 'lab', kind: '案例', title: x.n, sub: x.tag + ' · ' + x.use });
      }
    });
    return out;
  };

  function installSync() {
    // 切到练习室时，把顶栏标题同步成本模块的标题
    if (window.__LAB_PATCH__) return;
    window.__LAB_PATCH__ = true;
    const orig = window.openView;
    if (typeof orig !== 'function') return;
    window.openView = function (view) {
      orig.apply(this, arguments);
      if (view === 'lab' && window.SH_LABHOOK) window.SH_LABHOOK.render();
    };
  }

  window.addEventListener('resize', () => { if (typeof syncLabFloat === 'function') syncLabFloat(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { if (typeof syncLabFloat === 'function') syncLabFloat(); }, 260));

  window.SH_LABHOOK = {
    init: () => { build(); renderLab(); },
    render: () => { renderLab(); },
    openItem: (m, id) => openItem(m, id),
    search: searchExtra,
    setTab: t => { TAB = t; renderLab(); },
    ready: true
  };
  installSync();
})();
