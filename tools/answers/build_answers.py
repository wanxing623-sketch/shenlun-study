#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
真题参考答案构建脚本
====================
把 GitHub 开源题库里的申论参考答案，按「试卷 ID + 题序」匹配到本项目的真题数据，
生成 exams/answers.js（供真题作答台在作答后自检使用）。

数据来源（均为公开 GitHub 仓库）：
  1. ProfessorZhi/gwy-zhenti           粉笔题库整理的历年国考/省考申论真题 + 参考答案（主来源）
  2. zzcc-nb/gongkao-tiku              申论题库（粉笔参考答案 + 答题演示），按题干检索补缺
  3. h1neolzr7f/guokao-real-exams-2022-2026  2022–2026 国考三卷机构解析（含参考答案/评分标准/范文）
  4. 36hxqw/gongkao-zhenti-knowledge    国考 / 广东 / 湖北真题结构化数据（含逐题答案）

匹配不是按文件名硬编码，而是：
  · 题干相似度（字符二元组 Dice 系数）
  · 材料重合度（来源材料逐节在本项目整卷材料中的覆盖率）
双重校验后再落库，避免「题号相同但卷子不同」的串答案。

用法：
    python3 tools/answers/build_answers.py            # 缺缓存时自动下载
    python3 tools/answers/build_answers.py --offline  # 只用 .cache 里已有数据
    python3 tools/answers/build_answers.py --report   # 额外打印逐卷覆盖报告
