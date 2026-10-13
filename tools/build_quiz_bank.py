#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把开源题库（niezhong2304241115-star/VocabQuizPro 的《申论规范词选择题3000道》）
解析成 lazy-load 的刷题数据：quiz/index.js（题库索引）+ quiz/bank-N.js（按领域分卷）。

数据结构（尽量紧凑）：
    {i:题号, t:1单选/2多选, s:题干, o:[选项…], a:"正确答案字母", e:解析, c:领域}

用法：
    python3 tools/build_quiz_bank.py <申论规范词选择题3000道.md> [--write]
"""
import json
import os
import re
import sys
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUIZ_DIR = os.path.join(ROOT, 'quiz')
PER_FILE = 400            # 每个分卷题量（控制单文件体积，便于懒加载）


def parse_md(path):
    text = open(path, encoding='utf-8').read()
    parts = re.split(r'\n##\s*第(\d+)题（(单选题|多选题)）\s*\n', text)
    items = []
    for i in range(1, len(parts), 3):
        num, typ, body = int(parts[i]), parts[i + 1], parts[i + 2]
        body = body.split('\n---')[0]
        m = re.search(r'\*\*正确答案：([A-E]+)\*\*', body)
        if not m:
            continue
        answer = m.group(1)
        stem_part = body[:body.index('A.')] if '\nA.' in body else body
        opts = []
        for om in re.finditer(r'^([A-E])[.、．]\s*(.+?)\s*$', body, re.M):
            opts.append([om.group(1), om.group(2)])
        if len(opts) < 4:
            continue
        letters = [o[0] for o in opts]
        if any(l not in answer for l in letters[:len(answer)]) and len(answer) > len(opts):
            continue
        expl = body[m.end():]
        cat = ''
        cm = re.search(r'本题考查([^，。]{1,8}?)类?领域', expl)
        if cm:
            cat = cm.group(1)
        expl = re.sub(r'\*\*答案解析：\*\*', '', expl)
        expl = re.sub(r'💡 \*\*考点提示：\*\*.*$', '', expl, flags=re.S)
        expl = expl.replace('**', '').strip()
        expl = re.sub(r'\n{3,}', '\n\n', expl)
        stem = re.sub(r'\s+', ' ', stem_part).strip()
        if len(stem) < 8:
            continue
        items.append({'i': num, 't': 1 if typ == '单选题' else 2, 's': stem,
                      'o': [o[1] for o in opts], 'a': answer, 'e': expl, 'c': cat or '基础通用'})
    return items


def extract_defs(path):
    """从解析文本里提取「规范词 → 适用场景」，供规范词库释义使用。"""
    text = open(path, encoding='utf-8').read()
    defs = {}
    for m in re.finditer(r'^- \*\*([^*\n]+)\*\*[：:]\s*(.+)$', text, re.M):
        term, desc = m.group(1).strip(), m.group(2).strip()
        if len(term) < 2 or '选项' in desc or term in ('单选题', '多选题'):
            continue
        gm = re.search(r'「(.+?)」', desc)
        if gm:
            desc = gm.group(1)
        else:
            desc = re.sub(r'题干情景与该规范词的适用场景高度契合.*$', '', desc)
        desc = re.sub(r'（\d+/\d+）|\*\*', '', desc).strip().rstrip('。')
        desc = re.sub(r'\.{3,}|…+$', '', desc).strip()
        if len(desc) < 6:
            continue
        old = defs.get(term)
        if old is None or len(desc) > len(old):
            defs[term] = desc
    return defs


def main():
    src = sys.argv[1]
    write = '--write' in sys.argv
    items = parse_md(src)
    print('解析题目：%d 道' % len(items))
    cats = collections.Counter(x['c'] for x in items)
    print('领域分布：', dict(cats.most_common()))
    print('单选 %d / 多选 %d' % (sum(1 for x in items if x['t'] == 1),
                                 sum(1 for x in items if x['t'] == 2)))
    sizes = [len(x['s']) + sum(len(o) for o in x['o']) + len(x['e']) for x in items]
    print('平均题目体积：%d 字符；预计总数据 %.1f MB' %
          (sum(sizes) / len(sizes), sum(sizes) / 1024 / 1024))

    defs = extract_defs(src)
    print('规范词释义：%d 条' % len(defs))
    tpath = None
    if '--terms-out' in sys.argv:
        tpath = sys.argv[sys.argv.index('--terms-out') + 1]

    if not write:
        print('（dry-run，未写入 quiz/；加 --write 生效）')
        return
    if tpath:
        json.dump(defs, open(tpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('已写出规范词释义：%s' % tpath)

    os.makedirs(QUIZ_DIR, exist_ok=True)
    # 按领域归类后切分成多个分卷
    by_cat = collections.OrderedDict()
    for x in items:
        by_cat.setdefault(x['c'], []).append(x)
    banks, n = [], 0
    for cat, arr in by_cat.items():
        for k in range(0, len(arr), PER_FILE):
            chunk = arr[k:k + PER_FILE]
            n += 1
            name = 'bank-%d' % n
            with open(os.path.join(QUIZ_DIR, name + '.js'), 'w', encoding='utf-8') as f:
                f.write('window.SH_QUIZ=(window.SH_QUIZ||[]).concat(')
                json.dump(chunk, f, ensure_ascii=False, separators=(',', ':'))
                f.write(');\n')
            banks.append({'name': name, 'cat': cat, 'count': len(chunk),
                          'file': 'quiz/%s.js' % name})
    with open(os.path.join(QUIZ_DIR, 'index.js'), 'w', encoding='utf-8') as f:
        f.write('window.SH_QUIZ_INDEX=')
        json.dump(banks, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    total = sum(os.path.getsize(os.path.join(QUIZ_DIR, b['name'] + '.js')) for b in banks)
    print('已生成 %d 个分卷，共 %.2f MB' % (len(banks), total / 1024 / 1024))
    for b in banks:
        print('  %-9s %-8s %4d 题' % (b['name'], b['cat'], b['count']))


if __name__ == '__main__':
    main()
