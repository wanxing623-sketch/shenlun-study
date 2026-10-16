# tools · 数据构建脚本

本目录存放**把公开 / 开源资料整理进工作台**的一次性脚本与中间数据。
脚本都可重复执行（幂等），重复运行不会重复追加内容。

| 脚本 | 作用 | 输入 | 输出 |
|---|---|---|---|
| `parse_slb_exams.py` | 解析 [Jinghe1279/SLB](https://github.com/Jinghe1279/SLB) 的申论真题 Markdown | `data/shenlun_zhenti/*.md` | `tools/_new_exams.json`（默认 dry-run，加 `--write`） |
| `merge_new_exams.py` | 把新增真题并入真题库（只追加，不动既有卷 id） | `tools/_new_exams.json` | `exams/prov3.js` + `exams/index.js` |
| `build_library.py` | 扩充内嵌 DATA：规范词 / 对策 / 公文 / 案例 | `tools/data/additions.json`、口语→规范词表、规范词释义表 | `index.html` 的 `const DATA={…}` |
| `build_quiz_bank.py` | 生成客观题题库并抽取规范词释义 | VocabQuizPro 的《申论规范词选择题3000道.md》 | `quiz/index.js` + `quiz/bank-N.js`、`tools/data/vocabquiz_terms.json` |
| `build_quotes.py` | 生成金句素材库 | `jinju-sucai.md`、SLB `seed_phrases.sql` | `tools/data/quotes.json` + `index.html` 的 `DATA.quotes` |

## 复现命令

```bash
# 1) 真题：253 → 278 套
python3 tools/parse_slb_exams.py            # 先看统计
python3 tools/parse_slb_exams.py --write    # 写出 tools/_new_exams.json
python3 tools/merge_new_exams.py            # 写入 exams/

# 2) 规范词（口语→规范词 200 条 + 规范词释义 248 条）、对策 50 条、公文 15 种、案例第 7 章 70 条
python3 tools/build_library.py \
  --formalizer <oral-to-formal-map.md> \
  --quiz-terms tools/data/vocabquiz_terms.json --write

# 3) 客观题题库 3000 道（按领域分为 11 卷，lazy-load）
python3 tools/build_quiz_bank.py "<申论规范词选择题3000道.md>" \
  --terms-out tools/data/vocabquiz_terms.json --write

# 4) 金句素材 191 条
python3 tools/build_quotes.py --jinju <jinju-sucai.md> --phrases <seed_phrases.sql> --write
```

> 远端置文件需要先从对应开源仓库下载（见根目录 `LIBRARY-SOURCE.md`）。
> `build_library.py` 修改 `index.html` 时使用**花括号配对扫描**替换 `const DATA={…}`，
> 不会重新序列化整个文件；`exams/*.js` 使用追加式新分组文件，绝不改写既有卷面 id。

## 中间数据

- `tools/data/additions.json`：人工整理并核对开源资料后新增的对策 / 公文 / 案例（第七章）。
- `tools/data/vocabquiz_terms.json`：从选择题解析中抽取的「规范词 → 适用场景」。
- `tools/data/quotes.json`：金句素材中间产物。
- `tools/_new_exams.json`：新增真题中间产物（`exams/prov3.js` 已包含同样内容）。