"""
import argparse, collections, concurrent.futures, json, os, re, shutil, subprocess, sys, tarfile, time, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.join(os.path.dirname(__file__), '.cache')
OUT = os.path.join(ROOT, 'exams', 'answers.js')
UA = {'User-Agent': 'shenlun-study-answers-builder', 'Accept': 'application/vnd.github+json'}
API = 'https://api.github.com'

SOURCES = {
    'gwy': dict(
        id='gwy-zhenti', repo='ProfessorZhi/gwy-zhenti', branch='main',
        url='https://github.com/ProfessorZhi/gwy-zhenti',
        name='粉笔题库整理（gwy-zhenti）',
        note='粉笔题库参考答案及解析，机器抓取版，非官方答案',
    ),
    'fenbi': dict(
        id='fenbi-tiku', repo='zzcc-nb/gongkao-tiku', branch='master',
        url='https://github.com/zzcc-nb/gongkao-tiku',
        name='申论题库（gongkao-tiku）',
        note='粉笔官方参考答案 + 答题演示，按题干检索补缺',
    ),
    'jigou': dict(
        id='guokao-2022-2026', repo='h1neolzr7f/guokao-real-exams-2022-2026', branch='main',
        url='https://github.com/h1neolzr7f/guokao-real-exams-2022-2026',
        name='国考机构解析（2022–2026）',
        note='机构整理答案/评分标准/范文，非官方答案',
    ),
    'pdf': dict(
        id='zhenti-knowledge', repo='36hxqw/gongkao-zhenti-knowledge', branch='main',
        url='https://github.com/36hxqw/gongkao-zhenti-knowledge',
        name='真题卷答案解析（gongkao-zhenti-knowledge）',
        note='国考 / 广东 / 湖北原卷答案解析',
    ),
}

# ---------- 文本工具 ----------
VARIANTS = {'⻘':'青','⺠':'民','⻓':'长','⻔':'门','⻛':'风','⻥':'鱼','⻋':'车','⻢':'马','⻜':'飞','⻅':'见','⻄':'西','⻚':'页','⻉':'贝','⻝':'食','⻩':'黄','⻬':'齐','⻰':'龙','⻐':'金','⻙':'韦','⺟':'母','⻊':'足','⺩':'王','⻖':'阝','⻆':'角','⺮':'竹','⺡':'氵'}

def norm(t):
    t = t or ''
    for k, v in VARIANTS.items():
        t = t.replace(k, v)
    return re.sub(r'[\s，。；：、！？“”‘’（）《》【】〈〉·—…,.:;!?()\[\]"\'\-—－_/\\|*#`]', '', t)

def bigrams(s):
    return set(s[i:i + 2] for i in range(len(s) - 1)) or {s}

def dice(a, b):
    A, B = bigrams(a), bigrams(b)
    if not A or not B:
        return 0.0
    return 2.0 * len(A & B) / (len(A) + len(B))

def cover(a, b):
    """较短一侧的二元组被另一侧覆盖的比例（用于处理题干被截断/多加要求的情况）"""
    A, B = bigrams(a), bigrams(b)
    if not A or not B:
        return 0.0
    return len(A & B) / min(len(A), len(B))

def containment(whole, part):
    """part 的二元组有多少比例出现在 whole 里"""
    A, B = bigrams(whole), bigrams(part)
    if not A or not B:
        return 0.0
    return len(A & B) / float(len(B))

ARTIFACT = re.compile(r'^(?:——.*|—{2,}.*|.*一手最全公考资源.*|.*加微信.*|.*扫码关注.*|.{0,40}关注.{0,8}公众号.{0,40}|.{0,40}微信公众号.{0,40})$')
QUESTIONISH = re.compile(r'请(?:根据|结合|以|围绕|就|你)|作答|写一篇|概括|分析|提出|拟写|撰写|提纲|宣传稿|倡议书|短评|汇报|讲话稿|公开信')

def is_artifact(line):
    """过滤「扫码关注公众号」等推广行，但不能误伤含「微信公众号」的题干"""
    line = (line or '').strip()
    if not line or len(line) > 90:
        return False
    if QUESTIONISH.search(line):
        return False
    return bool(ARTIFACT.match(line))
NUMSTART = re.compile(r'^(?:\d{1,2}[.．、]|[（(]\d{1,2}[)）]|[一二三四五六七八九十]{1,2}[、.]|第[一二三四五六七八九十]{1,2}[条点]|标题[：:]|称谓[：:]|落款[：:]|开头[：:]|主体[：:]|结尾[：:]|【)')

def reflow(t):
    """把 OCR / 网页抓取造成的句中硬换行接回去，保留真正的分段与分条"""
    out, buf = [], ''
    def flush():
        nonlocal buf
        if buf.strip():
            out.append(buf.strip())
        buf = ''
    for line in t.split('\n'):
        s = line.strip()
        if not s:
            flush(); out.append(''); continue
        if NUMSTART.match(s):
            flush(); buf = s; continue
        if buf and len(buf) >= 24 and not re.search(r'[。！？；：”』】)】]$', buf):
            buf += s
        else:
            flush(); buf = s
    flush()
    return '\n'.join(out)

def clean_md(t):
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', t or '')
    t = re.sub(r'<[^>]+>', '', t)
    t = t.replace('**', '')
    lines = [l.strip() for l in t.split('\n')]
    lines = [l for l in lines if not is_artifact(l)]
    t = '\n'.join(lines)
    t = re.sub(r'^\s*[-*_]{3,}\s*$', '', t, flags=re.M)
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return reflow(t).strip()

def strip_lead(t):
    t = re.sub(r'</?details[^>]*>', '', t or '')
    return re.sub(r'\s+$', '', t).strip()

# ---------- 下载 ----------
def fetch_json(url):
    req = urllib.request.Request(url, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=90))

def fetch_raw(url, timeout=120):
    req = urllib.request.Request(url, headers=dict(UA, Accept='application/vnd.github.raw'))
    return urllib.request.urlopen(req, timeout=timeout).read()

def download_tarball(repo, branch, dest):
    if os.path.isdir(dest) and os.listdir(dest):
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tgz = dest + '.tar.gz'
    if not os.path.exists(tgz):
        print('  · 下载 %s@%s …' % (repo, branch))
        url = 'https://codeload.github.com/%s/tar.gz/refs/heads/%s' % (repo, branch)
        data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA['User-Agent']}), timeout=300).read()
        open(tgz, 'wb').write(data)
    tmp = dest + '.tmp'
    with tarfile.open(tgz) as tf:
        tf.extractall(tmp)
    inner = [x for x in os.listdir(tmp) if os.path.isdir(os.path.join(tmp, x))]
    shutil.move(os.path.join(tmp, inner[0]), dest)
    shutil.rmtree(tmp, ignore_errors=True)
    return dest

def ensure_sources(offline=False):
    os.makedirs(CACHE, exist_ok=True)
    # 1) gwy-zhenti：按目录抓取申论 md（仓库 1GB，全量 tarball 不划算）
    prof_dir = os.path.join(CACHE, 'gwy-zhenti')
    prof_index = os.path.join(CACHE, 'gwy-index.json')
    if not os.path.exists(prof_index):
        if offline:
            raise SystemExit('缺少 %s，请先联网运行一次' % prof_index)
        print('· 枚举 ProfessorZhi/gwy-zhenti 申论文件 …')
        repo = SOURCES['gwy']['repo']; branch = SOURCES['gwy']['branch']
        root = fetch_json('%s/repos/%s/contents/' % (API, repo))
        files = []
        for d in root:
            if d['name'] not in ('国考', '省考'):
                continue
            if d['name'] == '国考':
                tree = fetch_json('%s/repos/%s/git/trees/%s?recursive=1' % (API, repo, d['sha']))
                for x in tree['tree']:
                    if x['type'] == 'blob' and x['path'].endswith('.md') and '申论' in x['path']:
                        files.append({'path': '国考/' + x['path'], 'sha': x['sha'], 'size': x.get('size', 0)})
            else:
                provs = fetch_json(d['url'])
                for pv in provs:
                    if pv.get('type') != 'dir':
                        continue
                    tree = fetch_json('%s/repos/%s/git/trees/%s?recursive=1' % (API, repo, pv['sha']))
                    for x in tree['tree']:
                        if x['type'] == 'blob' and x['path'].endswith('.md') and '申论' in x['path']:
                            files.append({'path': '省考/%s/%s' % (pv['name'], x['path']), 'sha': x['sha'],
                                          'size': x.get('size', 0)})
        json.dump(files, open(prof_index, 'w'), ensure_ascii=False)
        print('  共 %d 个申论文件' % len(files))
    files = json.load(open(prof_index))
    os.makedirs(prof_dir, exist_ok=True)

    def one(x):
        out = os.path.join(prof_dir, x['path'].replace('/', '__'))
        if os.path.exists(out) and os.path.getsize(out) > 0:
            return 0
        if offline:
            return 0
        for attempt in range(4):
            try:
                data = fetch_raw('%s/repos/%s/git/blobs/%s' % (API, SOURCES['gwy']['repo'], x['sha']))
                open(out, 'wb').write(data)
                return 1
            except Exception:
                time.sleep(1 + attempt * 2)
        return 0

    todo = [x for x in files if not os.path.exists(os.path.join(prof_dir, x['path'].replace('/', '__')))]
    if todo and not offline:
        print('· 下载 %d 个申论文件 …' % len(todo))
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            done = sum(ex.map(one, todo))
        print('  完成 %d 个' % done)

    # 2) 其他仓库
    download_tarball(SOURCES['fenbi']['repo'], SOURCES['fenbi']['branch'], os.path.join(CACHE, 'gongkao-tiku'))
    download_tarball(SOURCES['jigou']['repo'], SOURCES['jigou']['branch'], os.path.join(CACHE, 'guokao-2022-2026'))
    pdf_jsonl = os.path.join(CACHE, 'zhenti-knowledge-shenlun.jsonl')
    if not os.path.exists(pdf_jsonl):
        if offline:
            raise SystemExit('缺少 %s' % pdf_jsonl)
        tree = fetch_json('%s/repos/%s/git/trees/%s?recursive=1' % (API, SOURCES['pdf']['repo'], SOURCES['pdf']['branch']))
        blob = [x for x in tree['tree'] if x['path'] == 'data/shenlun.jsonl'][0]
        print('· 下载 shenlun.jsonl …')
        open(pdf_jsonl, 'wb').write(fetch_raw('%s/repos/%s/git/blobs/%s' % (API, SOURCES['pdf']['repo'], blob['sha']), 300))

# ---------- 解析各来源 ----------
def parse_gwy():
    """gwy-zhenti：每份 md 内 ## 给定材料 / ## 题目，题块 ### 第 N 题"""
    d = os.path.join(CACHE, 'gwy-zhenti')
    papers = []
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.md'):
            continue
        t = open(os.path.join(d, fn), encoding='utf-8').read()
        path = fn.replace('__', '/')
        meta = {}
        m = re.match(r'---\n(.*?)\n---', t, re.S)
        if m:
            for line in m.group(1).split('\n'):
                if ':' in line:
                    k, v = line.split(':', 1)
                    meta[k.strip()] = v.strip().strip('"')
        mats = []
        mm = re.search(r'## 给定材料\s*\n(.*?)\n## 题目', t, re.S)
        if mm:
            parts = re.split(r'(?m)^### 材料\s*(\d+)\s*$', mm.group(1))
            for i in range(1, len(parts), 2):
                mats.append((int(parts[i]), clean_md(parts[i + 1])))
        qs = []
        qh = re.search(r'(?m)^## 题目\s*$', t)
        if qh:
            blocks = re.split(r'(?m)^### 第\s*(\d+)\s*题\s*$', t[qh.end():])
            for i in range(1, len(blocks), 2):
                no = int(blocks[i]); chunk = blocks[i + 1]
                head = re.split(r'(?m)^<details|\*\*参考答案|\*\*解析', chunk)[0]
                head = re.split(r'(?m)^关联材料：|^作答要求：', head)[0]
                am = re.search(r'\*\*参考答案（粉笔题库参考内容）\*\*\s*\n(.*?)(?=\n\*\*解析|\n</details>|\Z)', chunk, re.S)
                xm = re.search(r'\*\*解析\*\*\s*\n(.*?)(?=\n</details>|\Z)', chunk, re.S)
                km = re.search(r'\*\*考点\*\*[：:]\s*(.+)', chunk)
                sm = re.search(r'\*\*来源\*\*[：:]\s*(.+)', chunk)
                ans = clean_md(am.group(1)) if am else ''
                if not ans:
                    continue
                xtxt = clean_md(xm.group(1)) if xm else ''
                xtxt = re.split(r'\n?考点[：:]', xtxt)[0].strip()
                qs.append(dict(no=no, t=clean_md(head), a=ans, x=xtxt,
                               k=strip_lead(km.group(1)) if km else '',
                               ref=strip_lead(sm.group(1)).replace('</details>', '').strip() if sm else ''))
        if qs:
            papers.append(dict(src='gwy', path=path, meta=meta, mats=mats, qs=qs))
    return papers

