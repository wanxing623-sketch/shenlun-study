#!/usr/bin/env python3
"""给 index.html 里引用的本地 css / js 加上内容指纹：assets/app.js -> assets/app.js?v=1a2b3c4d

为什么要有：GitHub Pages 让浏览器把每个文件缓存 10 分钟，而且各文件各算各的。
上线（或回滚）之后这 10 分钟里，浏览器可能拿到新的 index.html，却继续用缓存里
旧的 app.js / app.css，两边对不上，页面就会报错或者样式错乱。
地址里带上指纹之后，文件内容一变地址就变，浏览器只能重新下载，不会再混用。

懒加载的文件（练习室题库等）不在 index.html 里，指纹写进 window.SH_ASSET_V={路径: 指纹}，
由 app.js 拼 URL 时取用。

用法（在仓库根目录）：
    python3 tools/stamp_assets.py          # 改完 css / js 之后、提交之前跑一次
    python3 tools/stamp_assets.py --check  # 只检查，指纹过期时返回非 0
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
TAG = re.compile(r'(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#:]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")')
# 运行时才加载的资源，统一登记在这里
LAZY = ["exams/lab/lab-data.js", "exams/lab/lab.js"]
LAZY_TAG = re.compile(r"window\.SH_ASSET_V=\{[^}]*\};")


def digest(rel):
    path = ROOT / rel
    if not path.is_file():
        sys.exit("index.html 引用的文件不存在：" + rel)
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def stamp(html):
    seen = []

    def repl(m):
        rel = m.group(2)
        d = digest(rel)
        seen.append((rel, d))
        return m.group(1) + rel + "?v=" + d + m.group(3)

    html = TAG.sub(repl, html)
    if LAZY_TAG.search(html):
        lazy = {rel: digest(rel) for rel in LAZY}
        seen.extend(lazy.items())
        html = LAZY_TAG.sub("window.SH_ASSET_V=" + json.dumps(lazy, separators=(",", ":")) + ";", html)
    return html, seen


def main():
    old = INDEX.read_text(encoding="utf-8")
    new, seen = stamp(old)
    if not seen:
        sys.exit("index.html 里没有找到需要加指纹的脚本或样式")
    if "--check" in sys.argv:
        if new != old:
            print("指纹已过期，运行 python3 tools/stamp_assets.py 更新")
            return 1
        print("指纹检查通过（%d 个文件）" % len(seen))
        return 0
    if new == old:
        print("指纹没有变化（%d 个文件）" % len(seen))
        return 0
    INDEX.write_text(new, encoding="utf-8")
    for rel, d in seen:
        print("  %s  %s" % (d, rel))
    print("已更新 index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
