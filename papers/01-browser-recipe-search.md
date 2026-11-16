# 在 1,286 道菜谱上优化中文组合搜索

灶有数工程论文 · 2026 年 11 月 16 日

## 摘要

家常菜搜索同时接受菜名、食材、烹调方式和中文口语组合。本实验用同一份 1,286 道菜谱索引对比两种词项评分写法。优化通过逐词累加，在必需词不匹配时停止检查当前菜谱。96 组查询与筛选组合返回相同的菜谱、顺序和分数。在 Node.js 24.22.1 的单机基准中，每轮平均每次查询耗时的中位数由 0.5317 毫秒降至 0.2086 毫秒。 [测量数据](../bench/search-results.json)

## English abstract

**Optimizing multi-term Chinese search across 1,286 recipes.** We compared two scoring implementations against the same recipe index. The revised implementation accumulates scores term by term and stops evaluating a recipe when a required term fails to match. Across 96 query-and-filter cases, both implementations returned the same recipes in the same order with identical scores. On Node.js 24.22.1, the median round-average time per query fell from 0.5317 to 0.2086 milliseconds. The benchmark measures search computation after the index loads. [Measurements](../bench/search-results.json)

## 检索方法

菜名和查询文本先用 Unicode NFKC 规范化，再按项目维护的别名表统一常用词。比如「洋芋」可以归到「土豆」，「空气炸锅」可匹配「空气炸」。NFKC 负责字符规范化，食材同义词和可识别的做法仍由菜谱索引定义。 [Unicode 标准附录 15](https://www.unicode.org/reports/tr15/)

检索对菜名、别名、食材和方法分别赋分。组合条件要求各个词项都有匹配，才进入候选列表。「鸡蛋和土豆」整词找不到时，可尝试两个食材词。排序保留名称精确匹配的优先级，再考虑库存是否足够、食材优先用掉标记以及主料覆盖率。

基线为每条候选构建词项分数数组，也会重新评分拆分结果只有原词的情况。优化把评分写成有提前终止的顺序扫描。单词直接命中就累加。只在可拆成多个食材词且整词未命中时，取各部分的最低分。任一必需词的分数为零时立即排除该候选。 [基线代码](../bench/baseline-cookbook.js) · [对照脚本](../bench/search.mjs)

## 实验与结果

24 个手工构造的查询覆盖菜名、别名、多个食材、做法、全角字符和无结果。每个查询跑四种组合，分别为空库存、合成库存、快手无肉筛选和可做筛选。对照脚本逐个比较结果的 ID、排序与分数，也比较库存匹配字段。计时前各预热四轮，正式计时各 16 轮，交替运行新旧版本。每轮执行同样的 96 组查询。

| 指标 | 基线 | 优化后 |
| --- | ---: | ---: |
| 每轮输出的结果数 | 2,900 | 2,900 |
| 每轮平均每次查询的中位耗时 | 0.5317 毫秒 | 0.2086 毫秒 |
| 最慢一轮的平均每次查询耗时 | 0.9094 毫秒 | 0.2206 毫秒 |

中位数在该实验中降低 60.8%。计时从索引加载完成后开始，主要覆盖算法、库存匹配和结果排序。页面加载、输入法、触摸到屏幕刷新的耗时需要在真实手机上另测。这个对照只验证既有匹配语义是否保留，尚无用户标注的相关性数据可以用来估计检索准确度。

## 复现

在仓库根目录运行 `node bench/search.mjs`。脚本从网页提取实际发布的菜谱索引，对两套搜索代码使用同一批库存和查询。顺序或分数出现差异时会退出并报告对应查询。
