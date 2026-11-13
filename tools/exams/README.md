# 真题数据重建脚本

`exams/index.js`、`exams/gk.js`、`exams/prov1.js`、`exams/prov2.js` 都由 `build_exams.py` 生成，
来源是 GitHub 开源仓库 [Jinghe1279/SLB](https://github.com/Jinghe1279/SLB) 的 `data/shenlun_zhenti/`（393 份 Markdown）。

## 为什么重建

旧数据的题干、材料引用、材料正文、参考答案之间存在错位：同一道题的「根据给定资料3」
配的却是别的卷子的材料，或者材料被截断、多卷合并成一卷。重建以源文件为唯一事实来源，
每套卷的题干、材料、题号都在同一次解析里产生，不再跨卷拼接。

## 运行

```bash
# 1. 拿到上游语料（8.5MB，不进仓库）
git clone --depth 1 https://github.com/Jinghe1279/SLB /tmp/slb
cp -r /tmp/slb/data/shenlun_zhenti tools/exams/src

# 2. 重建
python3 tools/exams/build_exams.py            # 写 exams/*.js
python3 tools/exams/build_exams.py --report   # 额外打印逐卷材料数/题数/来源文件
python3 tools/exams/build_exams.py --dry      # 只解析不写文件
```

## 解析规则

- **材料切分**同时支持 `材料一`（独占行）、`材料1：正文`（行内冒号）、`　　材料二`（全角缩进）、
  `材料5`（独占行阿拉伯数字）、`资料N`；两种写法按出现位置合并排序、去重。
- **作答要求**按 `第N题：`、`N.`、`（N）` 等题号标记切分；「回答下列两个问题」这类多小问的题
  先合并成一题，再拼回 `rq`，避免把一个小问拆成两道题。
- **选源文件**不看文件名，按「材料正文二元组重合度」在该年份/省份的候选里挑最像的一份；
  重合度低于 0.60 时沿用旧数据，避免把 A 卷换成 B 卷。
- **多卷合并的源文件**（浙江 A/B/C 卷、深圳一卷/二卷等）按「作答要求」前的卷签拆开，
  每卷复用同一段材料头部，题号各自从 1 开始。
- **越界检查**：题干引用 `给定资料8` 但本卷只有 7 份材料时会在 `--report` 里报错。

## 审计

```bash
node tools/audit/audit_exams.js            # 题干-材料-题号结构审计
node tools/audit/audit_exams.js --json     # 机器可读
```

审计输出的 `qMiss`（题干引文在材料里找不到）多为题干里的自拟标题、标语口号，
并非真的串卷；真正的越界（`oor`）会单独列出。
