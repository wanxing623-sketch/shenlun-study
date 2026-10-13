#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建「金句素材」库并合并进 index.html 的内嵌 DATA.quotes。

来源（均为公开 / 开源仓库）：
  1. WangJunqing-coder/shenlun-skill · references/jinju-sucai.md（MIT）
     按主题分类的金句、分论点模板、开头/结尾模板、人物素材
  2. Jinghe1279/SLB · data/seed_phrases.sql
     好词好句示例数据（标注来源：人民日报 / 求是网 / 新华网）

用法：
    python3 tools/build_quotes.py --jinju <jinju-sucai.md> --phrases <seed_phrases.sql> [--write]
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')
OUT = os.path.join(ROOT, 'tools/data/quotes.json')

CN = '一二三四五六七八九十'


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
    return html[start:j], start, j


def sec_title(line):
    m = re.match(r'^#{2,3}\s*(?:[一二三四五六七八九十]+、)?\s*(\d+(?:\.\d+)?)?\s*(.+?)\s*$', line)
    if not m:
        return None
    return (m.group(1) or '', m.group(2).strip())


def parse_jinju(path):
    """jinju-sucai.md：金句 / 案例 / 分论点 / 人物 / 开头结尾模板"""
    quotes = []
    theme, sub, subsub = '', '', ''
    for line in open(path, encoding='utf-8').read().split('\n'):
        if line.startswith('#### '):
            subsub = line[5:].strip()
        elif line.startswith('## '):
            theme, sub, subsub = sec_title(line)[1], '', ''
        elif line.startswith('### '):
            sub, subsub = sec_title(line)[1], ''
        elif re.match(r'^\d+\.\s+', line) and sub == '金句':
            text = re.sub(r'^\d+\.\s+', '', line).strip()
            if len(text) > 6:
                quotes.append({'topic': re.sub(r'类$', '', theme), 'use': '金句',
                               'text': text, 'source': 'shenlun-skill 金句素材库'})
        elif line.startswith('|') and sub.startswith('案例'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            if len(cells) == 3 and cells[0] not in ('案例', '内容') and not set(cells[0]) <= set('-: '):
                quotes.append({'topic': re.sub(r'类$', '', theme), 'use': '案例素材',
                               'text': cells[0] + '：' + cells[1],
                               'source': 'shenlun-skill 金句素材库 · 适用主题：' + cells[2]})
        elif line.startswith('|') and sub.endswith('楷模') or (line.startswith('|') and sub == '历史人物'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            if len(cells) == 3 and cells[0] not in ('人物',) and not set(cells[0]) <= set('-: '):
                quotes.append({'topic': '人物素材', 'use': '人物素材',
                               'text': cells[0] + '：' + cells[1] + '（' + cells[2] + '）',
                               'source': 'shenlun-skill 金句素材库'})
        elif line.startswith('- 分论点') and sub == '分论点模板':
            text = re.sub(r'^-\s*', '', line).strip()
            if len(text) > 6:
                quotes.append({'topic': re.sub(r'类$', '', theme), 'use': '分论点',
                               'text': text, 'source': 'shenlun-skill 金句素材库'})
        elif line.startswith('> ') and subsub:
            use = '开头模板' if sub.startswith('开头') else '结尾模板' if sub.startswith('结尾') else None
            text = line[2:].strip()
            if use and len(text) > 8:
                quotes.append({'topic': subsub, 'use': use, 'text': text,
                               'source': 'shenlun-skill 金句素材库'})
    return quotes


def parse_phrases(path):
    """SLB seed_phrases.sql → 好词好句（按 tag 分类）"""
    text = open(path, encoding='utf-8').read()
    rows = []
    for m in re.finditer(r"\('((?:[^'\\]|\\.)*)',\s*'([^']*)',\s*'(\[[^\]]*\])'", text):
        phrase = m.group(1).replace("\\'", "'")
        src = m.group(2)
        try:
            tags = json.loads(m.group(3))
        except Exception:
            tags = []
        kind = tags[0] if tags else '好词好句'
        rows.append({'topic': kind, 'use': '好词好句', 'text': phrase, 'source': src})
    return rows


def main():
    args = sys.argv[1:]
    write = '--write' in args

    def opt(n):
        return args[args.index(n) + 1] if n in args else None

    quotes = []
    if opt('--jinju'):
        quotes += parse_jinju(opt('--jinju'))
    if opt('--phrases'):
        quotes += parse_phrases(opt('--phrases'))

    # 去重
    seen, uniq = set(), []
    for q in quotes:
        k = re.sub(r'\s+', '', q['text'])
        if k in seen or len(q['text']) < 6:
            continue
        seen.add(k)
        uniq.append(q)
    quotes = uniq

    print('金句素材：%d 条' % len(quotes))
    import collections
    print('  use:', dict(collections.Counter(q['use'] for q in quotes)))
    print('  topic 前 8:', collections.Counter(q['topic'] for q in quotes).most_common(8))
    for q in quotes[:2] + quotes[-2:]:
        print('   示例:', q['use'], '|', q['topic'], '|', q['text'][:44])

    if not write:
        print('（dry-run，未写入；加 --write 生效）')
        return

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(quotes, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    html = open(INDEX, encoding='utf-8').read()
    blob, s0, s1 = read_data(html)
    data = json.loads(blob)
    old = data.get('quotes', [])
    old_keys = {re.sub(r'\s+', '', q['text']) for q in old}
    added = [q for q in quotes if re.sub(r'\s+', '', q['text']) not in old_keys]
    data['quotes'] = old + added
    new_blob = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    open(INDEX, 'w', encoding='utf-8').write(html[:s0] + new_blob + html[s1:])
    print('已写入 index.html：quotes %d → %d' % (len(old), len(data['quotes'])))


if __name__ == '__main__':
    main()
