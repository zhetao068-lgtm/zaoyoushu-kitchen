# 灶有数技术论文

| 日期 | 论文 | 可复现材料 |
| --- | --- | --- |
| 2026-11-16 | [在 1,286 道菜谱上优化中文组合搜索](01-browser-recipe-search.md) | [检索脚本](../bench/search.mjs) · [结果](../bench/search-results.json) |
| 2026-11-16 | [无账号菜谱网页的本机存储与发布包校验](02-local-pantry-security.md) | [校验脚本](../bench/audit-release.mjs) · [结果](../bench/release-audit.json) |

下载完整仓库后，在根目录用 Node.js 24 运行 `node bench/search.mjs` 和 `node bench/audit-release.mjs`。搜索基准的耗时会随运行环境变化。排序一致性和文件哈希可独立复核。
