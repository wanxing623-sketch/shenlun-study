#!/usr/bin/env python3
"""给 index.html 里引用的本地 css / js 加上内容指纹：assets/app.js -> assets/app.js?v=1a2b3c4d

为什么要有：GitHub Pages 让浏览器把每个文件缓存 10 分钟，而且各文件各算各的。
上线（或回滚）之后这 10 分钟里，浏览器可能拿到新的 index.html，却继续用缓存里
旧的 app.js / app.css，两边对不上，页面就会报错或者样式错乱。
地址里带上指纹之后，文件内容一变地址就变，浏览器只能重新下载，不会再混用。

用法（在仓库根目录）：
    python3 tools/stamp_assets.py          # 改完 css / js 之后、提交之前跑一次
    python3 tools/stamp_assets.py --check  # 只检查，指纹过期时返回非 0
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
TAG = re.compile(r'(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#:]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")')


def stamp(html):
    seen = []

    def repl(m):
        path = ROOT / m.group(2)
        if not path.is_file():
            sys.exit("index.html 引用的文件不存在：" + m.group(2))
        digest = hashlib.sha1(path.read_bytes()).hexdigest()[:8]
        seen.append((m.group(2), digest))
        return m.group(1) + m.group(2) + "?v=" + digest + m.group(3)

    return TAG.sub(repl, html), seen


def main():
    old = INDEX.read_text(encoding="utf-8")
    new, seen = stamp(old)
    if not seen:
        sys.exit("index.html 里没有找到本地 css / js 引用")
    if "--check" in sys.argv[1:]:
        if new != old:
            sys.exit("指纹已过期：先运行 python3 tools/stamp_assets.py 再提交")
        print("指纹是最新的（%d 个文件）" % len(seen))
        return
    if new != old:
        INDEX.write_text(new, encoding="utf-8", newline="\n")
    for name, digest in seen:
        print("  %s  %s" % (digest, name))
    print("已更新 index.html" if new != old else "没有变化")


if __name__ == "__main__":
    main()
