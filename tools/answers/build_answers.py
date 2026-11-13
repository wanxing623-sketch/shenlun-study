#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
真题参考答案构建脚本
====================
把开源题库里的申论参考答案，按「试卷 ID + 题序」对上本项目的真题数据，生成
exams/answers-gk.js、exams/answers-prov1.js、exams/answers-prov2.js、exams/answers-meta.js。

与旧版的区别
------------
旧版把整段「答案 + 参考答案说明 + 解析」一起塞进 a 字段，页面上看起来像答案正文，
而「参考答案说明」其实是对答案结构的解释，属于解析，不属于答案。新版把它们拆成三个字段：

  a      真实参考答案（只保留作答内容）
  note   参考答案说明 / 参考答案一、二…（对答案思路、结构的说明）
  x      解析与考点

数据来源（均为公开 GitHub 仓库，机器整理版，不是官方答案）：

  1. ProfessorZhi/gwy-zhenti   粉笔题库整理（主来源，逐题带参考答案 / 参考答案说明 / 考点 / 解析）
  2. h1neolzr7f/guokao-real-exams-2022-2026   2022–2026 国考机构解析（答案 / 评分标准 / 范文）
  3. zzcc-nb/gongkao-tiku      申论题库（按题干检索补缺）

匹配逻辑：题干相似度（二元组 Dice）+ 材料重合度双重校验，先按「卷」定来源，再按题序落库；
题号只作兜底，题干完全对不上时宁可不给答案，也不串题。

用法：
    python3 tools/answers/build_answers.py --src /path/to/gwy-zhenti --report
产物：
    exams/answers-*.js、exams/answers-meta.js、tools/answers/report.json
