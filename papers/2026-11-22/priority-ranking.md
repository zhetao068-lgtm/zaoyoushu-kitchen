# “优先用掉”对检索排序与配餐的不同影响

*How use-first flags affect search ranking and meal suggestions*

灶有数工程论文 · 北京时间 2026 年 11 月 22 日

## 摘要

库存里的“优先用掉”是人工标记，其作用需要分别沿检索和配餐路径验证。本实验覆盖全部 47 个食材编号，在充足、仅剩一个原生单位、零库存和估算库存四种合成条件下比较标记开关。两种查询共形成 376 组检索比较，235 组改变了顺序，全部保持相同结果集合和可做集合。188 组配餐比较中，充足库存的 47 组均增加了目标食材的菜谱用量，仅剩一个单位时只有鸡蛋一组增加，估算条件下的 47 组菜单均未变化。差异与两条路径对估算标记的排序位置一致。 [实验脚本](../../bench/2026-11-22/priority-ranking.mjs) · [逐组结果](../../bench/2026-11-22/priority-ranking-results.json)

## English abstract

We evaluated the manual use-first flag separately in recipe search and meal suggestions. All 47 ingredient IDs were tested with four synthetic stock fixtures: ample, one catalog base unit remaining, zero, and ample with the target marked estimated. Empty and canonical-name queries produced 376 paired search comparisons, of which 235 changed order. Result membership and the model-computed ready set remained unchanged. Across 188 paired meal-suggestion comparisons, all 47 ample-stock cases increased the target ingredient's recipe requirement. Only the egg case increased it in the one-unit fixture. All 47 estimated-stock cases kept the same menu and did not use the target ingredient. The released search and suggestion paths place the estimated flag differently in their ordering rules. These are deterministic observations of the current public data and code, without relevance judgments, expiration models, cooking trials or measured food-waste reduction. [Script](../../bench/2026-11-22/priority-ranking.mjs) · [Results](../../bench/2026-11-22/priority-ranking-results.json)

## 问题与方法

普通搜索由 Cookbook.search 排序。配餐由 MealModel.suggestMeal 选择至多两道定量菜。两者共享食材编号和库存，但使用不同的排序规则。本次延续前面的字段覆盖实验，问题收窄为只改变一个 priority 布尔标记时，排序和建议菜单发生什么变化。 [此前的字段审计](../2026-11-20/filter-coverage.md) · [公开检索](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L3468) · [配餐入口](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L3769)

实验复用已公开的加载器，执行发布版函数。库存均为两人份，菜单与用量调整为空，每组仅对一个目标食材增加标记。其余 46 种食材数量统一设为模型上限 100,000。原生单位随字典使用克或个，一克蔬菜和一个鸡蛋分别是“一个单位”，不代表一份菜。上限库存仅用于隔离排序变量。 [加载器](../../bench/2026-11-19/release.mjs)

| 条件 | 目标食材数量 | 目标食材 estimated |
| --- | ---: | --- |
| 充足 ample | 100,000 | 无 |
| 仅一个单位 one-unit | 1 | 无 |
| 零库存 zero | 0 | 无 |
| 估算 estimated | 100,000 | true |

每个条件分别使用空查询和食材字典中的中文标准名称。检索范围、分类均为全部，可做集合按首页实际调用路径生成。47×4×2＝376 组比较对应 752 次搜索调用。每组保存前后有序编号的 SHA-256 和前三名，检查结果集合、可做集合及排序关键字段。配餐独立执行 47×4＝188 组比较，对应 376 次建议调用，并核对推荐菜单没有数量缺口、输入库存没有被修改。 [首页调用路径](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L4198)

## 检索结果

每格的分母均为 47 个目标食材。顺序改变只表示有序编号发生变化。

