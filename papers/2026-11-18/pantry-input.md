# 一句话入库的食材别名与单位边界

*Ingredient aliases and unit boundaries in one-line pantry entry*

灶有数工程论文 · 北京时间 2026 年 11 月 18 日

## 摘要

一句话录库存需要同时识别食材、数量和单位。本实验直接运行公开离线版的实际解析函数，用 705 个合成样例核对已声明的别名、斤两换算、全角字符、重复项和批量上限。633 个样例返回完整解析结果，72 个返回错误，均与各自的预期契约一致。食材字典包含 47 个编号和 103 个不同名称，其中 102 个名称可定位到一种食材。「豆腐」同时属于北豆腐与嫩豆腐，输入时要求确认种类。 [脚本与逐例预期](../../bench/2026-11-18/pantry-input.mjs) · [逐例结果](../../bench/2026-11-18/pantry-input-results.json)

## English abstract

We ran the actual pantry-entry parser extracted from the public standalone HTML against 705 synthetic cases. The suite covers declared ingredient labels, mass and count units, full-width input, repeated ingredients, malformed batches, and the 30-item parser limit. All explicit expectations matched, with 633 accepted inputs and 72 rejected inputs. The catalog contains 47 ingredient IDs and 103 distinct labels. Of these, 102 labels resolve to one ingredient, while the shared label 豆腐 requires a specific tofu type. Five ingredients accept piece inputs that the UI can later convert to approximate gram weights. This is a contract test against the released dictionary and parser, with no human-labeled corpus or estimate of real-world recognition accuracy. The complete synthetic cases, outcomes, and artifact hash are published. [Script](../../bench/2026-11-18/pantry-input.mjs) · [Results](../../bench/2026-11-18/pantry-input-results.json)

## 问题与方法

解析器先用 NFKC 处理兼容字符，再按名称从长到短匹配。只有一种食材使用的别名可直接定位，共用别名保留为歧义。原始名称覆盖同名别名的规则也参与预期计算。字符规范化和食材词典各有自己的职责，词典仍需要显式提供食材的别名。 [公开解析代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/961403142b58a4ffb673d69c905d3a996f69a872/index.html#L4540) · [Unicode 规范化说明](https://www.unicode.org/reports/tr15/)

脚本从公开 HTML 提取食材字典、模型与入库程序。在入库闭包的纯解析函数结束处返回该函数，前面的 DOM 引用使用空对象，界面事件处理代码不执行。每个案例显式给出完整的食材编号、数量与单位，或预期报错。成功案例逐字段比较，失败案例同时要求存在错误信息且没有返回可提交的条目集合。

对全部 46 种按克计量的食材，分别检查 11 种输入，包括克、g、千克、公斤、kg、半斤、两、全角输入、零和 100,000 克边界。鸡蛋按个计量，另测 6 种输入。5 种支持按个估重的食材各测 3 种个数表达。每种食材都有重复输入案例，另测 3 组不同别名指向同一食材的重复。批量案例分别含 30 和 31 种食材。

## 结果

| 合成案例组 | 案例数 | 返回完整解析结果 | 返回错误 |
| --- | ---: | ---: | ---: |
| 食材字典中的不同名称 | 103 | 102 | 1 |
| 数量与单位 | 512 | 512 | 0 |
| 同一食材重复 | 47 | 0 | 47 |
| 5 种食材的按个估重输入 | 15 | 15 | 0 |
| 不同别名重复 | 3 | 0 | 3 |
| 无效或未支持的表达 | 20 | 0 | 20 |
| 30 与 31 项的批量边界 | 2 | 1 | 1 |
| 多食材混合输入 | 3 | 3 | 0 |
| 合计 | 705 | 633 | 72 |

「西红柿２００克，鸡蛋４枚；洋芋半斤」解析为番茄 200 克、鸡蛋 4 个、土豆 250 克。「鸡蛋2个 蛋3枚」提示重复。「豆腐100克」要求写清北豆腐或嫩豆腐。「土豆250克 鸡精10克」整体返回错误，已经识别的土豆也不作为成功结果返回。 [完整案例](../../bench/2026-11-18/pantry-input-results.json)

番茄、黄瓜、土豆、胡萝卜与红薯的按个输入，在解析阶段保留个数。界面保存时才按公开的近似单重换算并标记估算。单位实验核对解析输出的数值与单位，称重误差需要实际称量数据验证。另一个手机流程实验在三个独立浏览器上下文中确认了上述混合错误输入会留在库存页，存储键的原始值与提交前完全一致。 [公开估重与保存代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/961403142b58a4ffb673d69c905d3a996f69a872/index.html#L4694) · [手机实验](mobile-flow.md)

## 环境、局限与复现

结果由 Windows x64 上的 Node.js 24.22.3 生成，其 Unicode 版本为 17.0，ICU 版本为 78.3。公开 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。输入来自已经发布的食材词典和合成表达。

这些预期描述当前字典与单位契约。检验覆盖的名称不能代表实际家庭食材的覆盖率，口音、语音转写、错别字和其他表达需要另建标注数据。批量上限直接调用解析函数核对，实际录入框还受 240 字符上限约束。实验没有对生产库存、菜谱口味或其他浏览器的输入法行为作推断。

在仓库根目录运行下列命令。脚本无需额外 Node.js 包，断言失败时以非零状态退出。`--html` 可指定下载的固定版 HTML。

```sh
node bench/2026-11-18/pantry-input.mjs
node bench/2026-11-18/pantry-input.mjs --html index.html --output pantry-input-rerun.json
```

源代码和案例通过仓库发布。上游菜谱许可沿用发布版的来源说明，本实验没有新增上游菜谱正文。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/961403142b58a4ffb673d69c905d3a996f69a872/index.html) · [来源与许可](../../DATA-SOURCES.md)
