# 中文组合检索的分隔符与别名替换边界

*Separator equivalence and alias-replacement boundaries in Chinese recipe search*

灶有数工程论文 · 北京时间 2026 年 11 月 19 日

## 摘要

同一组食材可以写成「番茄 小青菜」或「番茄和小青菜」。本实验从公开字典的 47 个主名称构造全部 1,081 个无序二元组，以空格查询为基准，对比 8 种连接写法，共运行 9,729 次查询。顿号、逗号、加号、全角加号和斜杠各自全部保留结果集合与顺序。「和」「配」各有 172 组从有结果变成空结果。另有 10 个主名称在应用的别名替换函数中不满足重复处理后保持不变的性质。实验保留这些差异，给出可复查的诊断和例子。 [实验代码](../../bench/2026-11-19/query-separators.mjs) · [测量结果](../../bench/2026-11-19/query-separators-results.json)

## English abstract

We compared eight separator variants against an ASCII-space baseline for every unordered pair of the 47 primary ingredient names in the public catalog. The 1,081 baselines and 8,648 variants produced 9,729 queries over the same 1,349-recipe index, with empty stock and no ready-to-cook or category filter. Five punctuation variants preserved every ordered result list. Both 和 and 配 changed 172 nonempty baselines into empty results. Direct adjacency changed 172 result sets, with 171 becoming empty. All changed-set cases had a normalized compound that the released tokenizer left unsplit. A separate diagnostic found that 10 of the 47 primary names changed again when the app's alias-replacement function ran a second time. We publish counts, examples and a digest of every ordered output. This comparison supplies no human relevance labels or user-level accuracy estimate. [Script](../../bench/2026-11-19/query-separators.mjs) · [Results](../../bench/2026-11-19/query-separators-results.json)

## 问题与方法

11 月 16 日的检索实验核对两种实现的评分一致性。本次固定当前实现，检查食材组合换一种输入写法后能否保留候选菜。样本按发布版食材字典的顺序取两两组合，每对只测一个方向。查询库存为空，可做菜集合为空，分类留空，范围为全部。索引包含 187 道定量菜和 1,162 道参考菜。1,081 个空格基准中，544 个有结果，537 个为空。 [前次实现对照](../01-browser-recipe-search.md) · [发布版搜索入口](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/2904ba390d2f8260f7dccb5efe8f9446a7ded3d2/index.html#L3468)

共享加载器直接执行公开 HTML 中的数据、索引和检索代码。在 Cookbook 的返回对象中额外暴露两个既有内部函数，以观察归一化后的文本和分词结果，函数体沿用原代码。结果集合相同要求菜谱编号完全一致，顺序相同进一步要求每个位置一致。空结果与空结果也计为相同。 [加载器与诊断入口](../../bench/2026-11-19/release.mjs)

应用先进行 NFKC、去除首尾空白和大小写处理，再按别名表依次执行子串替换。空格和五种标点直接分开词项。连写或用「和」「配」连接时，匹配不到整串才尝试按已知词表拆解。诊断对每个主名称执行一次和两次应用归一化函数 f，比较 f(x) 和 f(f(x))。 [应用文本与分词代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/2904ba390d2f8260f7dccb5efe8f9446a7ded3d2/index.html#L3392) · [ECMAScript 子串替换定义](https://tc39.es/ecma262/multipage/text-processing.html#sec-string.prototype.replaceall) · [Unicode 规范化说明](https://www.unicode.org/reports/tr15/)

## 结果

每种写法均与相同的 1,081 个空格基准比较。

| 连接写法 | 结果集合相同 | 结果顺序相同 | 有结果变为空 |
| --- | ---: | ---: | ---: |
| 顿号「、」 | 1,081 | 1,081 | 0 |
| 逗号「,」 | 1,081 | 1,081 | 0 |
| 加号「+」 | 1,081 | 1,081 | 0 |
| 全角加号「＋」 | 1,081 | 1,081 | 0 |
| 斜杠「/」 | 1,081 | 1,081 | 0 |
| 「和」 | 909 | 762 | 172 |
| 「配」 | 909 | 762 | 172 |
| 直接连写 | 909 | 760 | 171 |

「和」「配」各有 147 组候选集合相同但排序不同。直接连写有 149 组这种情况。它们的整串拆分评分使用各部分的最低分，空格分词评分则逐项累加，分数和并列关系会随写法改变。例如「番茄 黄瓜」和「番茄和黄瓜」都返回 8 条，前两名相同，之后的顺序发生变化。 [排序示例与分数](../../bench/2026-11-19/query-separators-results.json)

「番茄 小青菜」返回 4 条，包括番茄青菜汤面和疙瘩汤。「番茄和小青菜」被处理成「番茄和小小青菜」，随后分词退回整串，返回 0 条。三个连写类别各自的 172 次集合变化，均伴随处理后的整串未拆分。直接连写中有一组仍留下部分结果，因此该类别有 171 次空结果。 [具体查询和缺失编号](../../bench/2026-11-19/query-separators-results.json)

47 个主名称中有 10 个在第一轮应用别名替换时变化，再处理一次仍会变化。下表列出其中四例。

| 字典主名称 | 处理一次 | 再处理一次 |
| --- | --- | --- |
| 小青菜 | 小小青菜 | 小小小青菜 |
| 鲜香菇 | 鲜鲜香菇 | 鲜鲜鲜香菇 |
| 玉米粒 | 玉米粒粒 | 玉米粒粒粒 |
| 熟米饭 | 熟熟米饭 | 熟熟熟米饭 |

上述名称包含自身的短别名。依次替换会扩写这些子串，而分词词表来自原始名称和别名。当前数据记录了两者相遇时的边界。后续若调整该行为，可以复用这组查询检查集合变化，并单独核对排序。

## 环境、局限与复现

结果由 Windows x64 上的 Node.js 24.22.3 生成，Unicode 版本为 17.0，ICU 为 78.3。公开 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。所有查询来自公开食材主名称，未使用个人搜索记录。

本次只比较二元食材写法，且只取一个排列方向。结果等价性不能说明候选菜是否符合真实用户意图，空格基准也需要单独的相关性标注。三食材组合、别名查询、已有库存、可做筛选、手机输入法和修复后的行为需要另行验证。

在仓库根目录运行以下命令，使用 Node.js 24。脚本无需额外软件包。`--html` 可指定固定版 HTML。

```sh
node bench/2026-11-19/query-separators.mjs
node bench/2026-11-19/query-separators.mjs --html index.html --output query-separators-rerun.json
```

结果保存各类别计数、有限数量的差异示例、全部 47 个名称的归一化诊断，以及所有查询的有序菜谱编号流的 SHA-256。结果文件列明摘要的序列化格式，复跑可重算相同的完整输出摘要。输入菜谱沿用发布版的来源与许可。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/2904ba390d2f8260f7dccb5efe8f9446a7ded3d2/index.html) · [来源与许可](../../DATA-SOURCES.md)
