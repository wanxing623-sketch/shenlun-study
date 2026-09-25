# 申论词库 · 写作训练台

一个基于本地资料构建的申论学习工作台，当前为纯静态单文件网页，可直接部署到 GitHub Pages。

## 已包含

- 规范词库：420 条
- 对策模板：70 条
- 案例素材：560 条
- 公文格式速查
- 写作训练与答题工作台
- **真题作答台**：内置 253 套国考/省考申论真题（约 166 万字），左侧阅读材料、点击或划选标注词句（四种颜色 + 橡皮），右侧题目 + 作答区，支持字数统计、自动保存、180 分钟倒计时；标注与作答分开按卷保存，可随备份导出导入
- 复习中心与掌握状态
- 对策组合器
- 收藏、笔记、草稿、导入导出备份
- 大字号与减少动画模式

## 真题数据

见 [exams/DATA-SOURCE.md](exams/DATA-SOURCE.md)。数据按分组懒加载（`exams/index.js` 常驻，其余按需加载），不影响首屏速度。

## 本地运行

直接双击 `index.html` 即可打开；也可以在当前目录执行：

```bash
python3 -m http.server 4173
```

然后访问 http://localhost:4173。

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `shenlun-study`。
2. 将 `index.html`、`exams/`、`.nojekyll` 和 `README.md` 上传到仓库根目录。
3. 打开仓库的 Settings → Pages。
4. 在 Build and deployment 中选择 Deploy from a branch。
5. 选择 main 分支和 / (root) 目录，点击 Save。
6. 等待 GitHub 完成部署，页面地址通常为：
   `https://你的用户名.github.io/shenlun-study/`

## 数据说明

- 学习记录默认保存在浏览器本地 localStorage，不会自动同步到 GitHub。请在网页的"数据与设置"中定期导出 JSON 备份（备份已包含真题的标注与作答内容）。
- 真题的标注（`sh_ws_*_hl`）、作答（`sh_ws_ans`）、计时（`sh_ws_timer`）也保存在本地。
