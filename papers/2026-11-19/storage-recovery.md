# 离线库存恢复的校验边界与写入失败行为

*Validation boundaries and write-failure behavior in offline pantry recovery*

灶有数工程论文 · 北京时间 2026 年 11 月 19 日

## 摘要

库存显示出来、写入成功和重新打开后恢复需要分别核对。本实验使用公开离线版的实际模型与合成存储接口，检查 50 组加载样例和 7 种更新场景。17 组加载样例沿用输入记录，33 组进入初始状态，加载过程均未写回原存储。注入写入异常后，两次各增加番茄 10 克的操作使内存从 300 克变成 320 克，存储仍为 300 克，模型返回保存失败。另有一个样例显示，示例库存的无效字段会使正常的个人库存和笔记一起回到初始状态，随后保存会替换原记录。 [实验代码](../../bench/2026-11-19/storage-recovery.mjs) · [测量结果](../../bench/2026-11-19/storage-recovery-results.json)

## English abstract

We ran the released storage model against 50 synthetic cold-load fixtures and seven update scenarios using a deterministic in-memory Storage double. Seventeen fixtures were restored and 33 produced the initial state. Every cold load left the original stored string untouched. With an injected write exception, two 10-gram tomato increments changed in-memory stock from 300 to 320 grams while the stored record remained at 300 grams. Both updates reported saved=false, and a fresh model restored 300 grams. Invalid demo-book data also caused otherwise valid home stock and notes to fall back together. A subsequent successful update replaced that original record. Additional cases document fields accepted with weak validation. These are model-level fault-injection results, with no measurement of real browser quota, disk durability, UI feedback or cross-tab concurrency. [Script](../../bench/2026-11-19/storage-recovery.mjs) · [Results](../../bench/2026-11-19/storage-recovery-results.json)

## 问题与方法