def parse_fenbi():
    """gongkao-tiku：每个 md 就是一道题"""
    d = os.path.join(CACHE, 'gongkao-tiku', '申论题库')
    out = []
    for dirpath, _, names in os.walk(d):
        for fn in names:
            if not fn.endswith('.md') or fn == 'README.md':
                continue
            p = os.path.join(dirpath, fn)
            t = open(p, encoding='utf-8').read()
            src = re.search(r'> \*\*来源\*\*：(.+)', t)
            num = re.search(r'> \*\*编号\*\*：(\d+)', t)
            q = re.search(r'## 📌 题目\s*\n(.*?)\n## 📖', t, re.S)
            a = re.search(r'## ✅ 参考答案\s*\n(.*?)(?=\n## |\Z)', t, re.S)
            mat = re.search(r'## 📖 给定材料\s*\n(.*?)\n## ✅', t, re.S)
            if not (q and a and a.group(1).strip()):
                continue
            ans = clean_md(a.group(1))
            ans = re.split(r'\n参考答案说明[：:]', ans)[0].strip()
            rel = os.path.relpath(p, os.path.join(CACHE, 'gongkao-tiku')).replace(os.sep, '/')
            out.append(dict(src='fenbi', path=rel,
                            ref=strip_lead(src.group(1)) if src else '',
                            num=num.group(1) if num else '',
                            t=clean_md(q.group(1)), a=ans, x='',
                            k='', mats=[(1, clean_md(mat.group(1)))] if mat else []))
    return out

