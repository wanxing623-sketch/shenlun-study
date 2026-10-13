#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从开源仓库 Jinghe1279/SLB 的 data/shenlun_zhenti/*.md 解析申论真题，
输出可被 index.html「真题作答台」直接消费的 exams/*.js。

用法：
    python3 tools/parse_slb_exams.py <SLB 的 data/shenlun_zhenti 目录> [--write]

不带 --write 只做 dry-run（打印统计与样例，便于校验解析质量）。
合并策略：与仓库已有试卷按「归一化标题」去重；已有试卷保留原 id 不动
（避免用户本地作答 / 标注记录失效），只把新增试卷补进题库。
"""
import json
import os
import re
import sys
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 明显不是真题的文件（机关素养、招警、政法干警、范文解析、乱码占位等）
EXCLUDE_PAT = re.compile(
    r'招警|政法干警|机关工作素养|机关素养|思维方法|群众工作九法|参考答案|答案|解析|范文|'
    r'模板|技巧|占位|乱码|答题卡|大纲')

# 材料小标题：允许出现在行首，也允许紧跟在句号后面（源数据换行丢失的情况）
MATERIAL_ANY = re.compile(
    r'(?:^|(?<=[。！？；”》\n]))[ \t]*(?:给定)?(?:材料|资料)\s*([一二三四五六七八九十]{1,2}|\d{1,2})'
    r'\s*[：:、.．]?\s*(?=[^\s]|$)')
MATERIAL_HEAD = re.compile(
    r'^\s*(?:给定)?(?:材料|资料)\s*([一二三四五六七八九十]{1,2}|\d{1,2})\s*[：:、.．]?\s*$')

# 「第X题 / 问题X / （一） / 一、 / 1.」开头的题干
Q_START = re.compile(
    r'^\s*(?:'
    r'第\s*([一二三四五六七八九十]{1,2}|\d{1,2})\s*题'
    r'|问题\s*([一二三四五六七八九十]{1,2}|\d{1,2})'
    r'|[（(]\s*([一二三四五六七八九十]{1,2}|\d{1,2})\s*[)）]\s*[、.．]?'
    r'|([一二三四五六七八九十]{1,2})\s*[、.．]'
    r'|(\d{1,2})\s*[、.．]'
    r')\s*[：:]?\s*(\S.*)$')

SCORE_RE = re.compile(r'[（(]\s*(\d{1,3})\s*分\s*[)）]')
REQ_INLINE = re.compile(r'[（(]?\s*要求\s*[：:.．]')
CN_NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8,
          '九': 9, '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14,
          '十五': 15, '十六': 16, '十七': 17, '十八': 18}

# 已有题库中出现过的地区名，用于从标题推断试卷归属
REGIONS = ['安徽', '北京', '重庆', '福建', '甘肃', '广东', '广西', '贵州', '海南', '河北', '河南',
           '黑龙江', '湖北', '湖南', '吉林', '江苏', '江西', '辽宁', '内蒙古', '宁夏', '青海',
           '山东', '山西', '陕西', '上海', '深圳', '四川', '天津', '西藏', '新疆', '云南', '浙江',
           '广州', '联考']


def norm_title(t):
    """标题归一化：只留中文字符、字母、数字，用于跨来源去重。"""
    t = re.sub(r'[【\[（(][^】\])]*?含参考答案[^】\])]*?[】\])]', '', t)
    t = t.replace('含参考答案', '').replace('网友回忆版', '').replace('网友提供版', '')
    t = t.replace('参考题本', '').replace('参考试卷', '')
    t = re.sub(r'[^0-9A-Za-z\u4e00-\u9fff]', '', t)
    return t.lower()


def clean_line(s):
    s = s.replace('\u3000', ' ').replace('\xa0', ' ')
    s = re.sub(r'[ \t]+', ' ', s).strip()
    return s


def read_md(path):
    raw = open(path, encoding='utf-8', errors='ignore').read()
    meta, body = {}, raw
    if raw.startswith('---'):
        end = raw.find('\n---', 3)
        if end > 0:
            for line in raw[3:end].split('\n'):
                if ':' in line:
                    k, v = line.split(':', 1)
                    meta[k.strip()] = v.strip()
            body = raw[end + 4:]
    body = '\n'.join(ln for ln in body.split('\n') if not ln.strip().startswith('#'))
    return body, meta


def de_flat(text):
    """源数据里有些文件被压成一行，这里按「材料N / 作答要求 / 要求 / 第X题」等锚点补换行。"""
    anchors = [
        r'(?<![^\s。！？；”》])(?:给定)?(?:材料|资料)\s*[一二三四五六七八九十\d]{1,2}\s*[：:、.．]?(?=\s*\S)',
        r'作答要求\s*[：:]?', r'答题要求\s*[：:]?',
        r'(?:问题|第)\s*[一二三四五六七八九十\d]{1,2}\s*题?\s*[：:、.．]?',
        r'要求\s*[：:]',
    ]
    for pat in anchors:
        text = re.sub(r'\s*(' + pat + r')\s*', r'\n\n\1\n', text) if pat.startswith('要求') \
            else re.sub(r'\s*(' + pat + r')\s*', r'\n\n\1\n', text)
    return text


def normalize_body(text):
    """统一换行、去行首缩进，并把「……。材料2：」这类行内小标题拆到新行。"""
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[\u3000\xa0]+', ' ', text)
    text = re.sub(r'[ \t]+\n', '\n', text)
    # 行内小标题：句末标点后紧跟「材料N：」
    text = re.sub(r'([。！？；”》])\s*((?:给定)?(?:材料|资料)\s*[一二三四五六七八九十\d]{1,2}\s*[：:、.．])',
                  r'\1\n\n\2', text)
    if text.count('\n') < 25 and len(text) > 3000:
        text = de_flat(text)
    return text


def split_materials_text(text):
    """把「材料N」小标题切成 [(num, 片段)]；编号需递增（允许新一卷重新从 1 开始）。"""
    lines = text.split('\n')
    marks = []          # (num, 行下标)
    last_num = 0
    for i, raw in enumerate(lines):
        line = clean_line(raw)
        m = re.match(r'^(?:给定)?(?:材料|资料)\s*([一二三四五六七八九十]{1,2}|\d{1,2})\s*[：:、.．]?\s*(\S.*)?$', line)
        if not m:
            continue
        label = m.group(1)
        num = int(label) if label.isdigit() else CN_NUM.get(label, 0)
        if not num:
            continue
        if marks and num <= last_num and num != 1:
            continue
        marks.append((num, i))
        last_num = num
    out = []
    for idx, (num, i) in enumerate(marks):
        stop = marks[idx + 1][1] if idx + 1 < len(marks) else len(lines)
        body = '\n'.join(lines[i:stop])
        # 去掉小标题本身
        body = re.sub(r'^\s*(?:给定)?(?:材料|资料)\s*[一二三四五六七八九十\d]{1,2}\s*[：:、.．]?', '', body, count=1)
        out.append((num, body))
    return out


def parse_materials(text):
    """把材料部分切成 [{p:[段落...]}, ...]；空行 = 段落分隔，材料标题 = 新材料。"""
    segs = split_materials_text(text)
    if not segs:
        # 没有任何「材料N」标记时，整段当作一份材料
        segs = [(1, text)]
    out = []
    for _num, seg in segs:
        paras, cur = [], []

        def flush():
            if cur:
                t = clean_line(''.join(cur))
                if t:
                    paras.append(t)
            cur.clear()

        for raw in seg.split('\n'):
            line = clean_line(raw)
            if not line or re.fullmatch(r'[-—_*=·\s]{3,}', line):
                flush()
                continue
            cur.append(line)
        flush()
        paras = [p for p in paras if len(p) > 1]
        if paras:
            out.append({'p': paras})
    return out


def parse_score(qtext):
    m = None
    for m2 in SCORE_RE.finditer(qtext):
        m = m2
    if m:
        return int(m.group(1))
    m = re.search(r'[,，。；;]\s*(\d{1,3})\s*分\s*[。.]?\s*$', qtext)
    return int(m.group(1)) if m else 0


def parse_words(req):
    if not req:
        return 0
    for pat in (r'不超过\s*(\d{3,4})\s*字', r'(\d{3,4})\s*字\s*左右',
                r'不(?:少于|低于)\s*(\d{3,4})\s*字', r'总字数\s*(\d{3,4})'):
        m = re.search(pat, req)
        if m:
            return int(m.group(1))
    m = re.search(r'(\d{3,4})\s*[-—~～至到]\s*(\d{3,4})\s*字', req)
    if m:
        return int(m.group(2))
    m = re.search(r'(\d{3,4})\s*[-—~～至到]\s*(\d{3,4})\s*以内', req)
    if m:
        return int(m.group(2))
    return 0


def find_question_starts(lines):
    """返回题干行的下标列表。判定：行首像题号，且本行或后续 300 字内出现「（X分）」。"""
    starts = []
    for i, raw in enumerate(lines):
        m = Q_START.match(raw)
        if not m:
            continue
        if len(m.group(6)) < 4:
            continue
        window = '\n'.join(lines[i:i + 6])[:400]
        if not SCORE_RE.search(window):
            continue
        if starts and i - starts[-1] < 2:
            continue
        starts.append(i)
    return starts


def parse_questions(chunk):
    """把题干段落切成 [{no,t,rq,lm,sc}]，兼容「要求：」与题干同行的写法。"""
    blocks, cur, first_no = [], None, None
    for raw in chunk:
        line = clean_line(raw)
        if not line or re.fullmatch(r'[-—_*=·\s]{3,}', line):
            continue
        m = Q_START.match(line)
        if m and (cur is None or cur['rq'] or len(''.join(cur['t'])) > 25 or len(m.group(6)) > 18):
            if cur:
                blocks.append(cur)
            if first_no is None:
                label = m.group(1) or m.group(2) or m.group(3) or m.group(4) or m.group(5)
                first_no = int(label) if label.isdigit() else CN_NUM.get(label, 0)
            cur = {'t': [m.group(6)], 'rq': []}
            continue
        if cur is None:
            continue
        if REQ_INLINE.match(line):
            cur['rq'].append(re.sub(r'^[（(]?\s*要求\s*[：:.．]\s*', '', line))
        elif cur['rq']:
            cur['rq'].append(line)      # 要求里的分条 (1)(2)(3)
        else:
            cur['t'].append(line)
    if cur:
        blocks.append(cur)

    out = []
    for b in blocks:
        t = clean_line(' '.join(b['t']))
        rq = clean_line(' '.join(b['rq']))
        t = re.sub(r'^[：:、.．，,；;\s]+', '', t)
        # 「要求：」写在题干行内的情况
        if not rq:
            mm = REQ_INLINE.search(t)
            if mm:
                rq = clean_line(t[mm.end():])
                t = clean_line(t[:mm.start()])
        if not t:
            continue
        if out and not parse_score(t) and len(t) < 200:
            # 无分值的小片段（多为上一题「要求」的续写）并入上一题
            prev = out[-1]
            prev['rq'] = clean_line((prev['rq'] + ' ' + t).strip())
            if parse_words(t):
                prev['lm'] = prev.get('lm') or parse_words(t)
            continue
        out.append({'t': t, 'rq': rq})
    for i, q in enumerate(out, 1):
        q['no'] = i
        q['sc'] = parse_score(q['t'])
        q['lm'] = parse_words(q['rq'] or q['t'])
    return out, first_no


def parse_file(path):
    body, meta = read_md(path)
    body = normalize_body(body)
    if body.count('\ufffd') > 8:
        return None, meta, 'mojibake'
    lines = body.split('\n')

    cut = None
    for m in re.finditer(r'作\s*答\s*要\s*求|答题要求|作答任务|作\s*答\s*[：:]', body):
        cut = m
    if cut is not None:
        mat_text, q_text = body[:cut.start()], body[cut.end():]
        q_lines = q_text.split('\n')
        starts = find_question_starts(q_lines)
        chunk = q_lines[starts[0]:] if starts else q_lines
    else:
        starts = find_question_starts(lines)
        if not starts:
            return None, meta, 'no questions'
        mat_text = '\n'.join(lines[:starts[0]])
        chunk = lines[starts[0]:]

    mats = parse_materials(mat_text)
    qs, first_no = parse_questions(chunk)
    return {'m': mats, 'q': qs, 'first_no': first_no}, meta, ''


def province_of(fname, meta, title):
    for r in REGIONS:
        if r in title:
            return '广东' if r == '广州' else r
    province = (meta.get('province') or meta.get('board') or '').split(';')[0].strip()
    return province


def guess_fields(fname, meta, title):
    province = province_of(fname, meta, title)
    m = re.search(r'(\d{4})', fname)
    year = int(m.group(1)) if m else 0
    if not year and meta.get('year'):
        try:
            year = int(meta['year'])
        except ValueError:
            year = 0
    label = ''
    for pm in re.finditer(r'[（(]([^（）()]{1,24})[)）]', title):
        label = pm.group(1)
    label = re.sub(r'含参考答案|网友回忆版|网友提供版|仅供参考|选调版?', '', label)
    label = label.strip('；;，,。 ')
    label = re.sub(r'^([ABCabc])\s*卷$', lambda mm: mm.group(1).upper() + '类', label)
    return province, year, label


def valid(paper):
    """新增试卷的严格校验：宁缺毋滥，只收完整卷。"""
    mats, qs = paper['m'], paper['q']
    if len(qs) < 3 or len(qs) > 8:
        return False, 'q count %d' % len(qs)
    if paper.get('first_no') != 1:
        return False, 'first question No.%s' % paper.get('first_no')
    if not mats or len(mats) > 16:
        return False, 'material count %d' % len(mats)
    chars = sum(len(p) for mat in mats for p in mat['p'])
    if chars < 2000:
        return False, 'chars %d' % chars
    if any(len(q['t']) < 12 or len(q['t']) > 500 for q in qs):
        return False, 'question text length'
    if any(not q['sc'] for q in qs):
        return False, 'question without score'
    if not (80 <= sum(q['sc'] for q in qs) <= 160):
        return False, 'score sum %d' % sum(q['sc'] for q in qs)
    return True, ''


def load_existing_index():
    txt = open(os.path.join(ROOT, 'exams/index.js'), encoding='utf-8').read()
    return json.loads(txt.split('=', 1)[1].rstrip().rstrip(';'))


def main():
    src = sys.argv[1]
    write = '--write' in sys.argv
    existing = load_existing_index()
    have_ids = {x['id'] for x in existing}
    have_titles = {norm_title(x['t']): x['id'] for x in existing}

    new_papers, dup, failed = [], [], []
    for fname in sorted(os.listdir(src)):
        if not fname.endswith('.md') or fname.startswith('_'):
            continue
        path = os.path.join(src, fname)
        if EXCLUDE_PAT.search(fname):
            failed.append((fname, 'excluded'))
            continue
        paper, meta, err = parse_file(path)
        if not paper:
            failed.append((fname, err))
            continue
        title = (meta.get('title') or os.path.splitext(fname)[0])
        title = re.sub(r'【.*?】|\[.*?\]', '', title).strip()
        key = norm_title(title)
        if key in have_titles:
            dup.append((fname, have_titles[key]))
            continue
        province, year, label = guess_fields(fname, meta, title)
        if not province or not year:
            failed.append((fname, 'province=%r year=%r' % (province, year)))
            continue
        ok, why = valid(paper)
        if not ok:
            failed.append((fname, why))
            continue
        pid = re.sub(r'[^\w\u4e00-\u9fff]', '', '%s_%d_%s' % (province, year, label or '主卷'))
        base, n = pid, 1
        while pid in have_ids:
            n += 1
            pid = base + '_%d' % n
        have_ids.add(pid)
        chars = sum(len(p) for mat in paper['m'] for p in mat['p'])
        new_papers.append({'id': pid, 'r': province, 'y': year, 'l': label,
                           't': title, 'c': chars, 'm': paper['m'], 'q': paper['q']})

    print('新增 %d 套 / 与已有重复 %d 套 / 丢弃 %d 套（共 %d 个文件）' %
          (len(new_papers), len(dup), len(failed), len(os.listdir(src)) - 1))
    print('新增地区分布：', dict(sorted(collections.Counter(p['r'] for p in new_papers).items(),
                                   key=lambda x: -x[1])))
    print('新增年份：', sorted({p['y'] for p in new_papers}))
    if new_papers:
        print('平均材料字数：', int(sum(p['c'] for p in new_papers) / len(new_papers)),
              '；平均题量：%.1f' % (sum(len(p['q']) for p in new_papers) / len(new_papers)))
    print('--- 新增样例（前 8 套）---')
    for p in new_papers[:8]:
        print(' ', p['id'], '|', p['t'], '|', p['c'], '字 |', len(p['m']), '份材料 |',
              len(p['q']), '题 |', [q['sc'] for q in p['q']])
    print('--- 丢弃原因分布 ---')
    print(' ', dict(collections.Counter(w.split(' ')[0] for _, w in failed).most_common(12)))
    for f, w in failed[:12]:
        print('  [丢弃]', f, '->', w)

    if write:
        json.dump(new_papers, open(os.path.join(ROOT, 'tools/_new_exams.json'), 'w',
                                   encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
