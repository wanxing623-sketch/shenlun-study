# 资料库构建（公文速查 / 问题表述）

`data/formats.js`、`data/problems.js` 是**生成文件，请勿手改**。修改 `formats.json` 或 `problems.json` 后运行：

```bash
python3 tools/library/build_library.py
```

脚本会：

1. 读取 `formats.json`（24 种公文）与 `problems.json`（72 条问题表述）；
2. 校验文种不重名、必填字段齐全、分组存在、问题所挂对策 ID 合法；
3. 输出 `data/formats.js`（`window.SH_FORMATS`）与 `data/problems.js`（`window.SH_PROBLEMS`）；
4. 检查 `index.html` 是否已引入这两个脚本，缺失时自动补在数据脚本之前。

## 数据结构

- 公文：`{name, cat, tag, structure[], tip, checks[], demo, layout}`。`demo` 为排版例文：`{title, to, meta[], body[], end, sign, date, foot, metaFirst}`；`metaFirst` 用于简报这类「报头在标题之前」的文种。
- 问题：`{id, group, title, text, signals[], strategies[], origin}`，`strategies` 存对策 ID，详情页据此反查对策模板；`origin` 记录来源词条，便于追溯。

## 语料来源

- 问题表述与公文用语参考 GitHub 开源项目 [zzcc-nb/gongkao-tiku](https://github.com/zzcc-nb/gongkao-tiku) 的 `智能系统/规范词大全/`（问题类规范词、对策类规范词、公文规范用语），已按申论作答场景筛选、改写。
- 对策模板与公文结构、例文为本仓库整理，例文只作格式示范，内容需按题目替换。

线上页面直接加载 `data/*.js`，因此本地预览与 GitHub Pages 都需要保留该目录。