def parse_jigou():
    """2026 国考三卷机构解析"""
    d = os.path.join(CACHE, 'guokao-2022-2026', '2026')
    out = []
    for fn in sorted(os.listdir(d)):
        if '机构解析' not in fn or not fn.endswith('.md'):
            continue
        t = open(os.path.join(d, fn), encoding='utf-8').read()
        # 卷别
        vol = re.search(r'《申论》·\s*([^·\s]+)\s*卷', t)
        blocks = re.split(r'(?m)^第[一二三四五六七八九十\d]+题[：:]', t)
        for chunk in blocks[1:]:
            head = re.split(r'(?m)^###\s', chunk)[0]
            am = re.search(r'(?m)^### 四、参考答案\s*\n(.*?)(?=\n### 五、)', chunk, re.S) or \
                 re.search(r'(?m)^### 四、高分范文\s*\n(.*?)(?=\n### 五、)', chunk, re.S)
            sm = re.search(r'(?m)^### 五、评分标准\s*\n(.*?)(?=\n第[一二三四五六七八九十\d]+题[：:]|\Z)', chunk, re.S)
            if not am:
                continue
            out.append(dict(src='jigou', path='2026/' + fn, ref='2026 国考（%s）机构解析' % (vol.group(1) if vol else fn),
                            t=clean_md(head), a=clean_md(am.group(1)), x=clean_md(sm.group(1)) if sm else '',
                            k='机构解析', mats=[]))
    return out

