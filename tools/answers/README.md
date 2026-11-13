# 真题参考答案构建管线

把 GitHub 开源题库中的申论参考答案，按 **「试卷 ID + 题序」** 匹配到本项目真题作答台里的每一道题，
生成 `exams/answers-gk.js`、`exams/answers-prov1.js`、`exams/answers-prov2.js` 与 `exams/answers-meta.js`。

## 数据来源

| 来源 | 仓库 | 用途 |
| --- | --- | --- |
| 粉笔题库整理 | [ProfessorZhi/gwy-zhenti](https://github.com/ProfessorZhi/gwy-zhenti) | 主来源：国考 + 30 余省区市历年申论真题与参考答案、解析（925 份卷、3527 题） |
| 申论题库 | [zzcc-nb/gongkao-tiku](https://github.com/zzcc-nb/gongkao-tiku) | 按题干补缺：粉笔参考答案 + 答题演示（3800+ 题） |
| 国考机构解析 | [h1neolzr7f/guokao-real-exams-2022-2026](https://github.com/h1neolzr7f/guokao-real-exams-2022-2026) | 2026 国考三卷的机构答案、评分标准、范文（多来源对照） |
| 真题卷答案解析 | [36hxqw/gongkao-zhenti-knowledge](https://github.com/36hxqw/gongkao-zhenti-knowledge) | 国考 / 广东 / 湖北原卷答案解析（补缺与交叉验证） |

以上均为公开仓库中的**机器整理版**参考答案，不是官方标准答案，表述、分值拆解与真实阅卷会有差异。

## 匹配逻辑（不是按文件名硬编码）

1. **题干相似度**：中文规范化（去空格/标点、全半角、竖排兼容字）后，计算字符二元组 Dice 系数。
   先按「省份 + 年份」锁定候选卷，再按材料/题干重合度选卷，最后在整卷范围内按题干找最像的一题
   （题号只作加分），所以题序错位、多卷合并的卷子也不会把答案串到别的题上。
2. **材料重合度**：把来源试卷逐节材料在本项目整卷材料里做二元组覆盖率，按节长度加权。
   来源材料常常只是原卷的节选，所以看的是「来源材料有多少能在我方材料中找到」。
3. 只有题干 + 材料同时达标才落库，避免「同省同年、题号相同但卷子不同」串答案：
   - `high`：题干 ≥ 0.86 且材料 ≥ 0.70
   - `mid`：题干 ≥ 0.86 且材料 ≥ 0.55，或题干 ≥ 0.72 且材料 ≥ 0.70
   - `loose`：题干 ≥ 0.93 且材料 ≥ 0.35（页面上会提示谨慎参考）
   - 题干被来源截断、或本项目题干多带了「要求：…」时，Dice 会偏低；若较短题干 ≥ 90% 被另一侧覆盖
     且材料 ≥ 0.85（或覆盖 ≥ 85% 且材料 ≥ 0.90），按 `mid` 收录，避免漏掉同一道题。
4. 题序对齐：与前端 `wsNormalize` 一致，先去掉题干完全重复的题，再按下标落库；
   前端读取时优先用题序，题号只作兜底，遇到重复题号不会串题。
5. 多来源去重：同一答案相似度 ≥ 0.88 视为重复；同一来源的「参考答案一/二/三」拆开，主答案放第一版，其余进「其他来源答案」。
6. **答案三段拆分**：`a` 只留参考答案正文；`note` 放「参考答案说明」（解释答案怎么组织，属于解析）；
   `x` 放解析正文，`k` 放考点；「参考答案一/二/三」「参考范文一/二」进 `alts` 作为对照版本。
   页面上依次展示：参考答案正文 → 要点自检 → 参考答案说明（折叠）→ 其他版本（折叠）→ 解析与考点（折叠）。
7. 答案清洗：去掉图片、HTML、扫码关注等抓取残留；含「微信公众号」但带「请根据/写一篇/宣传稿」等设问词的题干行不会被误删；接回 OCR 句中硬换行，保留分条与分段。

## 运行

```bash
# 先克隆来源仓库（.cache/ 不入库）
git clone --depth 1 https://github.com/ProfessorZhi/gwy-zhenti tools/answers/.cache/gwy-zhenti
git clone --depth 1 https://github.com/zzcc-nb/gongkao-tiku  tools/answers/.cache/gongkao-tiku
git clone --depth 1 https://github.com/h1neolzr7f/guokao-real-exams-2022-2026 tools/answers/.cache/guokao-2022-2026

python3 tools/answers/build_answers.py

# 打印逐卷缺口
python3 tools/answers/build_answers.py --report
```

产物：

- `exams/answers-meta.js`：来源、生成日期、覆盖率（页面启动时加载，约 1KB）
- `exams/answers-{gk,prov1,prov2}.js`：按真题分组拆包，切卷时按需加载
- `tools/answers/report.json`：逐卷覆盖审计（可直接看缺口）

当前覆盖：**957 / 1008 题（94.9%）**，其中高置信 951 题、中等置信 5 题、宽松 1 题。
新疆 2013/2014、河南 2014、联考 2012/2013 等卷在开源题库里没有对应答案，页面显示「暂无参考答案」，不硬凑。

一致性审计：`node tools/audit/audit_answers.js`（长度不符 / 题干对不上 / 正文残留说明 三类问题会直接列出）。

## 免责声明

题库文本与参考答案版权归原命题/整理机构所有，本项目仅做个人学习用途的格式转换与题序匹配。
如来源仓库要求删除，请删除对应 `exams/answers-*.js` 并重新运行构建脚本。
