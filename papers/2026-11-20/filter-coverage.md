# 结构化字段如何限制菜谱筛选覆盖范围

*How structured fields limit recipe-filter coverage*

灶有数工程论文 · 北京时间 2026 年 11 月 20 日

## 摘要

菜谱总数、可按时间筛选的数量和可自动核对用量的数量各有自己的数据条件。本实验审计公开离线包的全部 1,349 条搜索记录，并运行 144 组人数、库存、分类与范围组合。187 条记录具备正数分钟字段与结构化用量，其中 102 条分钟数不超过 20。其余 1,162 条缺少这两个字段。在上限合成库存下，「家里能做」返回 187 条，「20 分钟内」返回 102 条。1 至 8 人份的结果数量相同，交叉选择「无肉主料（定量）」后分别返回 103 和 75 条。 [审计脚本](../../bench/2026-11-20/filter-coverage.mjs) · [字段与组合结果](../../bench/2026-11-20/filter-coverage-results.json)

## English abstract

We audited all 1,349 records in the public offline search index and ran 144 combinations of serving count, stock fixture, category and search scope. All 187 measured recipes had positive numeric minute fields and structured ingredient needs, and 102 had minute values at most 20. The other 1,162 records had neither field. With every known ingredient set to its permitted maximum quantity, the ready-to-cook filter returned 187 recipes and the 20-minute filter returned 102. Combining the measured meat-free-main-ingredient category with these scopes returned 103 and 75 respectively. These counts held from one to eight servings. Empty and explicit-zero stock both produced no ready-to-cook results. The study measures current field availability and filter behavior, with no cooking-time trials, nutritional claims or relevance judgments. [Script](../../bench/2026-11-20/filter-coverage.mjs) · [Results](../../bench/2026-11-20/filter-coverage-results.json)

## 问题与方法

首页的筛选通过同一个搜索索引工作，但每种范围依赖不同字段。「20 分钟内」要求 minutes 大于 0 且不超过 20。「家里能做」要求菜谱属于定量类型，并出现在库存模型计算出的可做集合中。「无肉主料（定量）」同样限定定量类型，再检查主料分组。 [发布版筛选代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/d5f1dacb2f2fda4b7b7322c0dff2a3afd1a4ef41/index.html#L3468)

实验复用已经公开的加载器，读取内嵌菜谱与扩充索引，执行实际的 Cookbook.search 和 MealModel.searchRecipes。可做集合按页面 renderLibrary 的顺序生成，先计算定量菜的库存匹配，再把 fits 为真的编号交给搜索函数。查询文本留空，已选菜单为空。每条返回结果记录类型，核对编号没有重复，并保存有序编号列表的 SHA-256。 [复用加载器](../../bench/2026-11-19/release.mjs) · [页面调用路径](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/d5f1dacb2f2fda4b7b7322c0dff2a3afd1a4ef41/index.html#L4198)

矩阵包含 1 至 8 人、三种库存、两个分类和三个范围，共 8×3×2×3＝144 组。空库存没有食材记录，零库存把全部 47 种食材写为 0。上限合成库存把每种食材置为模型允许的 100,000，单位随食材使用克或个，用来满足所有定量菜的主料数量约束。三个范围为全部、20 分钟内和家里能做，分类分别为全部与无肉主料定量分类。

## 字段覆盖

needs 表示按食材编号保存的数值用量。扩充索引在这份离线包内随 HTML 附带，其内部类型值为 online。

| 搜索记录类型 | 条数 | 正数数值分钟 | 结构化 needs | 分钟数不超过 20 |
| --- | ---: | ---: | ---: | ---: |
| 项目定量菜 | 187 | 187 | 187 | 102 |
| HowToCook 参考菜 | 285 | 0 | 0 | 0 |
| 扩充索引 | 877 | 0 | 0 | 0 |
| 合计 | 1,349 | 187 | 187 | 102 |

285 条 HowToCook 参考菜和 877 条扩充索引的记录均没有 minutes 属性，结构化 needs 计数也为 0。它们的食材文本通过原有索引参与普通检索。当前自动时间筛选和定量匹配所需的覆盖范围因此集中在 187 条记录上。缺失的分钟字段不能满足代码中的数值比较条件。 [字段与样例编号](../../bench/2026-11-20/filter-coverage-results.json) · [ECMAScript 比较操作](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-islessthan)

## 组合结果

下表每个数量在 1 至 8 人份中均相同。空库存和显式零库存分别执行，结果数量一致。

| 分类 | 范围 | 空库存 | 显式零库存 | 上限合成库存 |
| --- | --- | ---: | ---: | ---: |
| 全部 | 全部 | 1,349 | 1,349 | 1,349 |
| 全部 | 20 分钟内 | 102 | 102 | 102 |
| 全部 | 家里能做 | 0 | 0 | 187 |
| 无肉主料（定量） | 全部 | 103 | 103 | 103 |
| 无肉主料（定量） | 20 分钟内 | 75 | 75 | 75 |
| 无肉主料（定量） | 家里能做 | 0 | 0 | 103 |

上限合成库存足以使全部 187 道定量菜进入可做集合。其余记录的原料记录形状没有因此变成定量类型。时间筛选数量也随 1 至 8 人保持 102，因为该分支读取原记录的分钟值，人数只参与用量模型计算。这个实验没有测量人数增加后的真实烹调耗时。

## 环境、局限与复现

运行环境为 Windows x64、Node.js 24.22.3、Unicode 17.0 和 ICU 78.3。公开 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。库存均为合成数据。

分钟字段是编辑估计，本次没有试做计时。分类结果来自现有主料分组，调味品、营养和特殊饮食适用性需要单独核验。普通文本用量尚需整理成标准食材编号与单位后，才能扩大当前定量匹配覆盖。关键词、部分库存、估算库存、已选菜单的预留用量和真实手机表现属于后续实验范围。

在仓库根目录使用 Node.js 24 运行以下命令，无需安装额外包。脚本导入前一天已经发布的加载器，下载完整仓库即可使用。`--html` 可指定固定版 HTML。

```sh
node bench/2026-11-20/filter-coverage.mjs
node bench/2026-11-20/filter-coverage.mjs --html index.html --output filter-coverage-rerun.json
```

结果包含三类记录的字段计数、样例编号、全部 144 组结果及有序编号摘要。来源和许可沿用公开版说明。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/d5f1dacb2f2fda4b7b7322c0dff2a3afd1a4ef41/index.html) · [来源与许可](../../DATA-SOURCES.md)