def parse_pdf():
    """36hxqw 结构化 jsonl：一行一题"""
    p = os.path.join(CACHE, 'zhenti-knowledge-shenlun.jsonl')
    out = []
    for line in open(p, encoding='utf-8'):
        try:
            r = json.loads(line)
        except Exception:
            continue
        ans = (r.get('ans') or '').strip()
        if not ans:
            continue
        out.append(dict(src='pdf', path=r.get('paper', ''), ref=r.get('paper', ''), no=r.get('no', ''),
                        t=clean_md(r.get('stem', '')), a=clean_md(ans), x='',
                        k=r.get('type', ''), mats=[]))
    return out

# ---------- 本项目真题 ----------
def load_groups():
    groups = {}
    for grp in ('gk', 'prov1', 'prov2'):
        js = r'''
const fs=require("fs"),vm=require("vm");const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync("exams/%s.js","utf8"),ctx);
console.log(JSON.stringify((ctx.window.SH_EXAMS||[]).map(e=>e.id)));''' % grp
        try:
            groups[grp] = set(json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT).decode()))
        except Exception:
            groups[grp] = set()
    return groups

def load_exams():
    js = r'''
const fs=require("fs"),vm=require("vm");const ctx={window:{}};vm.createContext(ctx);
for(const f of ["exams/gk.js","exams/prov1.js","exams/prov2.js"])vm.runInContext(fs.readFileSync(f,"utf8"),ctx);
console.log(JSON.stringify(ctx.window.SH_EXAMS.map(e=>({id:e.id,r:e.r,y:e.y,l:e.l,t:e.t,m:e.m.map(x=>x.p.join("")),q:e.q.map(q=>({no:q.no,t:q.t,rq:q.rq,sc:q.sc}))}))));'''
    out = subprocess.check_output(['node', '-e', js], cwd=ROOT)
    exams = json.loads(out.decode('utf-8'))
    # 与前端 wsNormalize 保持一致：题干完全相同的重复题只保留第一题，保证「题序」对齐
    for e in exams:
        seen, qs = set(), []
        for q in e['q']:
            k = re.sub(r'\s', '', q.get('t') or '')
            if k and k in seen:
                continue
            if k:
                seen.add(k)
            qs.append(q)
        e['q'] = qs
    return exams

# ---------- 匹配 ----------
def mat_score(our_mat, mats):
    """来源每节材料在本项目整卷材料中的覆盖率，按节长度加权"""
    if not mats:
        return None
    total = 0.0; hit = 0.0
    for n, text in mats:
        nm = norm(text)
        if len(nm) < 80:
            continue
        total += len(nm)
        hit += containment(our_mat, nm) * len(nm)
    if total == 0:
        return None
    return hit / total

