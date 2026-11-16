# 灶有数 · Zaoyoushu Kitchen

按家里已有的食材找菜。手机上可以搜菜名、食材和做法，把要做的菜加入买菜清单，再按步骤做。

![灶有数在手机宽度下的搜菜首页](media/mobile-search.png)

## 使用

从 [发行版](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/releases/latest) 下载 ZIP，解压后用浏览器打开其中的 `index.html`。可以搜「西红柿炒鸡蛋」「鸡蛋和土豆」或「清蒸」。库存里可一次录入「鸡蛋 4 个 土豆半斤」。从同一个浏览器和入口重新打开时，可以继续使用已存的库存和做菜记录。

本版内置 **1,286 道菜谱**。其中 124 道有可换算的配料用量，支持人数、库存、缺量和买菜清单计算。其他菜谱保留来源、原方用量和做法。菜谱经过文字整理与校对。

网页无需账号。库存、选好的菜和个人做法记录保存在当前浏览器。发布文件内嵌公开菜谱及运行所需的页面、样式和脚本。 [菜谱来源与许可](DATA-SOURCES.md)

## 技术论文

- [在 1,286 道菜谱上优化中文组合搜索](papers/01-browser-recipe-search.md)
- [无账号菜谱网页的本机存储与发布包校验](papers/02-local-pantry-security.md)
- [论文目录与复现说明](papers/README.md)

## English

Zaoyoushu Kitchen is a mobile-first Chinese recipe finder and pantry planner. Search 1,286 recipes by dish name, ingredients, or cooking method. Download and open [index.html](index.html) to run the app as a standalone page. Pantry entries and personal cooking notes are stored in the current browser. The engineering reports include reproducible search measurements and a release audit.
