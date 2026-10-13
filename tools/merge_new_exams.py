#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 tools/parse_slb_exams.py 解析出的新增试卷合并进 exams/：
 - 新试卷写入 exams/prov3.js（懒加载分组，不影响首屏）
 - exams/index.js 追加对应索引（已有试卷顺序与内容完全不动，避免用户本地作答记录失效）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRP = 'prov3'


def main():
    new = json.load(open(os.path.join(ROOT, 'tools/_new_exams.json'), encoding='utf-8'))
    idx_path = os.path.join(ROOT, 'exams/index.js')
    idx = json.loads(open(idx_path, encoding='utf-8').read().split('=', 1)[1].rstrip().rstrip(';'))
    have = {x['id'] for x in idx}

    added = [p for p in new if p['id'] not in have]
    # 新试卷按地区、年份排序，方便下拉框阅览
    added.sort(key=lambda p: (p['r'], -p['y']))

    grp_path = os.path.join(ROOT, 'exams/%s.js' % GRP)
    json.dump(added, open(grp_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    with open(grp_path, 'w', encoding='utf-8') as f:
        f.write('window.SH_EXAMS=(window.SH_EXAMS||[]).concat(')
        json.dump(added, f, ensure_ascii=False, separators=(',', ':'))
        f.write(');\n')
    print('写入 exams/%s.js：%d 套（%.1f MB）' %
          (GRP, len(added), os.path.getsize(grp_path) / 1024 / 1024))

    for p in added:
        idx.append({'id': p['id'], 'r': p['r'], 'y': p['y'], 'l': p['l'], 't': p['t'],
                    'c': p['c'], 'q': len(p['q']), 'grp': GRP})
    with open(idx_path, 'w', encoding='utf-8') as f:
        f.write('window.SH_EXAM_INDEX=')
        json.dump(idx, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('更新 exams/index.js：共 %d 套（新增 %d 套）' % (len(idx), len(added)))
    regions = {}
    for x in idx:
        regions[x['r']] = regions.get(x['r'], 0) + 1
    print('地区覆盖：%d 个；总字数约 %.0f 万字' %
          (len(regions), sum(x['c'] for x in idx) / 10000))


if __name__ == '__main__':
    main()