"""
import argparse, collections, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

VARIANTS = {'⻘': '青', '⺠': '民', '⻓': '长', '⻔': '门', '⻛': '风', '⻥': '鱼', '⻢': '马',
            '⻜': '飞', '⻅': '见', '⻩': '黄', '⻰': '龙', '⻐': '金', '⺟': '母',
            '⻋': '车', '⻄': '西', '⻚': '页', '⻉': '贝', '⻝': '食', '⻬': '齐',
            '⻙': '韦', '⻊': '足', '⺩': '王', '⻖': '阝', '⻆': '角', '⺮': '竹', '⺡': '氵'}

SRC_META = {
    'gwy': dict(id='gwy-zhenti', repo='ProfessorZhi/gwy-zhenti', branch='main',
                url='https://github.com/ProfessorZhi/gwy-zhenti',
                name='粉笔题库整理（gwy-zhenti）',
                note='粉笔题库参考答案及解析，机器抓取版，非官方答案'),
    'jigou': dict(id='guokao-2022-2026', repo='h1neolzr7f/guokao-real-exams-2022-2026', branch='main',
                  url='https://github.com/h1neolzr7f/guokao-real-exams-2022-2026',
                  name='国考机构解析（2022–2026）',
                  note='机构整理答案 / 评分标准 / 范文，非官方答案'),
    'fenbi': dict(id='fenbi-tiku', repo='zzcc-nb/gongkao-tiku', branch='master',
                  url='https://github.com/zzcc-nb/gongkao-tiku',
                  name='申论题库（gongkao-tiku）',
                  note='粉笔参考答案 + 答题演示，按题干补缺'),
}


# ---------- 文本工具 ----------
def clean(t):
    t = (t or '')
    for k, v in VARIANTS.items():
        t = t.replace(k, v)
    t = t.replace('\r\n', '\n').replace('\r', '\n').replace('\u00a0', ' ').replace('\u3000', ' ')
    t = t.replace('&#8226;', '·').replace('&#183;', '·').replace('&nbsp;', ' ')
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', t)          # 图片
    t = re.sub(r'<[^>]+>', '', t)                        # html
    t = re.sub(r'(?m)^\s*>\s?', '', t)                   # 引用块
    t = t.replace('**', '').replace('__', '')        # \ue000 保留给解析器判断加粗位置
    t = re.sub(r'(?m)^\s*解析\s*$', '', t)
    t = re.sub(r'(?m)^\s*(?:第\s*\d{1,2}\s*题\s*[·・]\s*)?答案与解析\s*$', '', t)
    t = re.sub(r'[ \t]+\n', '\n', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()


def norm(t):
    t = (t or '').replace('\ue000', '')
    for k, v in VARIANTS.items():
        t = t.replace(k, v)
    return re.sub(r'[\s，。；：、！？“”‘’（）《》〈〉【】·—…,.:;!?()\[\]"\'\-—－_/\\|*#`]', '', t)


def bigrams(s):
    return set(s[i:i + 2] for i in range(len(s) - 1)) or {s}


def contain(a, b):
    """短题干被长题干覆盖的比例（一边截断了子问题/要求时，Dice 会偏低）"""
    if not a or not b:
        return 0.0
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    if len(short) < 12:
        return 0.0
    G, H = bigrams(short), bigrams(long_)
    if not G:
        return 0.0
    return len(G & H) / float(len(G))


def sim(a, b):
    """题干相似度：Dice 与「短题干被覆盖率」取高者"""
    return max(dice(a, b), contain(a, b) * 0.92)


def dice(a, b):
    A, B = bigrams(a), bigrams(b)
    if not A or not B:
        return 0.0
    return 2.0 * len(A & B) / (len(A) + len(B))


ARTIFACT_RE = re.compile(r'微信公众号|扫码关注|扫码添加|（责任编辑|来源：粉笔|本文来源|点击查看更多|'
                         r'以上内容由|客服|APP内|下载粉笔')


def tidy(t):
    """去掉抓取残留、接回 OCR 硬换行；保留分条与分段"""
    t = (t or '').replace('\ue000', '')
    lines = []
    for ln in (t or '').split('\n'):
        s = ln.strip()
        if not s:
            lines.append('')
            continue
        if ARTIFACT_RE.search(s) and len(s) < 60:
            continue
        lines.append(s)
    out, buf, prev_short = [], [], True
    for s in lines:
        if s == '':
            if buf:
                out.append(buf)
            out.append([''])
            buf = []
            continue
        buf.append(s)
    if buf:
        out.append(buf)
    blocks = []
    for b in out:
        if b == ['']:
            continue
        text = ''
        for s in b:
            if not text:
                text = s
            elif re.match(r'^\d{1,2}[.、．]|^[（(]\d{1,2}[）)]|^[一二三四五六七八九十]+[、.]|'
                          r'^(要点|解析|考点|答案|措施|对策|原因|问题|成效|结论|总之|因此|首先|其次|再次|最后|'
                          r'一、|二、|三、|四、|五、|标题|开头|结尾|分论点)', s):
                text += '\n' + s
            elif text.rstrip().endswith(('。', '！', '？', '；', '：', '”', '）', '…')):
                text += '\n' + s
            else:
                text += s
        blocks.append(text.strip())
    return '\n\n'.join(x for x in blocks if x)


# ---------- 解析 gwy-zhenti ----------
Q_HEAD = re.compile(r'(?m)^###\s*第\s*(\d{1,2})\s*题\s*$')
ANS_MAIN = re.compile(r'\ue000?\s*参考答案(?:（[^）]*）|\([^)]*\))?\s*[：:]?\s*\ue000?\s*\n?')
ANS_NOTE = re.compile(r'\ue000(参考答案说明|答案说明|答题说明|参考答案一|参考答案二|参考答案三|'
                      r'答案一|答案二|答案三|参考范文一|参考范文二|参考范文1|参考范文2)'
                      r'\s*[：:]?\s*(?:\ue000)?')


def parse_gwy_file(path):
    raw = open(path, encoding='utf-8').read()
    raw = raw.replace('**', '\ue000')       # 先把加粗标记换成私用区字符，避免被 clean 抹掉
    txt = clean(raw)
    head, _, rest = txt.partition('## 题目')
    if not rest:
        return []
    mats = []
    for m in re.finditer(r'(?m)^###\s*材料\s*(\d{1,2})\s*$', head):
        mats.append(m.start())
    mat_text = []
    for i, st in enumerate(mats):
        end = mats[i + 1] if i + 1 < len(mats) else len(head)
        seg = head[head.index('\n', st) + 1:end]
        mat_text.append(seg.strip())
    parts = Q_HEAD.split(rest)
    out = []
    for i in range(1, len(parts), 2):
        no = int(parts[i])
        chunk = parts[i + 1]
        # 去掉折叠块结束标签
        body = chunk.split('<details>')[0]
        body = body.replace('\ue000', '') if body.count('\ue000') <= 2 else body
        body = re.sub(r'关联材料[：:].*', '', body)
        body = re.sub(r'作答要求[：:][\s\S]*?(?=\ue000?\s*参考答案|$)', '', body)
        stem = re.split(r'关联材料|作答要求|参考答案（|参考答案\(', body)[0]
        stem = re.sub(r'\s+', ' ', stem.replace('\ue000', '')).strip().strip('*').strip()
        stem = re.sub(r'[（(]\s*\d+\s*分\s*[）)]\s*$', '', stem).strip()
        ans_part = chunk
        main = ''
        m = ANS_MAIN.search(ans_part)
        if m:
            seg = ans_part[m.end():]
            # 「解析」段整体拿掉后再切答案 / 说明，避免说明被当成正文
            msep = re.search(r'(?m)^\s*(?:第\s*\d{1,2}\s*题\s*[·・]\s*)?解析\s*$', seg)
            tail = ''
            if msep:
                tail = seg[msep.end():]
                seg = seg[:msep.start()]
            # 「参考答案（…）」标题后面常紧跟「参考答案一」，那是正文的标签，不是说明
            lead = re.match(r'\s*\ue000?\s*(?:参考答案一|答案一|参考范文一)\s*[：:]?\s*\ue000?\s*', seg)
            first_label = ''
            if lead:
                first_label = '参考答案一'
                seg = seg[lead.end():]
            stop = re.search(r'(?m)^\s*\ue000?\s*(?:参考答案说明|答案说明|答题说明|参考答案[一二三]|'
                             r'参考范文[一二三1-3])', seg)
            main = seg[:stop.start()] if stop else seg
            ans_part = (seg[stop.start():] if stop else '') + '\n' + tail
            if first_label:
                note_bits_lead = [(first_label, '')]
        note_bits = []
        for m in ANS_NOTE.finditer(ans_part):
            seg = ans_part[m.end():]
            stop = re.search(r'(?m)^\s*(?:参考答案说明|答案说明|答题说明|参考答案[二三]|参考范文[二三2-3]|'
                             r'考点[：:]|来源[：:])', seg)
            note_bits.append((m.group(1), seg[:stop.start()] if stop else seg))
        analysis = ''
        mj = re.search(r'\ue000\s*解析\s*\ue000?', ans_part)
        if mj:
            analysis = ans_part[mj.end():]
        kaodian = ''
        mk = re.search(r'\ue000\s*考点\s*\ue000?\s*[：:]?\s*([^\n]*)', ans_part)
        if mk:
            kaodian = mk.group(1).strip()
        main = re.sub(r'(?m)^\s*(?:第\s*\d{1,2}\s*题\s*[·・]\s*)?答案与解析.*$', '', main)
        main = re.sub(r'(?m)^\s*<', '', main)
        main_clean, inline_notes = split_inline_notes(main)
        if not main_clean.strip() and len(inline_notes) >= 1:
            # 「参考答案一 / 二」这种排版：第一份当主答案，其余作为对照
            main_clean = inline_notes[0][1]
            inline_notes = [('参考答案一', inline_notes[0][1])] + inline_notes[1:]
        note_bits = inline_notes + note_bits
        out.append(dict(no=no, t=stem, a=tidy(main_clean),
                        note=[(k, tidy(v)) for k, v in note_bits if tidy(v)],
                        x=tidy(analysis), k=kaodian, mats=mat_text, path=path))
    return out


INLINE_NOTE = re.compile(r'(?m)(?:^|(?<=[。；：\n]))\s*\**\s*(参考答案说明|答案说明|答题说明|参考范文说明'
                         r'|参考答案[一二三]|参考范文[一二三1-3])\s*[：:]?\s*\**')


def split_inline_notes(text):
    """「参考答案说明：…」有时不带加粗标题、直接跟在答案正文后面，这里切出来"""
    hits = list(INLINE_NOTE.finditer(text or ''))
    if not hits:
        return text, []
    main = text[:hits[0].start()]
    notes = []
    for i, m in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
        notes.append((m.group(1), text[m.end():end]))
    return main, notes


def load_gwy(src):
    items = []
    for fn in sorted(os.listdir(src)):
        if not fn.endswith('.md'):
            continue
        for q in parse_gwy_file(os.path.join(src, fn)):
            q['file'] = fn
            if q['a']:
                items.append(q)
    return items


# ---------- 解析机构解析 / 题库 ----------
def load_jigou(src):
    out = []
    if not os.path.isdir(src):
        return out
    for root, _, files in os.walk(src):
        for fn in files:
            if not fn.endswith(('.md', '.txt')):
                continue
            t = clean(open(os.path.join(root, fn), encoding='utf-8').read())
            for i, chunk in enumerate(re.split(r'(?m)^第[一二三四五六七八九十\d]+题[：:]', t)[1:]):
                out.append(dict(no=i + 1, t='', a=tidy(chunk), note=[], x='', k='', mats=[],
                                file=fn, ref=fn))
    return out


def load_fenbi(src):
    out = []
    if not os.path.isdir(src):
        return out
    for root, _, files in os.walk(src):
        for fn in files:
            if not fn.endswith('.md'):
                continue
            t = clean(open(os.path.join(root, fn), encoding='utf-8').read())
            m = re.search(r'(?m)^[#\s]*(?:题目|题干)[：:]?', t)
            stem = ''
            if fn.endswith('.md'):
                stem = re.sub(r'[（(][^）)]*类[）)]$', '', os.path.splitext(fn)[0].split('_', 1)[-1])
            if not stem:
                continue
            ans = t[m.end():] if m else t
            out.append(dict(no=0, t=stem, a=tidy(ans), note=[], x='', k='', mats=[], file=fn, ref=fn))
    return out


# ---------- 本项目真题 ----------
def load_exams():
    js = r'''
const fs=require("fs"),vm=require("vm");const ctx={window:{}};vm.createContext(ctx);
for(const f of ["exams/gk.js","exams/prov1.js","exams/prov2.js"])vm.runInContext(fs.readFileSync(f,"utf8"),ctx);
console.log(JSON.stringify(ctx.window.SH_EXAMS.map(e=>({id:e.id,r:e.r,y:e.y,l:e.l,t:e.t,
  m:e.m.map(x=>x.p.join("")),q:e.q.map(q=>({no:q.no,t:q.t,rq:q.rq||"",sc:q.sc||0}))}))));'''
    import subprocess
    out = subprocess.check_output(['node', '-e', js], cwd=ROOT)
    return json.loads(out.decode('utf-8'))


def mat_cover(our_mat, mats):
    """来源材料有多少能在我方材料里找到（按节长度加权）"""
    total = hit = 0.0
    for m in mats:
        nm = norm(m)
        if len(nm) < 60:
            continue
        total += len(nm)
        grams = bigrams(nm)
        ours = bigrams(our_mat)
        hit += (len(grams & ours) / float(len(grams))) * len(nm)
    if total == 0:
        return None
    return hit / total


def ref_name(fn):
    """国考__2021__申论-副省级.md → 2021 年国考申论·副省级"""
    parts=fn[:-3].split('__')
    if parts[0]=='省考' and len(parts)>3:
        return '%s %s 年省考申论·%s' % (parts[1], parts[2], '·'.join(parts[3:]))
    if len(parts)>2:
        tail='·'.join(parts[2:]).replace('申论-', '').replace('申论', '')
        return '%s %s 年申论·%s' % (parts[0], parts[1], tail.strip('·'))
    return fn[:-3].replace('__', ' ')


def stem_cover(src_stem, our_stems):
    """来源题干在我方题目里的最大相似度（用于没有材料时的兜底对齐）"""
    if not src_stem:
        return 0.0
    return max((dice(norm(src_stem), norm(x)) for x in our_stems), default=0.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(ROOT, 'tools', 'answers', '.cache', 'gwy-zhenti'))
    ap.add_argument('--jigou', default=os.path.join(ROOT, 'tools', 'answers', '.cache', 'guokao-2022-2026'))
    ap.add_argument('--fenbi', default=os.path.join(ROOT, 'tools', 'answers', '.cache', 'gongkao-tiku'))
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()
    if not os.path.isdir(args.src):
        sys.exit('找不到答案源目录：%s\n请先 git clone https://github.com/ProfessorZhi/gwy-zhenti，'
                 '再用 --src 指到仓库根目录' % args.src)

    items = load_gwy(args.src)
    print('· 读取 gwy-zhenti：%d 卷 / %d 题' % (len(set(i['file'] for i in items)), len(items)))
    exams = load_exams()
    print('· 本项目：%d 卷 / %d 题' % (len(exams), sum(len(e['q']) for e in exams)))

    # 索引：省份 + 年份 → 文件
    by_year = collections.defaultdict(list)
    for it in items:
        fn = it['file']
        parts = fn[:-3].split('__')
        if parts[0] == '省考' and len(parts) > 2:
            prov, year = parts[1], parts[2]
        else:
            prov, year = parts[0], (parts[1] if len(parts) > 1 else '')
        by_year[(prov, year)].append(it)
    by_file = collections.defaultdict(list)
    for it in items:
        by_file[it['file']].append(it)

    out, report, stats = {}, [], collections.Counter()
    for e in exams:
        year = str(e['y'])
        prov = '国考' if e['r'] == '国考' else e['r']
        if e['r'] == '深圳':
            prov = '深圳'
        cands = by_year.get((prov, year), [])
        if not cands and '深圳' in e['id']:
            cands = [it for it in items if '深圳' in it['file'] and year == it['file'].split('__')[2]]
        our_mat = norm(''.join(e['m']))
        our_stems = [q['t'] for q in e['q']]
        # 先定试卷：材料重合度 + 卷别吻合
        files = collections.defaultdict(list)
        for it in cands:
            files[it['file']].append(it)
        best_file, best_score = None, -1.0
        for fn, its in files.items():
            cov = mat_cover(our_mat, its[0]['mats'])
            if cov is None:
                # 源文件没有材料（只有题目），退化为按题干整体重合度估算
                cov = max((stem_cover(x['t'], our_stems) for x in its), default=0.0)
            bonus = 0.0
            lvl = (e.get('l') or '')
            if prov == '国考' and lvl:
                if lvl.replace('级', '') in fn:
                    bonus += 0.35
            for tag in ('县乡', '乡镇', '县级', '省市', '市级', '区级', '执法', '公安', '选调', 'A卷', 'B卷', 'C卷'):
                if tag in fn and tag.replace('卷', '') in lvl:
                    bonus += 0.2
                    break
            score = cov + bonus
            if score > best_score:
                best_file, best_score = fn, score
        if best_file is None:
            report.append((e['id'], 0, len(e['q'])))
            stats['miss'] += 1
            continue
        srcs = by_file[best_file]
        arr = []
        used = set()
        for i, q in enumerate(e['q']):
            # 按题干相似度在整卷里找最合适的一题（题号仅作加分），避免题序错位串题
            best, best_key = None, (0.0,)
            for j, it in enumerate(srcs):
                if j in used:
                    continue
                st = sim(norm(q['t']), norm(it['t']))
                key = (st + (0.06 if it['no'] == q['no'] else 0.0), -abs(it['no'] - q['no']))
                if st >= 0.62 and key > best_key:
                    best, best_key = j, key
            tier = None
            item = None
            if best is not None:
                item = srcs[best]
                stem = sim(norm(q['t']), norm(item['t']))
                tier = 'high' if stem >= 0.80 else 'mid'
            if item is None:
                # 兜底：同序号且题干不至于完全无关
                if i < len(srcs) and sim(norm(q['t']), norm(srcs[i]['t'])) >= 0.45:
                    item, tier = srcs[i], 'loose'
                    best = i
            if item is None:
                arr.append(None)
                stats['miss'] += 1
                continue
            used.add(best)
            alts = []
            for k, v in item['note']:
                if re.match(r'参考答案[一二三]|答案[一二三]|参考范文', k):
                    alts.append(dict(kind='alt', label=k, a=v))
            note = '\n\n'.join(v for k, v in item['note'] if not re.match(r'参考答案[一二三]|参考范文', k))
            note = re.sub(r'(?m)^\s*(?:参考答案说明|答案说明|答题说明)\s*[：:]?\s*', '', note).strip()
            note = re.sub(r'^[：:，,。、\s]+', '', note).strip()
            body, stray = split_inline_notes(item['a'])
            # 正文末尾若还挂着「解析 / 考点 / 来源」小标题，一并切到解析里
            mtail = re.search(r'(?m)^\s*(?:(?:解析|考点|来源)(?:\s*[：:].*)?\s*$|解析(?=\S))', body)
            if mtail:
                if mtail.group(0).strip() == '解析' and mtail.start() > 20:
                    extra_x = body[mtail.end():].strip()
                    if extra_x and not item['x']:
                        item = dict(item, x=extra_x)
                body = body[:mtail.start()]
            if stray:
                extra = '\n\n'.join(v for k, v in stray
                                    if not re.match(r'参考答案[一二三]|参考范文', k))
                if extra.strip():
                    note = (note + '\n\n' + extra).strip()
            obj = dict(no=q['no'], tier=tier, src='gwy', path=item['file'],
                       ref=ref_name(item['file']),
                       a=body.strip()[:4000])
            if note:
                obj['note'] = note[:2000]
            if item['x']:
                xx = re.sub(r'(?m)^\s*(?:考点|来源)\s*[：:].*$', '', item['x']).strip()
                if xx:
                    obj['x'] = xx[:1500]
            if item['k']:
                obj['k'] = item['k'][:60]
            if alts:
                obj['alts'] = [dict(src='gwy', path=item['file'], ref=obj['ref'],
                                    a=split_inline_notes(x['a'])[0].strip()[:2500],
                                    tier=tier, label=x['label']) for x in alts[:3]]
            arr.append(obj)
            stats[tier] += 1
        out[e['id']] = arr
        report.append((e['id'], sum(1 for x in arr if x), len(arr)))

    total = sum(len(e['q']) for e in exams)      # 以全量题数为准，缺口卷也计入分母
    covered = sum(1 for v in out.values() for x in v if x)
    meta = dict(generated=__import__('time').strftime('%Y-%m-%d'), total=total, covered=covered,
                tiers={k: stats[k] for k in ('high', 'mid', 'loose', 'miss')},
                sources=[SRC_META[k] for k in ('gwy', 'jigou', 'fenbi')])
    head = ('/* 由 tools/answers/build_answers.py 自动生成，请勿手改。\n'
            '   参考答案来自 GitHub 开源题库，仅供学习自检，非官方答案。 */\n')
    open(os.path.join(ROOT, 'exams', 'answers-meta.js'), 'w', encoding='utf-8').write(
        head + 'window.SH_ANSWER_META=' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
    idx = json.loads(re.search(r'SH_EXAM_INDEX=(\[.*\]);',
                               open(os.path.join(ROOT, 'exams', 'index.js'), encoding='utf-8').read(), re.S).group(1))
    for grp in ('gk', 'prov1', 'prov2'):
        ids = set(x['id'] for x in idx if x['grp'] == grp)
        part = {k: v for k, v in out.items() if k in ids}
        if not part:
            continue
        open(os.path.join(ROOT, 'exams', 'answers-%s.js' % grp), 'w', encoding='utf-8').write(
            head + 'window.SH_ANSWERS=Object.assign(window.SH_ANSWERS||{},'
            + json.dumps(part, ensure_ascii=False, separators=(',', ':')) + ');\n')
        print('  · exams/answers-%s.js  %d 卷 %.2f MB' % (
            grp, len(part), os.path.getsize(os.path.join(ROOT, 'exams', 'answers-%s.js' % grp)) / 1048576.0))
    json.dump(dict(meta=meta, report=report), open(os.path.join(os.path.dirname(__file__), 'report.json'), 'w'),
              ensure_ascii=False, indent=1)
    print('· 完成：%d / %d 题有答案（高 %d / 中 %d / 宽松 %d）'
          % (covered, total, stats['high'], stats['mid'], stats['loose']))
    if args.report:
        for eid, n, t in report:
            if n < t:
                print('  缺 %d/%d  %s' % (t - n, t, eid))


if __name__ == '__main__':
    main()
