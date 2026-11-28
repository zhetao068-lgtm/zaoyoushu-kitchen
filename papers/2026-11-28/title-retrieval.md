# 完整菜名回查与同名记录的排序边界

*Full-title retrieval and ranking boundaries between same-title recipe records*

灶有数工程论文 · 北京时间 2026 年 11 月 28 日

## 摘要

用户输入完整菜名时，排第一的条目可能与其寻找的同名条目具有不同编号和类型。本实验将公开索引的 1,349 条记录逐一作为已知目标，分别在空库存与上限合成库存下，用其未经改写的完整菜名查询，共执行 2,698 次检索。全部找到原编号，最差名次为 2；每种库存下均有 1,338 条原编号位列第一，11 条内嵌扩充记录位列第二。索引有 1,340 个不同原始菜名，经应用处理后有 1,338 个标题。九组原名重复之外，另有两组不同原名被别名映射归到同一标题。首条标题相同与首条编号相同需要分开统计。 [复现脚本](../../bench/2026-11-28/title-retrieval.mjs) · [完整结果](../../bench/2026-11-28/title-retrieval-results.json)

## English abstract

We queried each of the public index's 1,349 records by its unchanged full recipe name under two inventory fixtures, producing 2,698 searches. Every original record ID was retrieved, with a worst rank of two. In each fixture, 1,338 original IDs ranked first and 11 bundled expansion records ranked second. The index contained 1,340 distinct raw names and 1,338 distinct app-normalized titles. Nine raw-name duplicate groups and two additional alias-merged groups accounted for the second-ranked records. All 1,327 records with unique normalized titles ranked first, and changing the inventory fixture changed neither target ranks nor first IDs. The first result always shared the target's normalized title, which does not establish source identity or culinary equivalence. This is a known-record retrieval probe, without user-query samples, relevance labels, typo tests or mobile rendering measurements. [Script](../../bench/2026-11-28/title-retrieval.mjs) · [Results](../../bench/2026-11-28/title-retrieval-results.json)

## 问题与方法

此前的检索实验比较了分隔符写法和优先食材的排序作用。本次固定查询为每条记录自己的完整名称，只回答两个问题：原记录能否被找回，以及排在前面的记录是否具有相同编号、相同处理后标题。 [分隔符实验](../2026-11-19/query-separators.md) · [优先标记实验](../2026-11-22/priority-ranking.md)

实验复用公开加载器，直接运行发布版 Cookbook.search。样本含 187 道定量菜、285 道 HowToCook 参考菜和 877 条内嵌扩充记录。第三类的内部类型为 online，数据已经随这份离线 HTML 附带。所有编号唯一，名称取自公开包。查询不使用个人搜索历史，也不补写别名、纠错或短语。 [加载器](../../bench/2026-11-19/release.mjs) · [固定版搜索入口](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L3468)

两种库存都设两人份、空菜单和全部分类、全部范围。空库存的可做集合为空；上限库存把全部 47 种食材设为 100,000 个字典原生单位，单位分别为克或个，得到 187 道可做菜。这个非现实库存用于隔离库存排序因素。可做集合按首页的模型调用路径生成。每条目标在两个库存下各查询一次，样本单位为“目标记录与库存条件”，共 1,349×2＝2,698 次。

脚本分别按原始 name 和索引中保存的 title 分组。后者包含 NFKC 字符处理、大小写与首尾空白处理，以及项目自己的食材和烹调别名替换。别名映射来自应用代码，不能与 Unicode 字符规范化混作同一个规则。 [索引标题构建](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L3392) · [Unicode 规范化说明](https://www.unicode.org/reports/tr15/)

## 回查结果

下表每个数值在空库存与上限库存中均相同。两种库存下，目标名次和第一条编号都没有发生变化。

| 目标记录类型 | 条数 | 找到原编号 | 原编号第一 | 原编号前 3 | 最差名次 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 定量菜 exact | 187 | 187 | 187 | 187 | 1 |
| HowToCook reference | 285 | 285 | 285 | 285 | 1 |
| 内嵌扩充 online | 877 | 877 | 866 | 877 | 2 |
| 合计 | 1,349 | 1,349 | 1,338 | 1,349 | 2 |

所有原编号的自身相关分均为 150，全部目标出现在排序数组前 12 条。这里的前 12 条只是数组名次检查；本实验没有把它换算成手机首屏可见条数。页面的初始列表上限为 12，实际可见面积仍取决于屏幕与卡片高度。 [完整名称加分和排序代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L3480) · [列表上限](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L3825)

有 1,327 条记录的处理后标题唯一，这些原编号全部位列第一。另外 22 条构成 11 个双条目标题组，每组总有一条排第二。本次全部 1,349 个目标的第一条结果，都与目标具有相同的处理后标题。若只检查标题文本，就会漏掉其中 11 次来源编号的区别。

## 原名重复与别名合并

| 分组方式 | 不同标题数 | 多记录标题组 | 这些组包含的记录数 |
| --- | ---: | ---: | ---: |
| 原始菜名 | 1,340 | 9 | 18 |
| 应用处理后标题 | 1,338 | 11 | 22 |

原名重复包括青椒炒蛋、冬瓜虾仁汤、锅塌豆腐等。结果文件保存每组原始名称、类型与编号，保留不同记录的身份。

另外两组的原始名称本来不同。

| 记录原名 | 另一记录原名 | 应用处理后的相同标题 |
| --- | --- | --- |
| 香菇青菜 | 香菇油菜 | 鲜香菇小青菜 |
| 照烧鸡胸肉 | 照烧鸡肉 | 照烧鸡胸肉 |

输入“照烧鸡肉”时，第一条是定量菜 soy-glazed-chicken-breasts，名称为照烧鸡胸肉；原扩充记录 wiki-33380 位列第二。输入“香菇油菜”时，第一条为 mushroom-greens 的香菇青菜，原扩充记录 open-mushroom-bok-choy 位列第二。两种库存得到相同的这组顺序。

当前比较器在相关分后依次比较是否可做、优先食材、覆盖比例和定量类型。原始顺序通过 JavaScript 的稳定排序保留在完全并列处。这些规则足以产生同名记录之间的次序；标题分组本身没有核对做法、食材用量或来源关系。依据这些观测，后续若做去重或结果合并，应继续保留原名、编号、类型与出处供用户区分。 [发布版比较器](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L3492) · [ECMAScript 稳定排序定义](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.sort)

## 环境、局限与复现

环境为 Windows x64、Node.js 24.22.3、Unicode 17.0、ICU 78.3。公开 HTML 为 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。实验读取全部公开索引，没有修改应用或采集个人数据。

完整原名在索引与查询两侧经过相同处理，是这组回查的固定条件。真实查询中的错别字、简称、独立别名输入、繁体、其他筛选和输入法没有进入样本。原编号回查和相同标题计数也不能证明烹调内容等价，或作为用户搜索准确率使用。本次没有测量检索耗时。

在仓库根目录使用 Node.js 24 运行，无需新增依赖。`--html` 可指定固定版 HTML。

```sh
node bench/2026-11-28/title-retrieval.mjs
node bench/2026-11-28/title-retrieval.mjs --html index.html --output title-retrieval-rerun.json
```

结果包含逐目标名次、第一条编号、有序结果摘要、原名重复组与别名合并组。新增材料只复用已公开标题和编号，素材署名与许可继续按项目来源说明分项保留。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html) · [来源与许可](../../DATA-SOURCES.md)
