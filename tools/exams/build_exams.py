#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
真题数据重建脚本（题目 / 材料 / 作答要求）
==========================================
数据源：[Jinghe1279/SLB] → data/shenlun_zhenti/*.md（抓自 shenlunhome.com）

原来的真题打包脚本是一次性脚本，没有随仓库分发，导致数据里留下了几类结构性问题：

  · 材料分节被合并：整卷只有 1 份材料，题干里的「给定资料3」无处可指
  · 两卷合并的试卷（如「A卷+B卷+C卷」）把各卷作答要求全塞进同一份材料，
    题目按「去重后拼接」处理，题与材料、题与答案互相错位
  · 「作答要求 / 第一题：…」被误当成材料正文，混进材料里
  · 题干引用的资料号超出实际份数（如「给定资料8」但只有 7 份材料）

本脚本按「材料N / 资料N」切分材料、按「作答要求」分离题目，一卷一套题；
多卷合并的文件按卷拆成多套卷，每套只保留本卷的材料与题目。

用法：
    python3 tools/exams/build_exams.py --src /path/to/slb/data/shenlun_zhenti
    python3 tools/exams/build_exams.py --src … --report   # 打印逐卷结构

产物：exams/index.js、exams/gk.js、exams/prov1.js、exams/prov2.js
"""
import argparse, collections, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

CN = '一二三四五六七八九十'
VARIANTS = {'⻘': '青', '⺠': '民', '⻓': '长', '⻔': '门', '⻛': '风', '⻥': '鱼', '⻢': '马',
            '⻜': '飞', '⻅': '见', '⻩': '黄', '⻰': '龙', '⻐': '金', '⺟': '母',
            '⻋': '车', '⻄': '西', '⻚': '页', '⻉': '贝', '⻝': '食', '⻬': '齐',
            '⻙': '韦', '⻊': '足', '⺩': '王', '⻖': '阝', '⻆': '角', '⺮': '竹', '⺡': '氵'}


def cn2num(s):
    s = s.strip()
    if not s:
        return None
    if s.isdigit():
        return int(s)
    s = s.replace('〇', '10')
    if s == '十':
        return 10
    if '十' in s:
        a, _, b = s.partition('十')
        hi = CN.index(a) + 1 if a else 1
        lo = CN.index(b) + 1 if b else 0
        return hi * 10 + lo
    if len(s) == 1 and s in CN:
        return CN.index(s) + 1
    return None


def clean(t):
    t = (t or '')
    for k, v in VARIANTS.items():
        t = t.replace(k, v)
    t = t.replace('\r\n', '\n').replace('\r', '\n').replace('\u00a0', ' ').replace('\u3000', ' ')
    t = t.replace('&#8226;', '·').replace('&#183;', '·').replace('&nbsp;', ' ')
    t = re.sub(r'<[^>]+>', '', t)
    return t


def strip_front_matter(txt):
    """去掉 YAML 头与正文标题"""
    txt = clean(txt)
    if txt.startswith('---'):
        parts = txt.split('---', 2)
        if len(parts) >= 3:
            txt = parts[2]
    # 去掉第一行的一级标题
    lines = txt.split('\n')
    while lines and not lines[0].strip():
        lines.pop(0)
    if lines and lines[0].lstrip().startswith('#'):
        lines.pop(0)
    return '\n'.join(lines)


HEAD_RE = re.compile(r'^[ \t\u3000]*(?:材料|资料|给定材料|给定资料)[ \t\u3000]*([一二三四五六七八九十]+|\d{1,2})[ \t\u3000]*[：:、.．]?[ \t\u3000]*(.*)$')
REQ_HEAD_RE = re.compile(r'^[ \t]*(?:[Ａ-ＺA-Z][ \t]*卷[ \t]*)?'
                         r'[作答做答题试题目问题及和回答与]{1,10}[ \t]*(?:要求|说明)[ \t]*[：:]?[ \t]*$')
REQ_INLINE_RE = re.compile(r'^[ \t]*(?:[Ａ-ＺA-Z][ \t]*卷[ \t]*)?'
                           r'[作答做答题试题目问题及和回答与]{1,10}[ \t]*(?:要求|说明)[ \t]*(?:[：:][ \t]*)?(?=\S)')
Q_HEAD_SOFT_RE = re.compile(r'(?:第[ \t]*[一二三四五六七八九十\d]{1,3}[ \t]*题|题目[ \t]*[一二三四五六七八九十\d]{1,3}'
                            r'|问题[ \t]*[一二三四五六七八九十\d]{1,3}|[一二三四五六七八九十]{1,3}[ \t]*[、.．]'
                            r'|[（(][ \t]*[一二三四五六七八九十]{1,3}[ \t]*[）)]|(?:根据|请|给定|结合|假如|假设|某|阅读|为|随))')
NUM_HEAD_RE = re.compile(r'^[ \t\u3000]*(?:[Ａ-ＺA-Z][ \t\u3000]*卷[ \t\u3000]*)?'
                         r'(?:第[ \t]*([一二三四五六七八九十]+|\d{1,2})[ \t]*题'
                         r'|问题[ \t]*([一二三四五六七八九十]+|\d{1,2})'
                         r'|([一二三四五六七八九十]{1,3})[ \t]*[、.．][ \t]*)')
VOL_HEAD_RE = re.compile(r'^[ \t\u3000]*(?:[Ａ-ＺA-Z][ \t\u3000]*卷)')


def is_heading(line):
    """材料/资料 小标题：返回 (序号, 同一行的正文) """
    m = HEAD_RE.match(line)
    if not m:
        return None
    n = cn2num(m.group(1))
    if n is None:
        return None
    return n, m.group(2).strip(' \t\u3000')


REQ_SPLIT_STR = ('作答要求', '做答要求', '答题要求', '作答说明', '题目及要求', '问题及要求',
                 '题目及作答要求', '问题及作答要求', '试题及要求', '问题及作答要求', '作答题目')


def find_req_marks(txt):
    """找出所有「作答要求 / 问题及要求 / 做答要求」类标记 → [(pos, 标记长度, 卷别标签)]"""
    hits = []
    for mk in REQ_SPLIT_STR:
        for m in re.finditer(re.escape(mk), txt):
            line_start = txt.rfind('\n', 0, m.start()) + 1
            prefix = txt[line_start:m.start()].strip(' \t')
            vol = ''
            vm = re.match(r'^([Ａ-ＺA-Z])(?:[ \t]*[卷类])?$', prefix)
            if vm:
                vol = vm.group(1)
            elif prefix:
                # 标记前还压着正文：只有紧跟题号/设问词时才算标记
                after = re.sub(r'^[ \t\n]*(?:[：:]?[ \t\n]*)', '', txt[m.end():m.end() + 26])
                # 标记前压着正文时，卷别标签可能就贴在标记前（…的点赞。A卷作答要求）
                vm2 = re.search(r'([Ａ-ＺA-Z])[ \t]*[卷类]$', prefix)
                if vm2:
                    vol = vm2.group(1)
                elif not Q_HEAD_SOFT_RE.match(after):
                    continue
            hits.append((m.start(), len(mk), vol))
    hits.sort()
    out = []
    for h in hits:
        if out and h[0] - out[-1][0] < 3:
            continue
        out.append(h)
    return out


def split_materials_and_reqs(txt):
    """返回 (materials, req_text, vol_label)

    材料按「材料N / 资料N」切分（兼容小标题独占一行、与正文同行、带缩进）；
    作答要求标记既可能独占一行，也可能黏在材料末尾或题干里，统一按位置切。
    """
    marks = find_req_marks(txt)
    if not marks:
        # 兜底：文件里没有任何标记时，按第一个题号切开
        m = re.search(r'(?m)^[ \t]*(?:第[ \t]*[一二三四五六七八九十\d]{1,3}[ \t]*题'
                      r'|题目[ \t]*[一二三四五六七八九十\d]{1,3}|问题[ \t]*[一二三四五六七八九十\d]{1,3}'
                      r'|[一二三四五六七八九十]{1,3}[ \t]*[、.．])', txt)
        if not m:
            return [], '', ''
        pos = m.start()
        marks = [(pos, 0, '')]
    pos, mlen, vol = marks[0]
    body = txt[:pos]
    # 标记与「第一题」之间的残留（如同行的「A卷」）回到标记后
    req_text = txt[pos + mlen:]

    mat_starts = []
    for m in re.finditer(r'(?:(?<=^)|(?<=[ \t]))(?:材料|资料)[ \t]*([一二三四五六七八九十]+|\d{1,2})'
                         r'[ \t]*(?:[：:、.．][ \t]*)?(.*)$', body, re.M):
        n = cn2num(m.group(1))
        if n is not None and n <= 30:
            mat_starts.append((m.start(), m.end(), n, m.group(2).strip(' \t')))
    mats = []
    for k, (st, en, n, inline) in enumerate(mat_starts):
        end = mat_starts[k + 1][0] if k + 1 < len(mat_starts) else len(body)
        seg = (inline + '\n' if inline else '') + body[en:end]
        paras = [x.strip(' \t') for x in seg.split('\n')]
        paras = [x for x in paras if x]
        if paras:
            mats.append((n, paras))
    if not mats:
        # 源文件把多份材料写成一段、没有小标题时：按「材料N：」就地切开
        paras = [x.strip(' \t') for x in body.split('\n')]
        paras = [x for x in paras if x]
        split = []
        for pr in paras:
            parts = re.split(r'(?:^|(?<=[。；！？…]))[ \t]*(?:材料|资料)[ \t]*[一二三四五六七八九十\d]{1,2}[ \t]*[：:、.．]?[ \t]*', pr)
            parts = [x.strip() for x in parts if x.strip()]
            split.extend(parts if len(parts) > 1 else [pr])
        if split:
            mats = [(i + 1, [x]) for i, x in enumerate(split)]
    nums = [n for n, _ in mats]
    if nums != list(range(1, len(nums) + 1)):
        mats = [(i + 1, b) for i, (_, b) in enumerate(mats)]
    return mats, req_text, vol


SCORE_RE = re.compile(r'[（(][ \t]*(\d{1,3})[ \t]*分[ \t]*[）)]?')
REQ_LINE_RE = re.compile(r'^[ \t]*(?:要求|作答要求|注意|说明)[ \t]*[：:][ \t]*(.*)$')
WORD_RE = re.compile(r'(\d{2,4})[ \t]*[～~—\-－至到][ \t]*(\d{2,4})[ \t]*字'
                     r'|(?:不超过|不多于|不高于|少于)[ \t]*(\d{2,4})[ \t]*字'
                     r'|(\d{2,4})[ \t]*字[ \t]*(?:以内|以下|左右)?'
                     r'|(?:不少于|不低于|至少)[ \t]*(\d{2,4})[ \t]*字')


Q_MARK_RE = re.compile(r'(?:第[ \t]*([一二三四五六七八九十]+|\d{1,2})[ \t]*题'
                       r'|题目[ \t]*([一二三四五六七八九十]+|\d{1,2})'
                       r'|问题[ \t]*([一二三四五六七八九十]+|\d{1,2})'
                       r'|(?:^|(?<=[\n。；]))[ \t\u3000]*([一二三四五六七八九十]{1,3}|\d{1,2})[ \t]*[、.．][ \t]*'
                       r'|(?:^|(?<=[\n。；：]))[ \t\u3000]*[（(][ \t]*([一二三四五六七八九十]{1,3})[ \t]*[）)][ \t]*'
                       r'|(?<=[\n。；：。])[ \t\u3000]*([12])[ \t]*[.．、][ \t]*(?=[“"（(]?(?:谈谈|假如|请|根据|写|拟|指出|概括|分析|说明|结合|给定|资料|材料))[ \t]*)')
SPLIT_REQ_RE = re.compile(r'(?:^|[\n。；）)]|(?<=[）\s]))[ \t]*(?:要求|作答要求|注意)[ \t]*[：:][ \t]*')


def parse_questions(req_text):
    """把「作答要求」切成逐题块。

    源文件里题目常被黏成一整段（没有换行），所以先按「第N题 / 题目N / 问题N」
    这类明确标号插入换行，再逐行归并；「一、」这种裸标号只在行首才认。
    每题再拆出题干与「要求：…」。
    """
    txt = req_text
    # 只在「第N题：」「题目N：」「问题N：」后插入换行
    txt = re.sub(r'(第[ \t]*[一二三四五六七八九十\d]{1,3}[ \t]*题|题目[ \t]*[一二三四五六七八九十\d]{1,3}'
                 r'|问题[ \t]*[一二三四五六七八九十\d]{1,3})[ \t]*[：:]', r'\n\1：', txt)
    lines = [x.strip(' \t\u3000') for x in txt.split('\n')]
    blocks, cur = [], None
    for s in lines:
        if not s:
            continue
        if REQ_HEAD_RE.match(s) and len(s) <= 12:
            continue
        m = Q_MARK_RE.match(s)
        if m and (m.group(1) or m.group(2) or m.group(3) or m.group(5) or m.group(6) or len(s) > m.end() + 10):
            if cur:
                blocks.append(cur)
            cur = [re.sub(r'^[：:、．.\s]+', '', s[m.end():])]
        elif cur is not None:
            cur.append(s)
    if cur:
        blocks.append(cur)
    qs = []
    for b in blocks:
        text = ''.join(b).strip()
        if not text:
            continue
        sm = SPLIT_REQ_RE.search(text)
        if sm and sm.start() > 8:
            stem, reqq = text[:sm.start()].strip(), text[sm.end():].strip()
        else:
            stem, reqq = text, ''
        sc = None
        for mm in SCORE_RE.finditer(stem + ' ' + reqq):
            sc = int(mm.group(1))
        if sc is not None:
            stem = SCORE_RE.sub('', stem).strip()
            reqq = SCORE_RE.sub('', reqq).strip()
        stem = re.sub(r'[，,；;]\s*$', '', stem).strip()
        stem = re.sub(r'\s{2,}', ' ', stem)
        reqq = re.sub(r'\s{2,}', ' ', reqq).strip()
        if len(stem) < 8:
            continue
        qs.append(dict(t=stem, rq=reqq, sc=sc))
    return qs


def limits(q):
    txt = q['t'] + ' ' + q['rq']
    lo = hi = 0
    for m in WORD_RE.finditer(txt):
        if m.group(1):
            lo, hi = int(m.group(1)), int(m.group(2))
        elif m.group(3):
            hi = int(m.group(3))
        elif m.group(4):
            hi = hi or int(m.group(4))
        elif m.group(5):
            lo = int(m.group(5))
    if lo and hi and lo > hi:
        lo, hi = hi, lo
    return lo, hi


def meta_from_filename(fn):
    """从文件名解析 省份 / 年份 / 卷别"""
    base = fn[:-3]
    parts = base.split('_', 2)
    prov = parts[0]
    year = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else None
    rest = parts[2] if len(parts) > 2 else ''
    return prov, year, rest


VOL_LABEL_RE = re.compile(r'([A-Za-zＡ-Ｚ一二三四五六七八九十]{1,2})[ \t]*卷')


def detect_vols(txt):
    """多卷合并的试卷：返回 [(label, start_idx)]，按出现顺序"""
    hits = []
    for m in re.finditer(r'(?m)^[ \t\u3000]*([A-Za-zＡ-Ｚ])[ \t]*卷[ \t]*(?:作答|做答|答题)要求', txt):
        hits.append((m.group(1), m.start()))
    if not hits:
        for m in re.finditer(r'(?m)^[ \t\u3000]*([A-Za-zＡ-Ｚ])[ \t]*卷[ \t]*(?:作答|做答|答题)要求', clean(txt)):
            hits.append((m.group(1), m.start()))
    return hits


def build_one(fn, txt):
    """返回 (省份, 年份, 文件名剩余部分, [(卷别, 材料, 题目)])"""
    prov, year, rest = meta_from_filename(fn)
    txt = strip_front_matter(txt)
    vols = split_by_volume(txt)
    out = []
    for vol, seg in vols.items():
        mats, req_text, _ = split_materials_and_reqs(seg)
        raw = [q for q in parse_questions(req_text) if q['t']]
        qs = merge_subquestions(raw)
        if vol == 'A':
            import os as _os
            if _os.environ.get('DBG'):
                for x in raw: print('   RAW', repr(x['t'][:40]))
                for x in qs: print('   QS ', repr(x['t'][:40]), x.get('sub'))
        out.append((vol, mats, qs))
    return prov, year, rest, out


# ---------- 组卷 ----------
VOL_CN = {'A': 'A卷', 'B': 'B卷', 'C': 'C卷', 'D': 'D卷', 'E': 'E卷'}


def norm_vol(v):
    v = (v or '').replace('Ａ', 'A').replace('Ｂ', 'B').replace('Ｃ', 'C')
    return v


def split_by_volume(txt):
    """多卷合并的源文件拆成 {卷别: 正文}；只有一卷时返回 {'': 全文}。
    每段以「X卷作答要求」开头，材料与题目都各卷通用（浙江、江苏、深圳多为此种排版）。"""
    marks = find_req_marks(txt)
    vols = [(pos, vol) for pos, _, vol in marks if vol]
    if len(vols) < 2:
        return {'': txt}
    head = txt[:vols[0][0]]
    out = {}
    for i, (pos, vol) in enumerate(vols):
        end = vols[i + 1][0] if i + 1 < len(vols) else len(txt)
        seg = txt[pos:end]
        # 去掉下一卷的卷别标签（如「B卷」），避免混进要求
        out[norm_vol(vol)] = head + '\n' + seg
    # 合并同卷（源文件偶尔把同一卷的作答要求写两次）
    return out


SUB_RE = re.compile(r'(?:^|(?<=[\n。；）)]))[ \t]*([12])[ \t]*[.．、][ \t]*(?=[“"（(]?(?:谈谈|假如|请|根据|写|拟|指出|概括|分析|说明|结合))')


def merge_subquestions(qs):
    """「回答下列两个问题。1.…2.…」在切题时会拆成多块，这里并回一道题，小题单列"""
    out = []
    for q in qs:
        t = q['t']
        if re.search(r'回答下列(?:两个|两|以下两)?(?:个)?问题|回答下列问题|简要回答下面两题|回答下面两题|分别回答下列问题', t):
            q = dict(q)
            q['sub'] = []
            q['_need_sub'] = True
            out.append(q)
            continue
        if out and out[-1].get('_need_sub') and (re.match(r'^[12][.．、]', t) or len(out[-1]['sub']) < 2):
            prev = out[-1]
            prev['sub'].append(t)
            if q['rq']:
                prev['rq'] = (prev['rq'] + '；' + q['rq']).strip('；')
            if q['sc'] and not prev['sc']:
                prev['sc'] = q['sc']
            continue
        out.append(q)
    for q in out:
        q.pop('_need_sub', None)
        if q.get('sub'):
            q['rq'] = ('（1）' + q['sub'][0] + '（2）' + q['sub'][1]) if len(q['sub']) >= 2 else q['sub'][0]
    return out


# ---------- 组卷 ----------
VOL_CN = {'A': 'A卷', 'B': 'B卷', 'C': 'C卷', 'D': 'D卷', 'E': 'E卷'}


def norm_vol(v):
    v = (v or '').replace('Ａ', 'A').replace('Ｂ', 'B').replace('Ｃ', 'C')
    return v


def split_by_volume(txt):
    """多卷合并的源文件拆成 {卷别: 正文}；只有一卷时返回 {'': 全文}。
    每段以「X卷作答要求」开头，材料与题目都各卷通用（浙江、江苏、深圳多为此种排版）。"""
    marks = find_req_marks(txt)
    vols = [(pos, vol) for pos, _, vol in marks if vol]
    if len(vols) < 2:
        return {'': txt}
    head = txt[:vols[0][0]]
    out = {}
    for i, (pos, vol) in enumerate(vols):
        end = vols[i + 1][0] if i + 1 < len(vols) else len(txt)
        seg = txt[pos:end]
        # 去掉下一卷的卷别标签（如「B卷」），避免混进要求
        out[norm_vol(vol)] = head + '\n' + seg
    # 合并同卷（源文件偶尔把同一卷的作答要求写两次）
    return out


SUB_RE = re.compile(r'(?:^|(?<=[\n。；）)]))[ \t]*([12])[ \t]*[.．、][ \t]*(?=[“"（(]?(?:谈谈|假如|请|根据|写|拟|指出|概括|分析|说明|结合))')


# ---------- 组卷 ----------
TITLE_DROP = re.compile(r'_?(?:含参考答案)_?|_含参考答案_|网友回忆版|网友提供版|仅供参考|参考题本|参考试卷|_')


def short_vol(rest):
    """从文件名剩余部分提取卷别标签，如『2025年安徽公务员考试《申论》试题（A卷）』→ A"""
    m = re.search(r'[（(]([A-Ｚ]|一|二|三|四|县乡|乡镇|县级|省市|市级|区级|公安|执法|行政执法|'
                  r'省直|公检法|甲|乙|丙|A类|B类|C类|一卷|二卷|三卷|乡镇卷|县乡卷|省市卷|县级卷)[）)]', rest)
    if not m:
        return ''
    v = m.group(1)
    v = v.replace('Ａ', 'A').replace('类', '')
    return v


def title_of(prov, year, rest):
    # 去掉「_含参考答案_」等后缀，保留正式标题
    t = rest
    t = re.sub(r'_?含参考答案_?', '', t)
    t = re.sub(r'[（(]网友回忆版[）)]|[（(]网友提供版[）)]', '', t)
    t = t.replace('_', '')
    return t


def _ngrams(t, n=2):
    t = re.sub(r'[\s，。；：、！？“”‘’（）《》【】〈〉·—…,.:;!?()\[\]"\'-—－_/\\|*#`]', '', t)
    return set(t[i:i + n] for i in range(len(t) - n + 1))


def overlap(old_text, new_text):
    """旧材料有多少能在新材料里找到（二元组覆盖率）"""
    A, B = _ngrams(old_text), _ngrams(new_text)
    if not A:
        return 0.0
    return len(A & B) / float(len(A))


def pick_file(old, cands):
    """按材料正文重合度选源文件：旧数据材料基本是对的，只是被合并了，用它当指纹最准"""
    probe = ''.join(''.join(m.get('p') or []) for m in (old.get('m') or [])) if old else ''
    best, bs = None, 0.0
    for r in cands:
        mtext = ''.join(''.join(p) for _, p in r['mats'])
        score = overlap(probe, mtext) if probe else 0.0
        if score > bs:
            best, bs = r, score
    return best, bs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(ROOT, 'tools', 'exams', 'src'))
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()
    if not os.path.isdir(args.src):
        sys.exit('找不到源目录：%s\n请先 git clone https://github.com/Jinghe1279/SLB，'
                 '再用 --src 指到 data/shenlun_zhenti' % args.src)

    files = sorted(f for f in os.listdir(args.src) if f.endswith('.md'))
    parsed = []
    for fn in files:
        with open(os.path.join(args.src, fn), encoding='utf-8') as f:
            txt = f.read()
        prov, year, rest, vols = build_one(fn, txt)
        for vol, mats, qs in vols:
            parsed.append(dict(file=fn, prov=prov, year=year, rest=rest, vol=vol, mats=mats, qs=qs))
    ok = [r for r in parsed if r['qs'] and r['mats']]
    print('解析 %d 份源文件 → %d 个可取单元：可用 %d，跳过 %d' % (len(set(r['file'] for r in parsed)), len(parsed), len(ok), len(parsed) - len(ok)))

    # 旧卷清单：决定收录哪些卷、卷别与分组
    idx = json.loads(re.search(r'SH_EXAM_INDEX=(\[.*\]);',
                               open(os.path.join(ROOT, 'exams', 'index.js'), encoding='utf-8').read(), re.S).group(1))
    old = {}
    for grp in ('gk', 'prov1', 'prov2'):
        txt = open(os.path.join(ROOT, 'exams', grp + '.js'), encoding='utf-8').read()
        txt = txt[txt.index('concat(') + 7:]
        arr = json.loads(txt[:txt.rindex(']') + 1])
        for e in arr:
            old[e['id']] = e

    out = []
    for e in idx:
        prov, year = e['r'], e['y']
        cands = [r for r in ok if r['prov'] == prov and r['year'] == year]
        if not cands and prov == '深圳':
            cands = [r for r in ok if r['prov'] == '国考' and r['year'] == year and '深圳' in r['file']]
        if prov == '国考':
            # 国考要区分副省级 / 地市级 / 行政执法
            lvl = e.get('l') or ''
            key = {'副省级': '副省级', '地市级': '地市级', '行政执法': '行政执法'}.get(lvl, '')
            if key:
                hit = [r for r in cands if key in r['file']]
                if hit:
                    cands = hit
            if prov == '国考' and e['id'].startswith('深圳'):
                cands = [r for r in ok if '深圳' in r['file'] and r['year'] == year]
        if not cands:
            print('  ! %s 没有可用的源文件，沿用旧数据' % e['id'])
            out.append((e, old.get(e['id'])))
            continue
        r, score = pick_file(old.get(e['id']), cands)
        if score < 0.60:
            print('  ! %-22s 源文件对不上（重合度 %.2f），沿用旧数据' % (e['id'], score))
            r = None
        out.append((e, r))

    # 多卷合并的源文件拆成了多个单元：给每卷单列一套卷，卷别不同的不再共用同一份数据
    groups = collections.OrderedDict()
    for e, r in out:
        groups.setdefault((r['file'], e['r'], e['y']) if r else (e['id'],), []).append((e, r))
    final = []
    for key, items in groups.items():
        vols = sorted(set(x[1]['vol'] for x in items if x[1] and x[1]['vol']))
        if len(vols) < 2 or len(items) < 2:
            final.extend(items)
            continue
        # 每个源单元只给一套卷用：按卷别匹配，剩下的按顺序分给其余卷
        free = [x for x in items]
        used = set()
        for e, r in list(items):
            if e.get('l') in vols and (r['file'], r['vol']) not in used:
                r2 = [x[1] for x in items if x[1]['vol'] == e['l']][0]
                if (r2['file'], r2['vol']) in used:
                    continue
                used.add((r2['file'], r2['vol']))
                final.append((e, r2))
                free.remove((e, r))
        rest = [r for r in (x[1] for x in items) if (r['file'], r['vol']) not in used]
        for (e, r), r2 in zip(free, rest):
            used.add((r2['file'], r2['vol']))
            final.append((e, r2))
        for e, r in free[len(rest):]:
            final.append((e, None))
    out = final

    # 卷别不同却拿到同一份数据 → 改 ID 并改卷别标签，避免「两套卷长得一样」
    seen_file = {}
    for e, r in out:
        if not r:
            continue
        k = (r['file'], r['vol'])
        if k in seen_file:
            base = seen_file[k]
            if not base['id'].endswith('_' + (r['vol'] or 'A')):
                label = VOL_CN.get(r['vol'] or '', '')
                newid = '%s_%s_%s' % (base['r'], base['y'], r['vol'] or 'A')
                while any(x[0]['id'] == newid for x in out):
                    newid += '_2'
                e['id'] = newid
                e['l'] = label
                e['t'] = '%d年%s公务员考试《申论》试题（%s）' % (base['y'], base['r'], label) if base['r'] != '国考' \
                    else base['t']
        else:
            seen_file[k] = e

    missing = [e['id'] for e, r in out if r is None]
    if missing:
        print('  ! 沿用旧数据：%s' % '、'.join(missing))

    # 组装
    built = []
    for e, r in out:
        prev = old.get(e['id'])
        if r is None:
            built.append(dict(id=e['id'], r=e['r'], y=e['y'], l=e.get('l') or '', t=prev['t'],
                              m=prev['m'], q=prev['q'], grp=e['grp'], src='沿用旧数据'))
            continue
        mats = [dict(p=p) for _, p in r['mats']]
        qs = []
        for i, q in enumerate(r['qs']):
            lo, hi = limits(q)
            item = dict(no=i + 1, t=q['t'])
            if q['rq']:
                item['rq'] = q['rq']
            if q['sc']:
                item['sc'] = q['sc']
            if hi:
                item['lm'] = hi
            if lo:
                item['lmin'] = lo
            qs.append(item)
        cc = sum(len(x) for m in mats for x in m['p'])
        built.append(dict(id=e['id'], r=e['r'], y=e['y'], l=e.get('l') or '', t=prev['t'] if prev else title_of(e['r'], e['y'], r['rest']),
                          c=cc, m=mats, q=qs, grp=e['grp'], src=r['file']))

    # 与前端 wsNormalize 一致：题干完全相同的重复题只保留第一题
    for b in built:
        seen, keep = set(), []
        for q in b['q']:
            k = re.sub(r'\s', '', q.get('t') or '')
            if k and k in seen:
                continue
            if k:
                seen.add(k)
            keep.append(q)
        b['q'] = keep
        for i, q in enumerate(b['q']):
            q['no'] = i + 1

    print('· 组卷 %d 套 / %d 题' % (len(built), sum(len(b['q']) for b in built)))
    if args.report:
        for b in built:
            print('  %-28s 材料 %2d  题 %d  字数 %5d  ← %s'
                  % (b['id'], len(b['m']), len(b['q']), b['c'], b.get('src', '')))
    if args.dry:
        return

    # 校验：题干引用的资料号不能超过材料份数
    for b in built:
        for i, q in enumerate(b['q']):
            for m in re.finditer(r'(?:给定)?(?:资料|材料)[ \t]*([一二三四五六七八九十]+|\d{1,2})', q['t']):
                n = cn2num(m.group(1))
                if n and not 1 <= n <= len(b['m']):
                    print('  ! %s 第%d题引用了资料%s，但只有 %d 份材料' % (b['id'], i + 1, m.group(1), len(b['m'])))

    write_outputs(built, parsed)
    json.dump([{k: v for k, v in r.items()} for r in parsed],
              open(os.path.join(os.path.dirname(__file__), 'parsed.json'), 'w'), ensure_ascii=False, indent=1)


def write_outputs(built, parsed):
    head = ('/* 由 tools/exams/build_exams.py 从 shenlunhome.com 语料（Jinghe1279/SLB）重建，'
            '请勿手改。\n   每套卷：m 为按「材料N」切分的材料，q 为逐题题干与要求。 */\n')
    groups = {}
    index = []
    for b in built:
        e = dict(id=b['id'], r=b['r'], y=b['y'], l=b['l'], t=b['t'], c=b['c'], q=len(b['q']), grp=b['grp'])
        index.append(e)
        groups.setdefault(b['grp'], []).append(dict(id=b['id'], r=b['r'], y=b['y'], l=b['l'], t=b['t'],
                                                    c=b['c'], m=b['m'], q=b['q']))
    open(os.path.join(ROOT, 'exams', 'index.js'), 'w', encoding='utf-8').write(
        'window.SH_EXAM_INDEX=' + json.dumps(index, ensure_ascii=False, separators=(',', ':')) + ';\n')
    for grp, arr in groups.items():
        open(os.path.join(ROOT, 'exams', grp + '.js'), 'w', encoding='utf-8').write(
            head + 'window.SH_EXAMS=(window.SH_EXAMS||[]).concat('
            + json.dumps(arr, ensure_ascii=False, separators=(',', ':')) + ');\n')
        print('  · exams/%s.js  %d 套 %.2f MB' % (grp, len(arr),
              os.path.getsize(os.path.join(ROOT, 'exams', grp + '.js')) / 1048576.0))


if __name__ == '__main__':
    main()