def classify(stem, mat, cov=0.0):
    if mat is None:  # 来源不含材料，只能靠题干（很少）
        return 'loose' if stem >= 0.95 else None
    if stem >= 0.86 and mat >= 0.70:
        return 'high'
    if (stem >= 0.86 and mat >= 0.55) or (stem >= 0.72 and mat >= 0.70):
        return 'mid'
    # 题干一侧被截断（来源只留前半句）或本项目多带了「要求：…」，Dice 会偏低；
    # 此时若较短题干几乎完全被另一侧包含、且材料高度重合，仍可判定为同一题。
    if (mat >= 0.85 and cov >= 0.90 and stem >= 0.42) or (mat >= 0.90 and cov >= 0.85 and stem >= 0.45):
        return 'mid'
    if stem >= 0.93 and mat >= 0.35:
        return 'loose'
    return None

VAR_RE = re.compile(r'(?m)^\s*参考答案([一二三四五六七八九十\d]+)\s*$')

def split_variants(t):
    """把同一来源里的「参考答案一 / 参考答案二」拆开，主答案只留第一版，其余放到对照区"""
    ms = list(VAR_RE.finditer(t or ''))
    if not ms:
        return [(None, (t or '').strip())]
    out = []
    pre = (t[:ms[0].start()] or '').strip()
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(t)
        body = (t[m.end():end] or '').strip()
        if body:
            out.append((m.group(1), body))
    if pre and out:
        out[0] = (out[0][0], (pre + '\n' + out[0][1]).strip())
    return out or [(None, (t or '').strip())]

def qtype(t):
    t = t or ''
    if re.search(r'写一篇(文章|文章。)|自拟题目|为题[，,]写一篇|写一篇议论文', t):
        return 'zuowen'
    if re.search(r'倡议书|公开信|讲话稿|发言稿|短评|时评|评论|编者按|简报|通知|通告|报告|汇报|工作方案|建议书|宣传稿|提纲|主持词|导学|解说词|新闻稿', t):
        return 'zhixing'
    if re.search(r'对策|建议|措施|如何解决|提出解决|整治方案', t):
        return 'duice'
    if re.search(r'谈谈|理解|看法|分析|评价|启示|原因', t):
        return 'zonghe'
    return 'guina'

def split_points(ans, typ):
    ans = ans.strip()
    if not ans:
        return []
    lines = [l.strip() for l in ans.split('\n') if l.strip()]
    items = []
    cur = ''
    starter = re.compile(r'^(?:参考(?:答案|范文|文章)[一二三四五六七八九十\d]*[：:]?|答案[一二三四五六七八九十\d]*[：:]?)$|^(?:\d{1,2}[.．、]|[（(]\d{1,2}[)）]|[一二三四五六七八九十]{1,2}[、.]|第[一二三四五六七八九十]{1,2}[条点])')
    for line in lines:
        if starter.match(line):
            if cur:
                items.append(cur)
            cur = line
        else:
            cur = (cur + '\n' + line).strip() if cur else line
    if cur:
        items.append(cur)
    # 去掉纯标题项
    items = [x for x in items if len(re.sub(r'[\s\d.．、（）()一二三四五六七八九十第条点：:]', '', x)) >= 8]
    if len(items) < 2:
        raw = re.split(r'(?<=[。；;])', ans)
        items = [x.strip() for x in raw if len(x.strip()) >= 12]
    # 合并过短项
    merged = []
    for x in items:
        if merged and len(x) < 12:
            merged[-1] += x
        else:
            merged.append(x)
    if typ == 'zuowen':
        return merged[:10]
    return merged[:10]

# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', action='store_true')
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()

    ensure_sources(offline=args.offline)
    print('· 解析来源 …')
    papers_g = parse_gwy()
    flat_f = parse_fenbi()
    flat_j = parse_jigou()
    flat_p = parse_pdf()
    print('  gwy %d 卷 / %d 题；fenbi %d 题；jigou %d 题；pdf %d 题'
          % (len(papers_g), sum(len(p['qs']) for p in papers_g), len(flat_f), len(flat_j), len(flat_p)))

    exams = load_exams()
    print('  本项目 %d 卷 / %d 题' % (len(exams), sum(len(e['q']) for e in exams)))

    # 为 gwy 每题附卷材料，建立索引
    g_items = []
    for p in papers_g:
        pm = ''.join(x[1] for x in p['mats'])
        for q in p['qs']:
            g_items.append(dict(src='gwy', path=p['path'], ref=q['ref'], no=q['no'], t=q['t'], a=q['a'], x=q['x'],
                                k=q['k'], mats=p['mats'], n=norm(q['t']), b=bigrams(norm(q['t']))))
    f_items = []
    for r in flat_f:
        f_items.append(dict(src='fenbi', path=r['path'], ref=r['ref'], no=0, t=r['t'], a=r['a'], x=r['x'], k=r['k'],
                            mats=r['mats'], n=norm(r['t']), b=bigrams(norm(r['t']))))
    j_items = [dict(src='jigou', path=r['path'], ref=r['ref'], no=0, t=r['t'], a=r['a'], x=r['x'], k=r['k'],
                    mats=r['mats'], n=norm(r['t']), b=bigrams(norm(r['t']))) for r in flat_j]
    p_items = [dict(src='pdf', path=r['path'], ref=r['ref'], no=r['no'], t=r['t'], a=r['a'], x=r['x'], k=r['k'],
                    mats=r['mats'], n=norm(r['t']), b=bigrams(norm(r['t']))) for r in flat_p]

    # 题干倒排索引（gwy + fenbi 主检索池）
    def build_index(items):
        inv = collections.defaultdict(list)
        for i, r in enumerate(items):
            for g in r['b']:
                inv[g].append(i)
        return inv
    inv_g = build_index(g_items)
    inv_f = build_index(f_items)

    def candidates(nq, inv, items, top=40):
        c = collections.Counter()
        for g in bigrams(nq):
            for i in inv.get(g, ()):
                c[i] += 1
        return [i for i, _ in c.most_common(top)]

    out = {}
    report = []
    stats = collections.Counter()
    for e in exams:
        our_mat = norm(''.join(e['m']))
        arr = []
        for q in e['q']:
            nq = norm(q['t'])
            cand = []
            # 主来源 gwy
            for i in candidates(nq, inv_g, g_items):
                r = g_items[i]
                stem = dice(nq, r['n'])
                cov = cover(nq, r['n'])
                if stem < 0.70 and cov < 0.85:
                    continue
                tier = classify(stem, mat_score(our_mat, r['mats']), cov)
                if tier:
                    cand.append((tier, stem, r))
            # 补缺：fenbi
            for i in candidates(nq, inv_f, f_items):
                r = f_items[i]
                stem = dice(nq, r['n'])
                cov = cover(nq, r['n'])
                if stem < 0.70 and cov < 0.85:
                    continue
                tier = classify(stem, mat_score(our_mat, r['mats']), cov)
                if tier:
                    cand.append((tier, stem, r))
            # 国考 2026 机构解析：按卷 + 题序对齐（题干仍校验）
            for r in j_items:
                vol = e['l'] or ''
                if e['r'] != '国考' or e['y'] != 2026:
                    continue
                if vol and vol not in r['ref']:
                    continue
                stem = dice(nq, r['n'])
                if stem >= 0.70:
                    cand.append(('high' if stem >= 0.86 else 'mid', stem, r))
            # 36hxqw：同省同年 + 题号/题干预校验
            for r in p_items:
                if r['path'].split('-')[0] != e['r']:
                    continue
                if str(e['y']) not in r['path']:
                    continue
                stem = dice(nq, r['n'])
                if stem >= 0.75:
                    cand.append(('high' if stem >= 0.80 else 'mid', stem, r))

            if not cand:
                arr.append(None)
                stats['miss'] += 1
                continue

            rank = {'high': 0, 'mid': 1, 'loose': 2}
            cand.sort(key=lambda x: (rank[x[0]], -x[1]))
            # 去重（同一份答案不同来源）
            picked = []
            for tier, stem, r in cand:
                na = norm(r['a'])
                dup = False
                for p in picked:
                    if len(na) > 40 and dice(na, norm(p['a'])) >= 0.88:
                        dup = True
                        # 保留信息更全的一条
                        if len(r['a']) > len(p['a']) and rank[tier] <= rank[p['tier']]:
                            p.update(a=r['a'], src=r['src'], path=r['path'], ref=r['ref'], tier=tier,
                                     stem=stem, x=r['x'] or p.get('x', ''), k=r['k'] or p.get('k', ''))
                        break
                if not dup:
                    picked.append(dict(tier=tier, stem=stem, src=r['src'], path=r['path'], ref=r['ref'],
                                       a=r['a'], x=r['x'], k=r['k'], no=r['no']))
                if len(picked) >= 3:
                    break
            if not picked:
                arr.append(None); stats['miss'] += 1; continue

            best = picked[0]

            def clip(t, n):
                t = (t or '').strip()
                return t if len(t) <= n else t[:n].rstrip() + '…'

            variants = split_variants(best['a'])
            main_a = variants[0][1]
            item = dict(
                no=q['no'], tier=best['tier'],
                src=best['src'], path=best['path'], ref=best['ref'],
                a=clip(main_a, 3000), x=clip(best['x'], 700) if best['x'] else '',
                k=clip(best['k'], 100) if best['k'] else '',
            )
            alts = []
            for lbl, body in variants[1:]:
                alts.append(dict(src=best['src'], path=best['path'], ref=best['ref'], a=clip(body, 1500),
                                 tier=best['tier'], label='参考答案' + lbl))
            for p in picked[1:]:
                alts.append(dict(src=p['src'], path=p['path'], ref=p['ref'], a=clip(p['a'], 1500), tier=p['tier']))
            if alts:
                item['alts'] = alts[:3]
            arr.append(item)
            stats[best['tier']] += 1
        out[e['id']] = arr
        n = sum(1 for x in arr if x)
        report.append((e['id'], n, len(arr)))

    total = sum(len(v) for v in out.values())
    covered = sum(1 for v in out.values() for x in v if x)
    meta = dict(
        generated=time.strftime('%Y-%m-%d'),
        total=total, covered=covered,
        tiers={k: stats[k] for k in ('high', 'mid', 'loose', 'miss')},
        sources=[{k: v for k, v in s.items() if k in ('id', 'repo', 'url', 'name', 'note')} for s in SOURCES.values()],
    )
    groups = load_groups()
    head = ('/* 由 tools/answers/build_answers.py 自动生成，请勿手改。\n'
            '   参考答案来自 GitHub 开源题库，仅供学习自检，非官方答案。 */\n')
    open(os.path.join(ROOT, 'exams', 'answers-meta.js'), 'w', encoding='utf-8').write(
        head + 'window.SH_ANSWER_META=%s;\n' % json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    for grp, ids in groups.items():
        part = {k: v for k, v in out.items() if k in ids}
        if not part:
            continue
        open(os.path.join(ROOT, 'exams', 'answers-%s.js' % grp), 'w', encoding='utf-8').write(
            head + 'window.SH_ANSWERS=Object.assign(window.SH_ANSWERS||{},%s);\n'
            % json.dumps(part, ensure_ascii=False, separators=(',', ':')))
        print('  · exams/answers-%s.js  %d 卷 %.2f MB' % (
            grp, len(part), os.path.getsize(os.path.join(ROOT, 'exams', 'answers-%s.js' % grp)) / 1048576.0))
    if os.path.exists(OUT):
        os.remove(OUT)
    json.dump({'meta': meta, 'report': report}, open(os.path.join(os.path.dirname(__file__), 'report.json'), 'w'),
              ensure_ascii=False, indent=1)
    print('· 完成：%d/%d 题有答案（高 %d / 中 %d / 宽松 %d）'
          % (covered, total, stats['high'], stats['mid'], stats['loose']))
    full = [x for x in report if x[1] == x[2]]
    print('  整卷全覆盖 %d 卷；有答案的卷 %d 卷' % (len(full), sum(1 for x in report if x[1])))
    if args.report:
        for eid, n, t in report:
            if n < t:
                print('  缺 %d/%d  %s' % (t - n, t, eid))

if __name__ == '__main__':
    main()
