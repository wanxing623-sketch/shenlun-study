#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 formats.json / problems.json 编译成站点可直接加载的 data/*.js。

- formats.json：24 个申论文种的结构、提醒与排版示例
- problems.json：72 条常见问题表述（按 9 类治理动作分组，并映射到对策 ID）
- 同时校验问题分组、对策 ID，并确保 index.html 已引入两个数据脚本。

用法：
    python3 tools/library/build_library.py
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LIB = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'data')
GROUPS = ['宣传引导', '制度监管', '数字赋能', '人才队伍', '资金产业', '协同治理', '疏堵结合', '权益保障', '基础设施']


def load(name):
    with open(os.path.join(LIB, name), encoding='utf-8') as f:
        return json.load(f)


def strategies():
    html = open(os.path.join(ROOT, 'data', 'library.js'), encoding='utf-8', newline='').read()
    i = html.index('const DATA=')
    j = html.index('; const FORMATS', i) if '; const FORMATS' in html[i:] else html.index(';const FORMATS', i)
    data = json.loads(html[i + len('const DATA='):j])
    return {x['id']: x for x in data['strategies']}


def write_js(path, var, payload, banner):
    text = '/* %s */\nwindow.%s=%s;\n' % (banner, var, json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return len(text.encode('utf-8'))


def ensure_tags(html):
    tags = ['<script src="data/formats.js"></script>', '<script src="data/problems.js"></script>']
    if all(t in html for t in tags):
        return html, False
    anchor = '<script src="data/library.js"></script>'
    if anchor not in html:
        raise SystemExit('index.html 中找不到 data/library.js 的引入标签')
    block = '\n'.join(tags) + '\n'
    return html.replace(anchor, block + anchor, 1), True


def main():
    fm = load('formats.json')
    pm = load('problems.json')
    formats, problems = fm['items'], pm['items']

    # ---- 校验公文 ----
    names = [x['name'] for x in formats]
    if len(set(names)) != len(names):
        raise SystemExit('公文文种重名：%s' % names)
    for f in formats:
        for k in ('name', 'cat', 'tag', 'structure', 'tip', 'checks', 'demo'):
            if k not in f or not f[k]:
                raise SystemExit('公文 %s 缺少 %s' % (f.get('name'), k))
        d = f['demo']
        if not d.get('title') or not (d.get('body') or d.get('meta')):
            raise SystemExit('公文 %s 的排版示例不完整' % f['name'])

    # ---- 校验问题 ----
    st = strategies()
    ids = [x['id'] for x in problems]
    if ids != list(range(1, len(ids) + 1)):
        raise SystemExit('问题 id 必须从 1 连续编号')
    for p in problems:
        if p['group'] not in GROUPS:
            raise SystemExit('问题 %s 的分组 %s 不在 9 类治理动作内' % (p['title'], p['group']))
        bad = [i for i in p['strategies'] if i not in st]
        if bad:
            raise SystemExit('问题 %s 引用了不存在的对策 ID：%s' % (p['title'], bad))
        if not p.get('signals'):
            raise SystemExit('问题 %s 缺少材料信号' % p['title'])

    os.makedirs(OUT, exist_ok=True)
    s1 = write_js(os.path.join(OUT, 'formats.js'), 'SH_FORMATS', formats,
                  '公文速查：%d 个文种的结构与排版示例。由 tools/library/build_library.py 生成，请勿手改。' % len(formats))
    s2 = write_js(os.path.join(OUT, 'problems.js'), 'SH_PROBLEMS', problems,
                  '问题表述库：%d 条，按 9 类治理动作分组。由 tools/library/build_library.py 生成，请勿手改。' % len(problems))

    html_path = os.path.join(ROOT, 'index.html')
    html = open(html_path, encoding='utf-8', newline='').read()
    html, changed = ensure_tags(html)
    if changed:
        with open(html_path, 'w', encoding='utf-8', newline='') as f:
            f.write(html)

    print('· data/formats.js  %d 个文种 / %.1f KB' % (len(formats), s1 / 1024))
    print('· data/problems.js %d 条问题 / %.1f KB' % (len(problems), s2 / 1024))
    print('· 分组：' + '、'.join('%s %d' % (g, sum(1 for p in problems if p['group'] == g)) for g in GROUPS))
    print('· index.html 引入脚本：' + ('已补齐' if changed else '已存在'))


if __name__ == '__main__':
    main()
