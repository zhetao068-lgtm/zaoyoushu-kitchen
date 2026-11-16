# 灶有数技术论文 · Engineering Papers

| 日期 | 论文 | 可复现材料 |
| --- | --- | --- |
| 2026-11-16 | [在 1,286 道菜谱上优化中文组合搜索](01-browser-recipe-search.md)<br>Optimizing multi-term Chinese search across 1,286 recipes | [检索脚本 / Search benchmark](../bench/search.mjs) · [结果 / Results](../bench/search-results.json) |
| 2026-11-16 | [无账号菜谱网页的本机存储与发布包校验](02-local-pantry-security.md)<br>Browser-local pantry storage and release verification | [校验脚本 / Release audit](../bench/audit-release.mjs) · [结果 / Results](../bench/release-audit.json) |

下载完整仓库后，在根目录用 Node.js 24 运行 `node bench/search.mjs` 和 `node bench/audit-release.mjs`。搜索基准的耗时会随运行环境变化。排序一致性和文件哈希可独立复核。

Run `node bench/search.mjs` and `node bench/audit-release.mjs` from the repository root with Node.js 24. Benchmark timings vary by machine. The result order and release hashes can be checked independently.