| 条件 | 空查询顺序改变 | 食材名称查询顺序改变 | 优先结果观察数 | 其中名次上升 |
| --- | ---: | ---: | ---: | ---: |
| 充足 | 47 / 47 | 33 / 47 | 5,076 | 4,203 |
| 仅一个单位 | 42 / 47 | 33 / 47 | 5,076 | 3,563 |
| 零库存 | 0 / 47 | 0 / 47 | 0 | 0 |
| 估算 | 47 / 47 | 33 / 47 | 5,076 | 4,203 |
| 合计 | 136 / 188 | 99 / 188 | 15,228 | 11,969 |

“优先结果观察数”按每次查询分别累计，同一道菜可以在多个条件下重复出现，不是不同菜谱的数量。15,228 次观察没有名次下降，其余保持原位。全部 376 组前后的结果成员与可做成员均相同。零数量即使保留标记，也不满足 covered 中数量大于零的条件，因此这 94 组顺序完全不变。

公开搜索先比较关键词相关分，再比较是否能做，然后比较优先食材个数，后面才是食材覆盖比例和定量类型。正库存标记在这些条件内提升名次，无法跳过前两项。原有相同排序值的先后使用 JavaScript 稳定排序。 [实际比较器](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L3493) · [ECMAScript sort 定义](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.sort)

结果中的具体例子是充足库存标记番茄、查询“番茄”时，番茄红酱位于第 32，相关分 104、优先计数 0；利提巧卡位于第 38，相关分 10、优先计数 1。空查询时，未标记的可做菜家常煎豆腐位于第 11，带番茄标记的参考菜利提巧卡位于第 188。这里的优先计数依赖索引已有的食材编号映射，标题中出现关键词与绑定某个食材编号是分别计算的字段。 [样例字段](../../bench/2026-11-22/priority-ranking-results.json)

## 配餐结果

配餐仅从定量可做菜中选择。下表的“增加”按目标食材在两道建议菜中的合计原生用量计算，每组只比较同一种食材，不把克和个相加。

| 条件 | 菜单改变 | 目标用量增加 | 目标用量相同 | 目标用量减少 | 标记后菜单使用目标食材 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 充足 | 47 | 47 | 0 | 0 | 47 |
| 仅一个单位 | 1 | 1 | 46 | 0 | 1 |
| 零库存 | 0 | 0 | 47 | 0 | 0 |
| 估算 | 0 | 0 | 47 | 0 | 0 |

充足番茄的基础建议为番茄炒蛋与家常煎豆腐，番茄用量 280 克。标记后第二道变为番茄鱼片汤，番茄合计 530 克。仅剩一个原生单位的 47 组中，鸡蛋一组改为香煎藕夹与家常煎豆腐，使用 1 个鸡蛋。

估算库存下的搜索顺序仍可提升，但配餐在两道候选都够用时，先比较 estimated，再比较 useFirst。该夹具中始终存在避开目标食材的非估算候选，最终全部 47 组保持原菜单，目标食材用量为零。这个结果说明，用户看到食材在搜索里靠前，仍可能在配餐中得不到它。 [定量候选比较器](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L3760)

## 环境、局限与复现

环境为 Windows x64、Node.js 24.22.3、Unicode 17.0、ICU 78.3。输入为全部 1,349 条搜索记录与 187 道定量菜。公开 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。

这是当前软件规则与合成库存的比较。没有使用真实库存、过期日期、口味评分或相关性标注，也没有测量真实消耗和食物浪费。建议函数采用现有候选顺序和主料规则，本实验不能证明任意库存下都最大化某项食材用量。多项优先食材、已选菜单预留、其他人数和真实手机交互需要另测。观察到的两条路径差异可以作为后续统一产品说明或排序规则的依据。

在仓库根目录使用 Node.js 24 运行，无需额外依赖。`--html` 可以指定固定 HTML 快照。

```sh
node bench/2026-11-22/priority-ranking.mjs
node bench/2026-11-22/priority-ranking.mjs --html index.html --output priority-ranking-rerun.json
```

结果保存每组查询的顺序摘要、首三项、配餐编号与用量，断言失败时脚本以非零状态退出。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/f637d2d0a67417eacb917b121b499c967dd5b610/index.html) · [来源与许可](../../DATA-SOURCES.md)
