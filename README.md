申论词库 · 写作训练台
一个基于本地资料构建的申论学习工作台，当前为纯静态单文件网页，可直接部署到 GitHub Pages。

已包含
规范词库：420 条
对策模板：70 条
案例素材：560 条
公文格式速查
写作训练与答题工作台
复习中心与掌握状态
对策组合器
收藏、笔记、草稿、导入导出备份
大字号与减少动画模式
本地运行
直接双击 
index.html
 即可打开；也可以在当前目录执行：

Bash

python3 -m http.server 4173
然后访问 http://localhost:4173。

部署到 GitHub Pages
在 GitHub 新建一个仓库，例如 shenlun-study。
将 
index.html
、
.nojekyll
 和 
README.md
 上传到仓库根目录。
打开仓库的 Settings → Pages。
在 Build and deployment 中选择 Deploy from a branch。
选择 main 分支和 / (root) 目录，点击 Save。
等待 GitHub 完成部署，页面地址通常为：
text

https://你的用户名.github.io/shenlun-study/
数据说明
学习记录默认保存在浏览器本地 localStorage，不会自动同步到 GitHub。请在网页的“数据与设置”中定期导出 JSON 备份。
