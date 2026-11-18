# 灶有数技术论文 · Engineering Papers

| 日期 | 论文 | 可复现材料 |
| --- | --- | --- |
| 2026-11-18 | [一句话入库的食材别名与单位边界](2026-11-18/pantry-input.md)<br>Ingredient aliases and unit boundaries in one-line pantry entry | [解析实验 / Parser study](../bench/2026-11-18/pantry-input.mjs) · [结果 / Results](../bench/2026-11-18/pantry-input-results.json) |
| 2026-11-18 | [三种手机视口下的做菜流程与控件尺寸](2026-11-18/mobile-flow.md)<br>Cooking flow and control geometry at three mobile viewport sizes | [手机实验 / Mobile study](../bench/2026-11-18/mobile-flow.py) · [结果 / Results](../bench/2026-11-18/mobile-flow-results.json) |
| 2026-11-16 | [在 1,286 道菜谱上优化中文组合搜索](01-browser-recipe-search.md)<br>Optimizing multi-term Chinese search across 1,286 recipes | [检索脚本 / Search benchmark](../bench/search.mjs) · [结果 / Results](../bench/search-results.json) |
| 2026-11-16 | [无账号菜谱网页的本机存储与发布包校验](02-local-pantry-security.md)<br>Browser-local pantry storage and release verification | [校验脚本 / Release audit](../bench/audit-release.mjs) · [结果 / Results](../bench/release-audit.json) |

在仓库根目录运行各篇所列命令。Node.js 实验使用 24 系列，手机实验使用 Python 与 Playwright，具体环境见各篇正文和结果。11 月 16 日两篇的结果对应首发快照，新论文标注各自的 HTML 快照。搜索耗时和界面尺寸会随环境变化。 [首发快照](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/tree/b61d1e05fd8c59ee2ea31a40df6572b557b4536a)

Run each article's commands from the repository root. Node.js studies use the 24 series, and the mobile study uses Python and Playwright. Exact environments appear in each article and its results. The November 16 results refer to the first edition, and later articles identify their input HTML. Timings and rendered sizes vary by environment. [First edition](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/tree/b61d1e05fd8c59ee2ea31a40df6572b557b4536a)
