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

  /* 把标注指令压平成“每段一个颜色数组”，后续操作都基于最终颜色判断 */
  function colorOf(ops, m, p, len) {
    const col = new Array(len);
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.m !== m || op.p !== p) continue;
      const a = Math.max(0, op.s), b = Math.min(op.e, len);
      for (let k = a; k < b; k++) col[k] = (op.c === 'x' ? null : op.c);
    }
    return col;
  }

  /* 统计真正可见的标注块数（同一句被反复改色只算 1 处，擦掉不算） */
  function countOps(ops, m) {
    if (!ops || !ops.length) return 0;
    const groups = {};
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (m != null && op.m !== m) continue;
      const k = op.m + '#' + op.p;
      const g = groups[k] || (groups[k] = { len: 0, list: [] });
      g.len = Math.max(g.len, op.e);
      g.list.push(op);
    }
    let total = 0;
    for (const k in groups) {
      const g = groups[k];
      const col = new Array(g.len);
      for (let i = 0; i < g.list.length; i++) {
        const op = g.list[i];
        for (let j = Math.max(0, op.s); j < Math.min(op.e, g.len); j++) col[j] = (op.c === 'x' ? null : op.c);
      }
      let prev = null;
      for (let i = 0; i < g.len; i++) {
        const c = col[i] || null;
        if (c && c !== prev) total++;
        prev = c;
      }
    }
    return total;
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
      + '" data-brush="' + b.k + '" aria-label="' + b.name
      + '" aria-pressed="' + (b.k === (active || 'y')) + '">'
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
      if (!st.ann) { if (st.countEl) st.countEl.textContent = '标注 0 处'; return 0; }
      const n = countOps(st.ann.ops, matIdx());
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
      const mNow = matIdx();
      const mat = list[mNow];
      const para = mat && mat.p ? mat.p[+p] : null;
      if (para == null) return;
      const len = String(para).length;
      s = Math.max(0, Math.min(+s, len));
      e = Math.max(s, Math.min(+e, len));
      if (e - s < 1) return;
      const ann = load();
      if (!ann.ops) ann.ops = [];
      const col = colorOf(ann.ops, mNow, +p, len);
      let same = true, c0 = col[s] || null;
      for (let i = s; i < e; i++) { if ((col[i] || null) !== c0) { same = false; break; } }
      let next = forceColor || st.brush;
      if (next === 'x') {
        let any = false;
        for (let i = s; i < e; i++) { if (col[i]) { any = true; break; } }
        if (!any) return;           // 擦在空白处不做任何事，避免误伤
        next = null;                // 区间里不论几种颜色，一并擦掉
      } else if (same && c0 === next) {
        next = null;                // 同色再点一下 = 取消
      }
      for (let i = s; i < e; i++) col[i] = next;

      /* 把本段熔成“最终颜色块”，避免指令越堆越多、计数重复、存储膨胀 */
      const keep = [];
      for (let i = 0; i < ann.ops.length; i++) {
        const op = ann.ops[i];
        if (op.m === mNow && op.p === +p) continue;
        keep.push(op);
      }
      let i = 0;
      while (i < len) {
        const c = col[i];
        if (!c) { i++; continue; }
        let j = i + 1;
        while (j < len && col[j] === c) j++;
        keep.push({ m: mNow, p: +p, s: i, e: j, c: c });
        i = j;
      }
      ann.ops = keep;
      save(); render();
      return next || 'x';
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
  /* ============================================================
     标准作文方格纸
     核心：输入交给浏览器原生的可编辑输入框（textarea），方格只负责显示
     —— 这样拼音组字、语音、手写、粘贴、撤销全部由浏览器处理，
        绝不会出现“只进去字母”的情况
     ============================================================ */
  function Grid(cfg) {
    const host = typeof cfg.el === 'string' ? document.querySelector(cfg.el) : cfg.el;
    if (!host) return null;
    const st = {
      host: host,
      limit: cfg.limit || 0,
      indent: cfg.indent == null ? 2 : cfg.indent,
      perRow: cfg.perRow || 20,
      rows: cfg.rows || 6,
      onChange: cfg.onChange || null,
      readOnly: !!cfg.readOnly,
      cursor: 0,
      value: String(cfg.value == null ? '' : cfg.value),
      focused: false,
      composing: false
    };
    host.classList.add('kk-grid-host');
    host.innerHTML =
      '<div class="kk-grid-inner" role="textbox" aria-multiline="true">' +
      '<div class="kk-grid-rows" aria-hidden="true"></div>' +
      '<textarea class="kk-input" aria-label="方格作文纸作答区" spellcheck="false" ' +
      'autocapitalize="off" autocomplete="off" autocorrect="off" enterkeyhint="enter"></textarea>' +
      '</div>';
    const inner = host.querySelector('.kk-grid-inner');
    const rowsEl = host.querySelector('.kk-grid-rows');
    const ta = host.querySelector('.kk-input');
    /* 关键：把外部传入的已存作答真正写进输入框（否则重新打开就是空白，且会把存档覆盖成空） */
    ta.value = st.value;
    ta.readOnly = st.readOnly;
    /* 输入法组字时的悬浮提示：原生输入框文字是透明的，不提示就看不到拼音/候选 */
    const imeBox = document.createElement('div');
    imeBox.className = 'kk-ime';
    imeBox.hidden = true;
    inner.appendChild(imeBox);

    const countChars = v => String(v || '').replace(/[\s\u3000]/g, '').length;
    const charsOf = v => Array.from(String(v == null ? '' : v));
    const isSpace = ch => /[\s\u3000]/.test(ch);

    /* ---------- 文本折叠：去掉 glyph 顶到格外的重音符号 ---------- */
    const fold = v => String(v || '').replace(/([\u0300-\u036f]+)/g, '');

    /* ---------- 布局：把文本排成 cols 宽的行（首行缩进），每格带文本下标 ---------- */
    function layout(txt, cols) {
      const lines = String(txt).split('\n');
      const cells = [];              // 线性格子流：{ch, idx, over} | {nl:true} | {blank:true}
      let base = 0, vis = 0;         // vis = 计入字数的字符数（空格/换行不计，与“字数”统计一致）
      lines.forEach((line, li) => {
        const arr = charsOf(line);
        // 每段首行都缩进两格（含回车后的新段落），与考场答题纸一致
        if (st.indent) {
          for (let k = 0; k < st.indent; k++) cells.push({ blank: true, indent: true });
        }
        arr.forEach((ch, ci) => {
          const idx = base + ci;
          const counted = !isSpace(ch);
          cells.push({ ch: ch, idx: idx, over: st.limit ? (counted && vis >= st.limit) : false });
          if (counted) vis++;
        });
        if (li < lines.length - 1) cells.push({ nl: true, idx: base + arr.length });
        base += arr.length + 1;
      });
      cells.push({ end: true, idx: String(txt).length, vis: vis });
      st.visLength = vis;

      const rows = [];
      let cur = [];
      const flush = () => { while (cur.length < cols) cur.push({ blank: true }); rows.push(cur); cur = []; };
      cells.forEach(c => {
        if (c.ch != null) {
          if (cur.length >= cols) flush();
          cur.push(c);
        } else if (c.blank) {
          if (cur.length >= cols) flush();
          cur.push(c);
        } else {
          flush();               // 换行 / 文末：结束本行
        }
      });
      if (cur.length) flush();
      while (rows.length < st.rows) {
        const r = [];
        for (let k = 0; k < cols; k++) r.push({ blank: true });
        rows.push(r);
      }
      return rows;
    }

    /* 文本下标 → 格子 (行, 列)；落在换行/文末时给“下一个落笔位”，不会跳回上一行 */
    function posOfIndex(idx) {
      const rows = st.model || [];
      let last = null;
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const g = rows[r][c];
          if (g.ch == null) continue;
          if (g.idx === idx) return { row: r, col: c };
          if (g.idx < idx) { last = { row: r, col: c }; }
          else if (last && g.idx > idx) { /* 目标落在两字之间：用上一个字之后的位置 */ }
        }
      }
      if (last) {
        const row = rows[last.row] || [];
        if (last.col + 1 < row.length) return { row: last.row, col: last.col + 1 };
        if (last.row + 1 < rows.length) {
          const nr = rows[last.row + 1];
          let c = 0;
          while (c < nr.length && nr[c].indent) c++;   // 跳到缩进之后
          return { row: last.row + 1, col: c };
        }
        return last;
      }
      // 空答案：光标落在首行缩进之后
      const r0 = rows[0] || [];
      let c0 = 0;
      while (c0 < r0.length && r0[c0].indent) c0++;
      return { row: 0, col: Math.max(0, Math.min(c0, r0.length - 1)) };
    }

    /* 按可用宽度定列数与格宽：整行铺满且绝不横向溢出 */
    function metrics(w) {
      const maxCols = st.perRow || 20;
      const minCell = w < 420 ? 15 : 17;             // 手机允许更小的格，保证排得下
      let cols = Math.floor((w - 2) / (minCell + 1));  // 每格含 1px 边框
      cols = Math.max(5, Math.min(maxCols, cols));
      let cell = Math.floor((w - 2) / cols) - 1;
      cell = Math.max(13, Math.min(28, cell));
      return { cols: cols, cell: cell };
    }

    function render() {
      let w = inner.clientWidth || host.clientWidth || 0;
      if (w < 120) w = Math.min(960, (window.innerWidth || 960) - 60);
      if (w < 120) w = 600;
      const mm = metrics(w);
      const cell = mm.cell;
      st.cols = mm.cols;
      st.cell = cell;
      inner.style.setProperty('--kk-cell', cell + 'px');
      const rows = st.model = layout(ta.value, st.cols);
      let html = '';
      for (let r = 0; r < rows.length; r++) {
        html += '<div class="kk-row">';
        for (let c = 0; c < rows[r].length; c++) {
          const g = rows[r][c];
          const cls = 'kk-cell'
            + (g.over ? ' over' : '')
            + (g.ch != null ? '' : ' blank');
          html += '<span class="' + cls + '" data-r="' + r + '" data-c="' + c + '"'
            + (g.idx != null ? ' data-i="' + g.idx + '"' : '') + '>'
            + (g.ch != null ? esc(g.ch) : '') + '</span>';
        }
        html += '</div>';
      }
      rowsEl.innerHTML = html;
      st.value = ta.value;
      markCursor();
      if (st.onChange) st.onChange({ length: countChars(ta.value), value: ta.value, limit: st.limit });
      try {
        document.dispatchEvent(new CustomEvent('kk:gridchange', { detail: { id: host.id, length: countChars(ta.value), value: ta.value } }));
      } catch (e) { }
    }

    /* 光标格 + 选中格 */
    function markCursor() {
      const olds = rowsEl.querySelectorAll('.kk-cell.cur,.kk-cell.sel');
      for (let i = 0; i < olds.length; i++) olds[i].classList.remove('cur', 'sel');
      const n = ta.value.length;
      let s = ta.selectionStart, e = ta.selectionEnd;
      if (s == null) { s = e = st.cursor; }
      if (!st.focused) { s = e = Math.min(st.cursor, n); }
      // 选中范围
      if (e > s) {
        const cellsAll = rowsEl.querySelectorAll('.kk-cell[data-i]');
        for (let i = 0; i < cellsAll.length; i++) {
          const ci = +cellsAll[i].getAttribute('data-i');
          if (ci >= s && ci < e) cellsAll[i].classList.add('sel');
        }
      }
      const p = posOfIndex(Math.min(s, n));
      const row = rowsEl.children[p.row];
      const cellEl = row && row.children[p.col];
      // 未聚焦时不显示闪烁光标，避免一打开就“假光标”停在格子上
      if (cellEl && st.focused) {
        cellEl.classList.add('cur');
        const top = cellEl.offsetTop - host.clientHeight / 2;
        if (top > host.scrollTop + 4 || top < host.scrollTop - 4) host.scrollTop = Math.max(0, top);
        positionIme(cellEl);
      }
      st.cursor = s;
    }

    /* 组字提示框跟随光标格 */
    function positionIme(cellEl) {
      if (!imeBox || imeBox.hidden || !cellEl) return;
      const left = Math.max(0, cellEl.offsetLeft - 6);
      const top = Math.max(0, cellEl.offsetTop - 30);
      imeBox.style.left = left + 'px';
      imeBox.style.top = top + 'px';
    }
    function showIme(text) {
      if (!imeBox) return;
      const t = String(text || '');
      if (!t) { imeBox.hidden = true; imeBox.textContent = ''; return; }
      imeBox.hidden = false;
      imeBox.textContent = t;
      const p = posOfIndex(Math.min(ta.selectionStart == null ? st.cursor : ta.selectionStart, ta.value.length));
      const row = rowsEl.children[p.row];
      positionIme(row && row.children[p.col]);
    }
    function emitInput() {
      try {
        document.dispatchEvent(new CustomEvent('kk:gridinput', {
          detail: { id: host.id, length: countChars(ta.value), value: ta.value, limit: st.limit }
        }));
      } catch (e) { }
    }

    function placeCaret(idx) {
      const n = String(ta.value).length;
      const pos = Math.max(0, Math.min(idx, n));
      try { ta.setSelectionRange(pos, pos); } catch (e) { }
      st.cursor = pos;
      markCursor();
    }

    /* ---------- 原生输入框事件（输入法 / 语音 / 手写全部原生处理） ---------- */
    ta.addEventListener('input', e => {
      if (st.composing || (e && e.isComposing)) {
        if (st.onChange) st.onChange({ length: countChars(ta.value), value: ta.value, limit: st.limit });
        return;
      }
      render();
      emitInput();
    });
    ta.addEventListener('compositionstart', () => { st.composing = true; showIme(''); });
    ta.addEventListener('compositionupdate', e => { showIme(e.data || ''); });
    ta.addEventListener('compositionend', () => {
      st.composing = false; showIme('');
      render();
      emitInput();
    });
    ta.addEventListener('paste', () => { setTimeout(() => { render(); emitInput(); }, 0); });
    ta.addEventListener('keyup', () => { if (!st.composing) markCursor(); });
    ta.addEventListener('click', () => markCursor());
    ta.addEventListener('select', () => markCursor());
    ta.addEventListener('focus', () => { st.focused = true; host.classList.add('editing'); markCursor(); });
    ta.addEventListener('blur', () => {
      st.focused = false; host.classList.remove('editing');
      markCursor();
    });
    ta.addEventListener('keydown', e => {
      if (st.readOnly) { e.preventDefault(); return; }
      if (e.isComposing || st.composing) return;      // 输入法组字中不拦截
      if (e.key === 'Tab') { e.preventDefault(); placeCaret((ta.selectionStart || 0) + 1); }
    });

    /* ---------- 点格定位 / 拖选（textarea 只做输入，不接管指针） ---------- */
    function idxAt(target) {
      const cellEl = target && target.closest ? target.closest('.kk-cell') : null;
      if (!cellEl || !host.contains(cellEl)) return null;
      const i = cellEl.getAttribute('data-i');
      if (i !== null && i !== '') return +i;
      // 空格子：取该行最后一个字符之后；整行都空说明点在正文下方，落笔到文末
      let best = null;
      const rowEl = cellEl.parentElement;
      const kids = rowEl ? rowEl.children : [];
      for (let k = 0; k < kids.length; k++) {
        const v = kids[k].getAttribute('data-i');
        if (v !== null && v !== '') best = +v + 1;
      }
      if (best == null) return ta.value.length;
      return Math.min(best, ta.value.length);
    }
    function cellAtPoint(x, y) {
      const el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
      return el && el.closest ? el.closest('.kk-cell') : null;
    }
    let anchor = null, dragging = false;

    function startAt(target) {
      const i = idxAt(target);
      if (i == null) return false;
      if (document.activeElement !== ta) { try { ta.focus({ preventScroll: true }); } catch (e) { try { ta.focus(); } catch (e2) { } } }
      anchor = i; dragging = false;
      placeCaret(i);
      return true;
    }
    function moveTo(x, y) {
      if (anchor == null) return;
      const cellEl = cellAtPoint(x, y);
      const i = cellEl ? idxAt(cellEl) : null;
      if (i == null) return;
      if (i !== anchor) dragging = true;
      try { ta.setSelectionRange(Math.min(anchor, i), Math.max(anchor, i)); } catch (e) { }
      markCursor();
    }
    function endDrag() { anchor = null; dragging = false; }

    host.addEventListener('pointerdown', e => {
      if (e.target.closest('.kk-input')) return;
      const i = idxAt(e.target);
      if (i == null) {
        // 点在纸上空白处：光标落到文末，直接继续写
        if (document.activeElement !== ta) { try { ta.focus({ preventScroll: true }); } catch (err) { try { ta.focus(); } catch (e2) { } } }
        anchor = null; placeCaret(ta.value.length);
      } else {
        anchor = i;
        startAt(e.target);
      }
      e.preventDefault();
    }, { passive: false });
    host.addEventListener('pointermove', e => {
      if (anchor == null) return;
      if (e.buttons === 0 && e.pointerType === 'mouse') { endDrag(); return; }
      moveTo(e.clientX, e.clientY);
    });
    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);
    /* 触屏（无 PointerEvent 的老浏览器） */
    host.addEventListener('touchstart', e => {
      if (window.PointerEvent) return;
      if (e.target.closest('.kk-input')) return;
      startAt(e.target);
    }, { passive: true });
    host.addEventListener('touchmove', e => {
      if (window.PointerEvent || anchor == null) return;
      const t = e.touches[0];
      if (t) moveTo(t.clientX, t.clientY);
    }, { passive: true });
    host.addEventListener('touchend', endDrag);

    /* 尺寸变化后重排 */
    if (window.ResizeObserver) {
      let t = null;
      new ResizeObserver(() => { clearTimeout(t); t = setTimeout(render, 120); }).observe(host);
    } else {
      window.addEventListener('resize', () => { clearTimeout(st._rt); st._rt = setTimeout(render, 160); });
    }

    const api = {
      el: host,
      render: render,
      setValue: (v, opts) => {
        ta.value = String(v == null ? '' : v);
        st.cursor = ta.value.length;
        render();
        if (!opts || opts.scroll !== false) placeCaret(st.cursor);
      },
      getValue: () => ta.value,
      setLimit: n => { st.limit = n || 0; render(); },
      setReadOnly: v => { st.readOnly = !!v; ta.readOnly = !!v; },
      focus: () => { try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } },
      blur: () => ta.blur(),
      length: () => countChars(ta.value),
      visibleLength: () => (st.visLength != null ? st.visLength : countChars(ta.value)),
      over: () => !!(st.limit && (st.visLength || 0) > st.limit),
      cursor: () => (ta.selectionStart == null ? st.cursor : ta.selectionStart),
      el_input: ta
    };
    setTimeout(render, 0);
    return api;
  }

  window.KL = {
    esc: esc,
    splitSent: splitSent,
    renderParas: renderParas,
    brushBarHTML: brushBarHTML,
    annBarHTML: annBarHTML,
    NAME: NAME,
    colorOf: colorOf,
    countOps: countOps,
    Annotator: Annotator,
    Grid: Grid
  };
})();
