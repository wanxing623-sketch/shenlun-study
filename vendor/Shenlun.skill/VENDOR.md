# 第三方引入说明：Shenlun.skill

- 上游仓库：https://github.com/coffe-d/Shenlun.skill
- 许可证：MIT（原文见本目录 LICENSE）
- 引入版本：commit `354341cdce1f357bb78c24f05a929a339cd7f4cf`（`354341c` 系列）
- 内容：小马哥（B 站）、白鹭（半月谈）、袁东（大作文专项班）方法论整理成的 Agent Skill 文本。上游作者声明其来源为公开渠道资料。

## 本仓库如何使用

- `index.html` 的批改引擎（真题作答台 · 五阅卷官）已接入其中的规则：
  - **表述升级表**（expression-upgrade-rules.md §2.1、§2.3、§三）→ 规范表达官的替换建议（仅提示，不单独扣分）
  - **作答铁律**（writing-rules.md）→ 结构逻辑官的提示：无采分点废话（「借鉴XX做法」）、去水词、要点中的情态动词
  - **总括句规则**（scoring-rules.md §二、README 硬规则）→ 归纳概括题不再因「缺总括句」提示扣分
- 本目录的 `skills/` 本身是 Agent Skill（需要 LLM 读取 SKILL.md 执行），**不会被网页直接加载**。想在 Claude Code 等 agent 中使用，参见上游 README「安装」一节。

## 未接入的部分

- 大作文「袁东累进四类文」完整判定、AB/ABC 型判定（依赖 LLM 逐段理解）
- 白鹭/小马哥双视角参考作答（需要生成式模型）
- 错题库、图片识读、docx 导出（需要额外界面或后端）
- `_tools/`（讲义提取工具，与批改无关）与上游 `_sources/`（含版权材料，未收录）

## 修改记录

- 仅复制上游文件，未改动原文。如需更新，重新从上游拷贝 `skills/`、`LICENSE`、`README.md` 并更新本文件的 commit。