实验读取公开 HTML 中的 MealModel。每组加载使用一个新的执行环境，存储接口只接受程序当前使用的键。基准为两人份、已选番茄炒蛋、番茄 300 克、鸡蛋 4 个和一条合成笔记。示例库存来自公开默认值。脚本按案例修改一个字段或一类条件，比较完整加载结果和预期，同时核对加载前后的原始存储字符串。 [公开恢复与更新代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/2904ba390d2f8260f7dccb5efe8f9446a7ded3d2/index.html#L3586) · [实验加载器](../../bench/2026-11-19/release.mjs)

原始字符串包括缺失记录、空字符串、无效 JSON 和结构不符的 JSON。字段样例覆盖人数、菜谱编号与重复菜单、数量上下限、库存形状、笔记结构、笔记数量和两本库存的关联校验。这里的「沿用」表示输入 JSON 被整体采用，「初始状态」表示个人库存与菜单为空、笔记为空，示例库存恢复默认值。

写入实验把两个合成异常分别命名为 QuotaExceededError 和 SecurityError，交给实际更新函数的捕获分支处理。合成接口在写入前抛出错误，不改动已有字符串。实际浏览器的 setItem 在无法保存新值时会抛出配额错误，具体额度和可用性取决于浏览器环境。 [WHATWG Storage 接口](https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-setitem-dev)

## 加载结果

| 样例组 | 数量 | 沿用输入记录 | 进入初始状态 |
| --- | ---: | ---: | ---: |
| 正常基准 | 1 | 1 | 0 |
| 人数范围与类型 | 6 | 2 | 4 |
| 菜单编号、重复与形状 | 6 | 2 | 4 |
| 库存数量 | 8 | 2 | 6 |
| 库存对象形状 | 3 | 1 | 2 |
| 附加字段与弱校验字段 | 6 | 6 | 0 |
| 示例库存与个人库存的关联 | 2 | 0 | 2 |
| 当前库存模式 | 2 | 1 | 1 |
| 笔记结构 | 9 | 1 | 8 |
| 笔记数量 | 2 | 1 | 1 |
| 原始字符串及缺失输入 | 5 | 0 | 5 |
| 合计 | 50 | 17 | 33 |

数量 0 和 100,000 被采用，负数、超上限、非整数、字符串数量及缺失数量触发初始状态。菜单中的重复或未知菜谱编号也触发初始状态。笔记 100 条被采用，101 条触发初始状态。所有 50 组加载均没有调用写入接口，输入记录原文被保留。 [逐例预期和加载结果](../../bench/2026-11-19/storage-recovery-results.json)

部分被采用的输入仍存在结构或语义疑点。空数组可作为库存通过读取检查，字符串形式的 estimated、priority 和 adjustments 被保留。空笔记编号与名称、重复笔记编号，以及 5,000 字的笔记名称也被采用。这些案例只说明读取函数的实际接受范围，后续界面和业务操作还需分别验证。

当个人库存和笔记均正常、但示例库存人数为 0 时，整份状态进入初始值。另一个同类样例删除示例库存，同样进入初始值。扩展更新场景从前一个输入继续操作，写入番茄 10 克后保存成功。重新加载时仅有这条新库存，原来的鸡蛋记录和笔记没有恢复，存储字符串已被新状态替换。

## 更新与失败结果

| 场景 | 当前内存的番茄数量 | 已保存的番茄数量 | 重新加载的番茄数量 |
| --- | ---: | ---: | ---: |
| 正常写入两次，各加 10 克 | 320 克 | 320 克 | 320 克 |
| 注入配额写入异常后更新两次 | 320 克 | 300 克 | 300 克 |
| 注入访问写入异常后更新两次 | 320 克 | 300 克 | 300 克 |
| 启动读取被拒绝，随后写入 10 克 | 10 克 | 300 克 | 300 克 |
| 示例库存无效后写入 10 克 | 10 克 | 10 克 | 10 克 |

两种写入异常场景均仅尝试一次底层写入。第一次失败后，当前模型把存储标为不可用，第二次继续更新内存，两次都返回 saved=false。清除注入异常并创建新模型后，能再次成功保存。启动读取异常后，即使合成接口恢复可用，同一个模型也继续报告保存失败，新模型则恢复原存储中的 300 克。

另外两种场景分别在更新回调修改草稿后返回校验错误，或抛出异常。两者都没有写入，当前内存与存储仍是原基准。更新函数先复制状态，再执行回调，成功回调之后才采用草稿。 [模型更新代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/2904ba390d2f8260f7dccb5efe8f9446a7ded3d2/index.html#L3619)

界面提交函数对 saved=false 配有提示，文字说明本次更新仅在当前页面有效。此项来自公开源码检查，本实验没有渲染或测量提示是否被看见。 [界面提交函数](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/2904ba390d2f8260f7dccb5efe8f9446a7ded3d2/index.html#L3868)

## 环境、局限与复现

运行环境为 Windows x64、Node.js 24.22.3、Unicode 17.0 和 ICU 78.3。输入 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。所有记录和异常均为合成数据。

实验提供确定性的 Storage 接口替身，执行环境不提供 Web Locks。真实浏览器配额、磁盘持久性、跨标签页竞态、真实旧记录迁移，以及手机端提示需要进一步验证。样例的接受与回退结果只描述当前版本的行为。发现的校验边界和更新后覆盖现象记录在结果中。

在仓库根目录运行下列命令，使用 Node.js 24，无需额外软件包。`--html` 可指定下载的固定版 HTML。脚本会在预期与观测不符时以非零状态退出。

```sh
node bench/2026-11-19/storage-recovery.mjs
node bench/2026-11-19/storage-recovery.mjs --html index.html --output storage-recovery-rerun.json
```

结果包含每组加载的预期、源字符串摘要、加载后的库存编号、写入次数和更新场景。源码与菜谱数据采用同一公开快照。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/2904ba390d2f8260f7dccb5efe8f9446a7ded3d2/index.html) · [来源与许可](../../DATA-SOURCES.md)
