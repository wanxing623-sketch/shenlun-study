#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把开源公开资料整理出的内容合并进 index.html 的内嵌 DATA：
  · 规范词库：口语→规范词映射（heihei999/kaogong-formalizer）、规范词释义（niezhong2304241115-star/VocabQuizPro）
  · 对策库 / 公文速查 / 案例图谱（第七章）：tools/data/additions.json

用法：
    python3 tools/build_library.py [--formalizer <oral-to-formal-map.md>] \
                                   [--quiz-terms <terms.json>] [--write]

不带 --write 时只打印将要新增的条目统计。
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')
ADDITIONS = os.path.join(ROOT, 'tools/data/additions.json')

CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'


def read_data(html):
    i = html.index('const DATA=')
    start = i + len('const DATA=')
    depth, j, instr, esc = 0, start, False, False
    while j < len(html):
        c = html[j]
        if instr:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                instr = False
        else:
            if c == '"':
                instr = True
            elif c in '{[':
                depth += 1
            elif c in '}]':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
        j += 1
    return json.loads(html[start:j]), start, j


def clean(t):
    t = t.replace('**', '').strip()
    t = re.sub(r'[（(]注[：:].*?[)）]', '', t)
    return t.strip()


def load_formalizer(path):
    """解析 oral-to-formal-map.md 的「口语 | 规范词」表格。"""
    text = open(path, encoding='utf-8').read()
    cat = ''
    pairs = []
    for line in text.split('\n'):
        h = re.match(r'^##+\s*[一二三四五六七八九十\d]*、?\s*(.+?)\s*$', line)
        if h and '类' in h.group(1):
            cat = h.group(1).strip()
        if not line.startswith('|'):
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        if len(cells) != 2 or cells[0] in ('口语/日常表述', '口语', '---') or set(cells[0]) <= set('-: '):
            continue
        oral, term = clean(cells[0]), clean(cells[1])
        if not oral or not term:
            continue
        pairs.append({'period': '口语转规范词 · %s' % (cat or '综合'),
                      'scene': oral, 'term': term})
    return pairs


def load_quiz_terms(path):
    """VocabQuizPro 选项解析里提取的「规范词 → 适用场景」。"""
    defs = json.load(open(path, encoding='utf-8'))
    out = []
    for term, desc in defs.items():
        desc = re.sub(r'^该规范词主要适用于「', '', desc).rstrip('」')
        desc = re.sub(r'\.\.\.$|…+$', '', desc).strip()
        desc = re.sub(r'题干情景与该规范词的适用场景高度契合，因此是正确答案。?', '', desc).strip()
        if len(desc) < 8 or len(term) < 2:
            continue
        out.append({'period': '规范词释义速查', 'scene': '适用场景：' + desc, 'term': term})
    return out


def norm(s):
    return re.sub(r'[\s，。；：、！？“”‘’（）《》〈〉·—…,.:;!?()\'"\-]', '', s)


def main():
    args = sys.argv[1:]
    write = '--write' in args

    def opt(name):
        return args[args.index(name) + 1] if name in args else None

    html = open(INDEX, encoding='utf-8').read()
    data, s0, s1 = read_data(html)
    stats = {}

    # ---------- 规范词 ----------
    # 两个扩充块由脚本生成，重建时先移除旧版本，保证可重复执行且内容最新
    data['vocab'] = [x for x in data['vocab']
                     if not x['period'].startswith('口语转规范词') and x['period'] != '规范词释义速查']
    existing_terms = {norm(x['term']) for x in data['vocab']}
    existing_pairs = {(norm(x['term']), norm(x['scene'])) for x in data['vocab']}
    new_vocab = []

    fpath = opt('--formalizer')
    if fpath and os.path.exists(fpath):
        for p in load_formalizer(fpath):
            key = (norm(p['term']), norm(p['scene']))
            if key in existing_pairs:
                continue
            existing_pairs.add(key)
            new_vocab.append(p)
        stats['口语转规范词'] = len([v for v in new_vocab if v['period'].startswith('口语转规范词')])

    qpath = opt('--quiz-terms')
    if qpath and os.path.exists(qpath):
        n0 = len(new_vocab)
        for p in load_quiz_terms(qpath):
            key = (norm(p['term']), norm(p['scene']))
            if key in existing_pairs or norm(p['term']) in existing_terms:
                continue
            existing_pairs.add(key)
            new_vocab.append(p)
        stats['规范词释义速查'] = len(new_vocab) - n0

    # ---------- 对策 / 公文 / 案例 ----------
    add = json.load(open(ADDITIONS, encoding='utf-8'))
    exist_titles = {(x['title'], x['group']) for x in data['strategies']}
    new_strategies = []
    next_id = max(x['id'] for x in data['strategies']) + 1
    for s in add['strategies']:
        if (s['title'], s['group']) in exist_titles:
            continue
        new_strategies.append({'id': next_id, 'title': s['title'], 'group': s['group'], 'text': s['text']})
        next_id += 1
    stats['对策库'] = len(new_strategies)

    exist_formats = {x['name'] for x in data['formats']}
    new_formats = [f for f in add['formats'] if f['name'] not in exist_formats]
    stats['公文文种'] = len(new_formats)

    exist_cases = {(x['title'], x['section']) for x in data['cases']}
    new_cases = []
    ch = add['cases_chapter']
    for sec in add['cases']:
        sec_name = sec['section']
        for k, (title, kw, body, topics) in enumerate(sec['items']):
            full_title = title if title[0] in CIRCLED else '%s %s' % (CIRCLED[k], title)
            if (full_title, sec_name) in exist_cases:
                continue
            new_cases.append({'chapter': ch, 'section': sec_name, 'title': full_title,
                              'keywords': kw, 'case': body, 'topics': topics})
    stats['案例（第七章）'] = len(new_cases)

    print('待新增：', stats)
    print('规范词：%d → %d' % (len(data['vocab']), len(data['vocab']) + len(new_vocab)))
    print('对策：%d → %d' % (len(data['strategies']), len(data['strategies']) + len(new_strategies)))
    print('公文文种：%d → %d' % (len(data['formats']), len(data['formats']) + len(new_formats)))
    print('案例：%d → %d' % (len(data['cases']), len(data['cases']) + len(new_cases)))

    if not write:
        print('（dry-run，未写入 index.html；加 --write 生效）')
        return

    data['vocab'].extend(new_vocab)
    data['strategies'].extend(new_strategies)
    data['formats'].extend(new_formats)
    data['cases'].extend(new_cases)
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    html2 = html[:s0] + blob + html[s1:]
    open(INDEX, 'w', encoding='utf-8').write(html2)
    print('已写入 index.html：DATA 体积 %.0f KB → %.0f KB' % (len(html[s0:s1]) / 1024, len(blob) / 1024))


if __name__ == '__main__':
    main()
