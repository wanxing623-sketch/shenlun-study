# 资料库来源说明（规范词 / 对策 / 公文 / 案例 / 金句 / 客观题）

工作台的内置资料分为「原有积累」和「本次按公开、开源资料扩充」两部分。
扩充内容全部来自**网上公开网页或 GitHub 开源仓库**，并在下方逐项标注来源，未做无出处的编造。

## 一、规范词库（868 条）

| 来源 | 条数 | 说明 |
|---|---|---|
| 原有 21 期积累 | 420 | 仓库原有内容 |
| [heihei999/kaogong-formalizer](https://github.com/heihei999/kaogong-formalizer) `references/oral-to-formal-map.md` | 200 | 口语→规范词映射，11 个分类；该表自称由华图、中公、公考通、灵鹏教育等 7 个来源交叉验证 |
| [niezhong2304241115-star/VocabQuizPro](https://github.com/niezhong2304241115-star/VocabQuizPro)（MIT）选择题解析 | 248 | 从 3000 道选择题的「正确/错误选项分析」中抽取出的规范词适用场景 |

## 二、对策库（120 条）

- 原有 70 条 + 新增 50 条（`tools/data/additions.json`）。
- 新增部分为**通用治理动作模板**（基层减负、食品安全、反诈防骗、生态补偿等），
  按「对象 + 动作 + 闭环」写法整理，并与开源仓库中 [WangJunqing-coder/shenlun-skill](https://github.com/WangJunqing-coder/shenlun-skill)（MIT）
  的“对策提出”“分论点论正”写法交叉核对。

## 三、公文速查（24 个文种）

- 原有 9 种 + 新增 15 种：讲话稿、发言稿、致辞、新闻稿、短评、简报、编者按、工作提纲、请示、批复、会议纪要、经验交流材料、慰问信、招募启事、建议书。
- 文种清单与结构参照公开公文写作规范，以及
  [WangJunqing-coder/shenlun-skill](https://github.com/WangJunqing-coder/shenlun-skill) 的 `references/gongwen-gezhi.md`（15+ 文种速查）、
  [KeWang0622/kaogong-skill](https://github.com/KeWang0622/kaogong-skill) 的公文部分整理。

## 四、案例图谱（630 条 / 8 章 63 节）

- 原有 7 章 56 节 560 条 + 新增 **第七章 科技创新与数字中国**（7 节 × 10 条 = 70 条）：
  科技自立自强、关键核心技术攻关、科技成果转化与创新生态、数字经济与数字中国、
  人工智能与智能制造、企业创新与专精特新、创新人才与科学普及。
- 新增案例取自公开报道的典型事实（北斗导航、C919、国产操作系统与芯片、合肥“科创＋产业”、
  贵州大数据、杭州“城市大脑”、智能工厂、自动化码头、华为与大疆、大国工匠等），
  关键词与适用主题按「事实 → 关键词 → 可迁移主题」重新提炼。

## 五、金句素材（191 条）

| 来源 | 条数 | 说明 |
|---|---|---|
| [WangJunqing-coder/shenlun-skill](https://github.com/WangJunqing-coder/shenlun-skill)（MIT）`references/jinju-sucai.md` | 157 | 金句 67、案例素材 45、分论点 26、人物素材 13、开头模板 3、结尾模板 3 |
| [Jinghe1279/SLB](https://github.com/Jinghe1279/SLB) `data/seed_phrases.sql` | 34 | 好词好句示例（原表标注来源：人民日报 / 求是网 / 新华网） |

## 六、客观题题库（3000 道选择题）

- 全部来自 [niezhong2304241115-star/VocabQuizPro](https://github.com/niezhong2304241115-star/VocabQuizPro)（MIT）的
  《申论规范词选择题 3000 道》。
- 领域分布：社会治理 480、经济发展 480、行政管理 480、民生保障 360、文化建设 360、生态环保 360、人才管理 360、基础通用 120；
  单选 2419、多选 581。
- 题库按领域拆成 11 个分卷（`quiz/bank-*.js`），进入刷题页才加载，不影响首屏。
- 注意：该仓库自述为「全新生成版本」，题目与解析由作者生成整理，作为**练习材料**使用，不等同官方真题。

## 七、套卷真题（278 套）

见 [`exams/DATA-SOURCE.md`](exams/DATA-SOURCE.md)。文本抓取自公开学习网站 shenlunhome.com，经
[Jinghe1279/SLB](https://github.com/Jinghe1279/SLB) 整理为 Markdown；本次新增其中的 25 套省考卷（253 → 278 套）。

## 声明

- 以上资料版权归原作者 / 原机构所有，本仓库仅作**个人学习研究**使用，请勿商用。
- 若权利人认为内容不妥，请联系删除；本仓库不含任何官方答案，真题数据仅含材料与作答要求。
- 引用来源的许可证情况：VocabQuizPro、shenlun-skill 标注 MIT；kaogong-skill 有 LICENSE；SLB 与 kaogong-formalizer 未标注许可证，仅作学习参考。
