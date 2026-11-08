/* ============================================================
   KL · 公用画笔标注引擎 + 标准作文方格纸
   被「真题作答」与「申论练习室」共用，保证两处画笔逻辑、显示一致
   - 依赖：window.__LS（本工作台的本地存储封装）
   - 兼容：iOS Safari 11+ / Android WebView 66+（无正则后行断言等新语法）
   ============================================================ */
(function () {
  'use strict';
  if (window.KL) return;

  /* 本地存储：优先用工作台的封装；在 file:// 等受限环境下降级为内存，不抛错 */
  const MEM = {};
  function ls() {
    const w = window.__LS || window.localStorage;
    if (w && typeof w.getItem === 'function') return w;
    return {
      getItem: k => (k in MEM ? MEM[k] : null),
      setItem: (k, v) => { MEM[k] = String(v); },
      removeItem: k => { delete MEM[k]; }
    };
  }
  const BRUSH = [
    { k: 'y', name: '黄色', cls: 'by' },
    { k: 'g', name: '绿色', cls: 'bg' },
    { k: 'b', name: '蓝色', cls: 'bb' },
    { k: 'o', name: '橙色', cls: 'bo' },
    { k: 'x', name: '橡皮', cls: 'bx' }
  ];
  const NAME = { y: '黄', g: '绿', b: '蓝', o: '橙', x: '擦' };

  /* 中文断点：用码点判断，兼容不支持正则后行断言的旧 Safari */
  const isStop = ch => '。！？；\n'.indexOf(ch) >= 0;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hasSel = () => !!(window.getSelection && window.getSelection());
  const clearSel = () => { const s = hasSel() ? window.getSelection() : null; if (s && s.removeAllRanges) s.removeAllRanges(); };

  /* 中文断句：按。！？；等收尾标点切句，尾随引号/括号归到前一句 */
  function splitSent(t) {
    const out = []; let s = 0;
    for (let i = 0; i < t.length; i++) {
      if ('。！？；'.indexOf(t[i]) >= 0) {
        let j = i + 1;
        while (j < t.length && '”』」）)]'.indexOf(t[j]) >= 0) j++;
        out.push({ s: s, e: j });
        i = j - 1; s = j;
      }
    }
    if (s < t.length) out.push({ s: s, e: t.length });
    return out;
  }

  /* 把 [s,e) 区间按颜色合并成 mark，保证相邻同色不重复包一层 */
  function paintRange(para, s, e, col) {
    let html = '', i = s;
    while (i < e) {
      const c = col[i];
      let j = i + 1;
      while (j < e && col[j] === c) j++;
      const txt = esc(para.slice(i, j));
      html += (c && c !== 'x') ? '<mark class="hy hl' + c + '">' + txt + '</mark>' : txt;
      i = j;
    }
    return html;
  }

  /* 分组段落渲染：把段落包成 .sn（句）与 .kk-para（段），并带上原文偏移 */
  function renderParas(m, paras, ann, opts) {
    opts = opts || {};
    const ops = (ann && ann.ops) || [];
    const n = paras.length;
    let html = '';
    for (let pi = 0; pi < n; pi++) {
      const para = String(paras[pi] == null ? '' : paras[pi]);
      const len = para.length;
      const col = new Array(len);
      for (let oi = 0; oi < ops.length; oi++) {
        const op = ops[oi];
        if (op.m !== m || op.p !== pi) continue;
        const a = Math.max(0, op.s), b = Math.min(op.e, len);
        for (let i = a; i < b; i++) col[i] = op.c;
      }
      const sents = splitSent(para);
      html += '<p class="kk-para" data-p="' + pi + '">';
      for (let si = 0; si < sents.length; si++) {
        const sn = sents[si];
        html += '<span class="sn" data-p="' + pi + '" data-s="' + sn.s + '" data-e="' + sn.e + '">'
          + paintRange(para, sn.s, sn.e, col) + '</span>';
      }
      html += '</p>';
    }
    return html;
  }

  /* 选区 → {p,o}：直接以段落的 data-p 与句子的 data-s 为锚点，兼容各浏览器 */
  function anchorFromNode(node, off) {
    let el = node && node.nodeType === 3 ? node.parentElement : node;
    if (!el || !el.closest) return null;
    const span = el.closest('.sn');
    if (!span) return null;
    let base = 0, found = node.nodeType !== 3;
    const kids = span.childNodes;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (k === node) { found = true; break; }
      base += (k.textContent || '').length;
    }
    if (!found) return null;
    return { p: +span.dataset.p, o: (+span.dataset.s || 0) + base + (off || 0) };
  }

  /* 点击段落时找“点到了第几个字符”，用于把整句操作定位到真实字符区间 */
  function clickPoint(range, node, off) {
    const span = (node && node.nodeType === 3 ? node.parentElement : node);
    const s = span && span.closest ? span.closest('.sn') : null;
    if (!s) return null;
    return { el: s, p: +s.dataset.p, o: (+s.dataset.s || 0) + (off || 0) };
  }

  /* 笔刷条 HTML（做题处、练习室共用一套） */
  function brushBarHTML(active) {
    return BRUSH.map(b => '<button class="brush ' + b.cls + (b.k === (active || 'y') ? ' active' : '')
      + '" data-brush="' + b.k + '" title="' + b.name + (b.k === 'x' ? '：点击或划选清除标注' : '笔：点击整句标注，划选精确标注')
      + '" aria-label="' + b.name + '" aria-pressed="' + (b.k === (active || 'y')) + '">'
      + (b.k === 'x' ? '擦' : NAME[b.k]) + '</button>').join('');
  }

  /* 悬浮小工具条：显示当前笔、已标注数、撤销/清空（移动端常驻在材料底部） */
  function annBarHTML(brush) {
    return '<span class="kk-ann-now"><i class="kk-dot ' + (brush || 'y') + '"></i>当前：' + (NAME[brush] || '黄') + '笔</span>'
      + '<span class="kk-ann-n tip" data-tip="点击整句即可标注；长按拖动或划选可精确到字；选中「擦」再点=清除">标注 <b class="kk-ann-num">0</b> 处</span>';
  }

  /* ---------- 标注状态控制器 ---------- */
  function Annotator(cfg) {
    const el = typeof cfg.el === 'string' ? document.querySelector(cfg.el) : cfg.el;
    const st = {
      el: el,
      ns: cfg.namespace || 'kk',
      brush: cfg.brush || 'y',
      getMats: cfg.getMats,          // () => [{p:[...]}, ...]
      matIdx: cfg.matIdx || 0,
      key: cfg.key || function (m) { return 'kk_ann_' + m; },
      countEl: cfg.countEl ? (typeof cfg.countEl === 'string' ? document.querySelector(cfg.countEl) : cfg.countEl) : null,
      onCount: cfg.onCount || null,
      onAfter: cfg.onAfter || null,
      onBrush: cfg.onBrush || null,
      ann: null,
      curMat: -1
    };

    function load(m) {
      if (m == null) m = matIdx();
      if (st.curMat === m && st.ann) return st.ann;
      st.curMat = m;
      try { st.ann = JSON.parse(ls().getItem(st.key(m)) || '{"ops":[]}'); } catch (e) { st.ann = { ops: [] }; }
      if (!st.ann.ops) st.ann.ops = [];
      return st.ann;
    }
    function matIdx() { return typeof st.matIdx === 'function' ? st.matIdx() : st.matIdx; }
    function save() { try { ls().setItem(st.key(st.curMat), JSON.stringify(st.ann)); } catch (e) { } }
    function mats() { const l = st.getMats(); return l || []; }
    function resetCache() { st.ann = null; st.curMat = -1; }

    function count() {
      if (!st.ann) return 0;
      let n = 0;
      for (let i = 0; i < st.ann.ops.length; i++) if (st.ann.ops[i].c !== 'x') n++;
      if (st.countEl) st.countEl.textContent = '标注 ' + n + ' 处';
      const bump = st.el ? st.el.closest('.kk-wrap') : null;
      if (bump) {
        const num = bump.querySelector('.kk-ann-num');
        if (num) num.textContent = n;
        const dot = bump.querySelector('.kk-ann-now');
        if (dot) dot.innerHTML = '<i class="kk-dot ' + st.brush + '"></i>当前：' + (NAME[st.brush] || '黄') + '笔';
      }
      return n;
    }

    function render() {
      if (!st.el) return;
      const list = mats();
      const m = matIdx();
      const mat = list[m];
      const paras = mat && mat.p ? mat.p : (mat && mat.paras) || [];
      load(m);
      const head = cfg.headHTML ? cfg.headHTML(m, list) : '';
      st.el.innerHTML = head + renderParas(m, paras, st.ann);
      count();
      if (st.onAfter) st.onAfter(m);
    }

    function apply(p, s, e, forceColor) {
      const list = mats();
      const mat = list[matIdx()];
      const para = mat && mat.p ? mat.p[+p] : null;
      if (para == null) return;
      const len = String(para).length;
      s = Math.max(0, Math.min(+s, len));
      e = Math.max(s, Math.min(+e, len));
      if (e - s < 1) return;
      const ann = load();
      const col = new Array(len);
      for (let i = 0; i < ann.ops.length; i++) {
        const op = ann.ops[i];
        if (op.p !== +p) continue;
        for (let i2 = Math.max(0, op.s); i2 < Math.min(op.e, len); i2++) col[i2] = op.c;
      }
      let same = true, c0 = col[s] && col[s] !== 'x' ? col[s] : null;
      for (let i = s; i < e; i++) { const c = col[i] && col[i] !== 'x' ? col[i] : null; if (c !== c0) { same = false; break; } }
      let next = forceColor || st.brush;
      if (next === 'x') {
        if (!same || !c0) return;   // 擦在空白处不做任何事，避免误伤
        next = 'x';
      } else if (same && c0 === next) {
        next = 'x';                 // 同色再点一下 = 取消
      }
      ann.ops.push({ m: matIdx(), p: +p, s: s, e: e, c: next });
      save(); render();
      return next;
    }

    function clearAll() {
      const list = mats();
      const m = matIdx();
      if (!list[m]) return 0;
      load(m);
      const removed = st.ann.ops.filter(o => true);
      if (!removed.length) return 0;
      st.ann.ops = [];
      save(); render();
      return removed.length;
    }

    function setBrush(b) {
      st.brush = b;
      if (st.onBrush) st.onBrush(b);
      count();
      return b;
    }

    /* --- 事件：整句点击 --- */
    function onClick(ev) {
      if (!st.el) return;
      if (ev && ev.detail > 1) return;                 // 双击交给划选
      const t = ev.target;
      const sn = t.closest ? t.closest('.sn') : null;
      if (!sn || !st.el.contains(sn)) return;
      // 划选中的点击不要被整句覆盖
      const sel = hasSel() ? window.getSelection() : null;
      if (sel && !sel.isCollapsed && sel.rangeCount) {
        const r = sel.getRangeAt(0);
        if (sn.contains(r.startContainer) && sn.contains(r.endContainer)) return;
      }
      const p = +sn.dataset.p, s = +sn.dataset.s, e = +sn.dataset.e;
      apply(p, s, e, null);
    }

    /* --- 事件：划选精确标注（pointerup / mouseup / touchend 都试一遍，取第一次有效） --- */
    let lastSelAt = 0;
    function onUp() {
      if (!st.el) return;
      const now = Date.now();
      if (now - lastSelAt < 180) return;
      const sel = hasSel() ? window.getSelection() : null;
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      if (!st.el.contains(sel.anchorNode) || !st.el.contains(sel.focusNode)) return;
      const range = sel.getRangeAt(0);
      const a = anchorFromNode(sel.anchorNode, sel.anchorOffset);
      const f = anchorFromNode(sel.focusNode, sel.focusOffset);
      if (!a || !f || a.p !== f.p) { clearSel(); return; }
      const list = mats();
      const mat = list[matIdx()];
      const paras = mat && mat.p ? mat.p : [];
      const para = paras[a.p] || '';
      let s = Math.min(a.o, f.o), e = Math.max(a.o, f.o);
      s = Math.max(0, s); e = Math.min(e, String(para).length);
      if (e - s >= 1) { lastSelAt = now; apply(a.p, s, e, null); }
      clearSel();
    }

    if (st.el) {
      st.el.addEventListener('click', onClick);
      st.el.addEventListener('pointerup', onUp);
      if (!window.PointerEvent) {
        st.el.addEventListener('touchend', onUp, { passive: true });
        st.el.addEventListener('mouseup', onUp);
      }
    }

    return {
      el: st.el,
      render: render,
      reset: resetCache,
      setBrush: setBrush,
      getBrush: () => st.brush,
      count: count,
      apply: apply,
      clearAll: clearAll,
      load: load,
      save: save,
      setMat: m => { st.matIdx = m; resetCache(); render(); },
      ops: () => { load(); return st.ann.ops; }
    };
  }

  /* ============================================================
     标准作文方格纸
     - 每格一个字符（标点占格，与考场答题纸一致）
     - 点方格 → 光标落到该格；输入自动推进；方向键 / 退格 / 回车（换行）可用
     - 首行缩进两格；超出字数上限的格子标红
     ============================================================ */
  function Grid(cfg) {
    const host = typeof cfg.el === 'string' ? document.querySelector(cfg.el) : cfg.el;
    if (!host) return null;
    const st = {
      host: host,
      value: cfg.value || '',
      limit: cfg.limit || 0,
      indent: cfg.indent == null ? 2 : cfg.indent,
      perRow: cfg.perRow || 20,
      rows: cfg.rows || 6,          // 至少显示多少行格子
      cursor: 0,
      onChange: cfg.onChange || null,
      readOnly: !!cfg.readOnly
    };
    host.classList.add('kk-grid-host');
    host.innerHTML = '<div class="kk-grid-inner" role="textbox" aria-multiline="true" tabindex="0" aria-label="方格作文纸作答区"><div class="kk-grid-rows"></div></div>';
    const box = host;
    const inner = host.querySelector('.kk-grid-inner');
    const rowsEl = host.querySelector('.kk-grid-rows');

    const charsOf = v => Array.from(String(v == null ? '' : v));
    const countChars = s => String(s || '').replace(/[\s\u3000]/g, '').length;

    function lineBases(lines) {
      const bases = []; let b = 0;
      lines.forEach(l => { bases.push(b); b += l.length + 1; });
      return bases;
    }

    /* 计算网格：rows = [[cell,...],...]  cell = {i:绝对字符下标,ch} | {blank:true,at:点击后光标位置} */
    function build() {
      const v = String(st.value);
      const lines = v.split('\n');
      const bases = lineBases(lines);
      const cols = st.cols;
      const rows = [];
      let cur = [];
      const push = cell => { if (cur.length >= cols) { rows.push(cur); cur = []; } cur.push(cell); };
      lines.forEach((line, li) => {
        const arr = charsOf(line);
        if (li === 0) for (let k = 0; k < st.indent; k++) push({ blank: true, indent: true, at: bases[li] });
        arr.forEach((ch, ci) => push({ i: bases[li] + ci, ch: ch }));
        if (li < lines.length - 1) {
          const at = bases[li] + arr.length;          // 换行处
          while (cur.length < cols) cur.push({ blank: true, at: at });
          rows.push(cur); cur = [];
        }
      });
      const endAt = v.length;
      while (cur.length < cols) cur.push({ blank: true, at: endAt });
      rows.push(cur);
      while (rows.length < st.rows) {
        const r = [];
        for (let c = 0; c < cols; c++) r.push({ blank: true, at: endAt });
        rows.push(r);
      }
      st.rowsModel = rows;
      return rows;
    }

    function cellHTML(cell) {
      if (cell.blank) return '<span class="kk-cell blank' + (cell.indent ? ' ind' : '') + '" data-at="' + cell.at + '"></span>';
      const over = st.limit && cell.i >= st.limit;
      return '<span class="kk-cell' + (over ? ' over' : '') + '" data-i="' + cell.i + '">' + (cell.ch ? esc(cell.ch) : '') + '</span>';
    }

    function render() {
      // 隐藏容器（父级 display:none / grid 尚未布局）时按视口估算，避免 0 宽
      let w = inner.clientWidth || box.clientWidth || 0;
      if (w < 120) w = Math.min(960, (window.innerWidth || 960) - 60);
      if (w < 120) w = 600;
      const cell = w < 300 ? 21 : w < 380 ? 23 : 26;   // 小屏自动缩格子
      st.cell = cell;
      inner.style.setProperty('--kk-cell', cell + 'px');
      const size = cell + 1;
      st.cols = Math.max(10, Math.min(st.perRow, Math.floor((w - 2) / size)));
      const rows = build();
      rowsEl.innerHTML = rows.map(r => '<div class="kk-row">' + r.map(cellHTML).join('') + '</div>').join('');
      placeCursor();
      if (st.onChange) st.onChange({ length: countChars(st.value), value: st.value, limit: st.limit });
      try {
        document.dispatchEvent(new CustomEvent('kk:gridchange', { detail: { id: box.id, length: countChars(st.value), value: st.value } }));
      } catch (e) { }
    }

    function placeCursor() {
      const olds = rowsEl.querySelectorAll('.kk-cell.cur');
      for (let i = 0; i < olds.length; i++) olds[i].classList.remove('cur');
      let c = rowsEl.querySelector('.kk-cell[data-i="' + st.cursor + '"]');
      if (!c) {
        // 光标停在行尾/文末时，落在最近的空白格
        const cells = rowsEl.querySelectorAll('.kk-cell');
        for (let i = 0; i < cells.length; i++) {
          const v = cells[i].getAttribute('data-at');
          if (v !== null && +v === st.cursor) { c = cells[i]; break; }
        }
      }
      if (!c) { const all = rowsEl.querySelectorAll('.kk-cell'); if (all.length) c = all[0]; }
      if (c) c.classList.add('cur');
    }

    function scrollCursor() {
      const c = rowsEl.querySelector('.kk-cell.cur');
      if (!c) return;
      const top = c.offsetTop - box.clientHeight / 2;
      if (top > box.scrollTop + 8 || top < box.scrollTop - 8) box.scrollTop = Math.max(0, top);
    }

    function setValue(v, opts) {
      st.value = String(v == null ? '' : v);
      if (st.cursor > st.value.length) st.cursor = st.value.length;
      render();
      if (!opts || opts.scroll !== false) scrollCursor();
    }
    function getValue() { return st.value; }
    function setLimit(n) { st.limit = n || 0; render(); }

    function insert(txt) {
      if (st.readOnly) return;
      const pos = Math.max(0, Math.min(st.cursor, st.value.length));
      st.value = st.value.slice(0, pos) + txt + st.value.slice(pos);
      st.cursor = pos + txt.length;
      render(); scrollCursor();
    }
    function back() {
      if (st.readOnly || st.cursor <= 0) return;
      st.value = st.value.slice(0, st.cursor - 1) + st.value.slice(st.cursor);
      st.cursor -= 1;
      render(); scrollCursor();
    }
    function del() {
      if (st.readOnly || st.cursor >= st.value.length) return;
      st.value = st.value.slice(0, st.cursor) + st.value.slice(st.cursor + 1);
      render();
    }
    function moveCursor(idx, keep) {
      st.cursor = Math.max(0, Math.min(idx, st.value.length));
      placeCursor();
      if (!keep) scrollCursor();
    }

    /* 点到某一格：有字的格 → 光标落在该字；空格 → 落在该行末尾 */
    function onTap(ev) {
      const cell = ev.target.closest ? ev.target.closest('.kk-cell') : null;
      if (!cell || !box.contains(cell)) return false;
      const di = cell.getAttribute('data-i');
      if (di !== null && di !== '') moveCursor(+di);
      else moveCursor(+cell.getAttribute('data-at') || st.value.length);
      return true;
    }

    function onKey(e) {
      if (st.readOnly) return;
      const k = e.key;
      if (k === 'ArrowLeft') { e.preventDefault(); moveCursor(st.cursor - 1); return; }
      if (k === 'ArrowRight') { e.preventDefault(); moveCursor(st.cursor + 1); return; }
      if (k === 'Home') { e.preventDefault(); moveCursor(st.value.lastIndexOf('\n', st.cursor - 1) + 1); return; }
      if (k === 'End') {
        e.preventDefault();
        const nx = st.value.indexOf('\n', st.cursor);
        moveCursor(nx === -1 ? st.value.length : nx); return;
      }
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        const lines = st.value.split('\n');
        const bases = lineBases(lines);
        const li = st.value.slice(0, st.cursor).split('\n').length - 1;
        const col = st.cursor - bases[li];
        const nl = li + (k === 'ArrowUp' ? -1 : 1);
        if (nl < 0 || nl >= lines.length) return;
        moveCursor(bases[nl] + Math.min(col, lines[nl].length));
        return;
      }
      if (k === 'Backspace') { e.preventDefault(); back(); return; }
      if (k === 'Delete') { e.preventDefault(); del(); return; }
      if (k === 'Enter') { e.preventDefault(); insert('\n'); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k && k.length === 1) { e.preventDefault(); insert(k); }
    }

    /* 移动端唤起系统输入法（支持中文候选词） */
    let proxy = null;
    function ensureProxy() {
      if (proxy) return proxy;
      proxy = document.createElement('input');
      proxy.type = 'text';
      proxy.setAttribute('autocapitalize', 'off');
      proxy.setAttribute('autocomplete', 'off');
      proxy.setAttribute('autocorrect', 'off');
      proxy.setAttribute('spellcheck', 'false');
      proxy.className = 'kk-proxy';
      proxy.setAttribute('aria-hidden', 'true');
      proxy.tabIndex = -1;
      document.body.appendChild(proxy);
      let last = '';
      proxy.addEventListener('input', () => {
        const now = proxy.value;
        if (now.length > last.length) insert(now.slice(last.length));
        else if (now.length < last.length) for (let i = 0; i < last.length - now.length; i++) back();
        last = now;
        if (proxy.value.length > 20) { proxy.value = ''; last = ''; }
      });
      proxy.addEventListener('compositionend', () => { last = proxy.value; });
      proxy.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !proxy.value) { e.preventDefault(); back(); }
        if (e.key === 'Enter') { e.preventDefault(); proxy.value = ''; last = ''; insert('\n'); }
      });
      return proxy;
    }
    function focusProxy() {
      const p = ensureProxy();
      p.value = ''; 
      try { p.focus({ preventScroll: true }); } catch (e) { try { p.focus(); } catch (e2) { } }
      box.classList.add('editing');
    }
    function blurProxy() {
      if (proxy && document.activeElement === proxy) proxy.blur();
      box.classList.remove('editing');
    }

    box.addEventListener('pointerdown', e => {
      if (!onTap(e)) return;
      const coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
      if (coarse) { e.preventDefault(); focusProxy(); }
      else { try { inner.focus({ preventScroll: true }); } catch (er) { inner.focus(); } }
    });
    box.addEventListener('touchstart', e => {
      // iOS 上 pointerdown 若被 preventDefault 会影响，这里补一次定位
      if (window.PointerEvent) return;
      onTap(e);
    }, { passive: true });
    inner.addEventListener('keydown', onKey);
    if (window.ResizeObserver) {
      let t = null;
      new ResizeObserver(() => { clearTimeout(t); t = setTimeout(render, 120); }).observe(box);
    } else {
      window.addEventListener('resize', () => { clearTimeout(st._rt); st._rt = setTimeout(render, 160); });
    }

    // 初始化即画出格子（空纸也要可见）；延后一拍，避免 onChange 里引用尚未返回的实例
    setTimeout(render, 0);

    return {
      el: box,
      render: render,
      setValue: setValue,
      getValue: getValue,
      setLimit: setLimit,
      focus: focusProxy,
      blur: blurProxy,
      length: () => countChars(st.value),
      cursor: () => st.cursor,
      insert: insert
    };
  }

  window.KL = {
    esc: esc,
    splitSent: splitSent,
    renderParas: renderParas,
    brushBarHTML: brushBarHTML,
    annBarHTML: annBarHTML,
    NAME: NAME,
    Annotator: Annotator,
    Grid: Grid
  };
})();
