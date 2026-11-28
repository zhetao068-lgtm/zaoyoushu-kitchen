# 用餐人数变化后，少量缺料调整如何失效与重建

*Invalidating and rebuilding shortage adjustments after serving-count changes*

灶有数工程论文 · 北京时间 2026 年 11 月 28 日

## 摘要

已经确认按现有食材继续制作的菜单，在改人数后需要重新计算。本实验在手机视口下，通过实际按钮完成 18 组流程，覆盖三道菜、1 / 2 / 8 人三种起始值及加减操作。12 组有效人数变化均移除此前的少量缺料调整，回到原人数后仍按基础配方计算；再次确认缺料后恢复调整。6 组上下限控件处于禁用状态，原调整保留。全部流程的库存与已选菜单保持不变，最终调整刷新后仍能读回。 [复现脚本](../../bench/2026-11-28/servings-adjustments.py) · [逐阶段结果](../../bench/2026-11-28/servings-adjustments-results.json)

## English abstract

We tested the lifetime of saved shortage adjustments through 18 offline browser flows, covering three recipes, starting serving counts of one, two and eight, and plus/minus controls. Each case first accepted a within-20-percent shortage through the normal UI. All 12 enabled count changes removed the adjustment. Returning to the original count restored the base recipe quantities, requiring a new shortage confirmation to recover the adjusted quantities. Six bound controls were disabled and retained the original adjustment without forced click events. Stock quantities and the selected recipe ID remained unchanged in every case, and reload preserved the final adjustment. Independent integer arithmetic checked model requirements and rendered shopping-list quantities and statuses. The study uses one touch-enabled 390-by-844 desktop-browser viewport, synthetic exact stock and three recipes. It does not establish real-phone behavior, culinary suitability or general quantity-model correctness. [Script](../../bench/2026-11-28/servings-adjustments.py) · [Results](../../bench/2026-11-28/servings-adjustments-results.json)

## 问题与方法

此前的完成确认研究检查了另页改人数后如何拒绝旧扣减确认。本次从正常“继续制作”流程进入，关注少量缺料调整在人数改变、改回、重新确认和最终刷新中的生命周期。测试期间只选一道菜，没有执行库存扣减。 [此前的完成确认研究](../2026-11-21/finish-consistency.md)

样本是公开定量菜顺序中的番茄炒蛋、番茄鸡蛋汤和家常煎豆腐。每道菜分别从 1、2、8 人开始，观察减一人与加一人，共 3×3×2＝18 组。每组使用新的浏览器上下文，按文件打开公开 HTML，离线、390×844 CSS 像素、触摸、简体中文和上海时区。Browser 插件未提供，按前端测试流程使用普通 Playwright。上下文不读取现有浏览器配置或真实库存。 [Playwright 隔离机制](https://playwright.dev/python/docs/browser-contexts) · [手机参数模拟](https://playwright.dev/python/docs/emulation)

夹具用量由原始两人配方独立计算。对于正整数原料量 q、人数 s，基础用量为 ceil(q×s/2)，脚本以整数式 (q×s+1)//2 计算。每组把第一项主料的现有量设为 ceil(基础用量×4/5)，其余原料恰好足够，使初始主料缺口在 20% 以内。这些原料按字典使用克或个。 [发布版份量计算](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L3651) · [ECMAScript Math.ceil](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.ceil)

流程为找菜、点“做这道”、确认缺料并继续制作、关闭做法、查看买菜清单，再操作人数控件。若控件可用，改变一次后查看清单，再改回原人数、重新查看清单，最后点“继续做”并再次确认缺料。若控件已在上下限，则检查禁用状态与完整账本不变，不强行触发点击。每组最后刷新，检查本机保存的账本。

## 人数变化与调整结果

| 起始人数与动作 | 组数 | 控件状态 | 改变人数后调整 | 改回原人数后 |
| --- | ---: | --- | --- | --- |
| 1 人减一人 | 3 | 禁用 | 原调整保留 | 未发生人数变化 |
| 1 人加一人 | 3 | 可用 | 移除 | 基础用量，需重新确认 |
| 2 人减一人 | 3 | 可用 | 移除 | 基础用量，需重新确认 |
| 2 人加一人 | 3 | 可用 | 移除 | 基础用量，需重新确认 |
| 8 人减一人 | 3 | 可用 | 移除 | 基础用量，需重新确认 |
| 8 人加一人 | 3 | 禁用 | 原调整保留 | 未发生人数变化 |

12 组有效变化各包含一次改变和一次改回，共 24 次有效人数按钮操作。第一次变化后都不存在保存的 adjustments 字段，改回后也没有自动恢复。随后 12 组再次出现与初始相同的缺料文字，重新确认后完整账本与最初确认后的账本一致。18 组最终状态刷新后全部一致。

变化过程中，18 组库存数量都没有被改写，已选菜单仍是同一菜谱编号。脚本同时核对模型需要量、页面显示的需要量、现有量、缺口状态与“做完这顿”的可用状态。2 人减少到 1 人的三组临时够用，“做完这顿”可用；其他九组有效变化仍有缺口。改回原人数后，12 组都重新出现主料缺口。

## 两人番茄炒蛋的逐阶段例子

该夹具始终只有番茄 224 克与鸡蛋 4 个。人数变化只是重新计算菜单用量。

| 阶段 | 人数 | 保存的微调 | 菜单需要番茄 | 菜单需要鸡蛋 |
| --- | ---: | --- | ---: | ---: |
| 初次缺料确认后 | 2 | 有 | 224 克 | 4 个 |
| 加到三人 | 3 | 无 | 420 克 | 6 个 |
| 改回两人 | 2 | 无 | 280 克 | 4 个 |
| 再次确认继续制作 | 2 | 有 | 224 克 | 4 个 |

改回两人时，买菜清单显示番茄还差 56 克，完成按钮不可用。再次点“继续做”会打开核对窗口，显示需要 280 克、少 56 克。确认继续后，菜谱详情重新显示 224 克。相同人数回来后还要重新确认，是当前流程的实际行为。

人数按钮处理函数在新旧人数不同时删除整个调整对象。recipeNeeds 只有在保存调整的人数与当前人数相同时才使用它；人数按钮删除后，改回数字也找不到旧对象。重新确认缺料再建立当前人数的调整，解释了上述状态变化。 [人数按钮处理](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L4427) · [读取保存调整](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L3657) · [重新确认入口](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html#L4067)

## 环境、证据与局限

环境为 Windows 10 AMD64、Python 3.11.3、Playwright 1.62.0、Edge 158.0.4370.33。HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。页面标题、首个搜索控件、框架错误覆盖层和控制台均检查；18 组没有运行时错误、控制台警告或错误，也没有 HTTP/HTTPS 请求。检查截图已在本机查看，显示改回两人后的 56 克缺口和再次确认窗口。

结果测量三种确定夹具的交互状态，不评价这些配比是否适合实际烹调。真实手机、其他浏览器、估算库存、两道菜共享原料、跨标签页竞争和写入失败需分别验证。本次最终刷新发生在重新确认以后，没有把中途关页或崩溃恢复纳入流程。缺料调整的原数学边界也不能由这 18 组样例推广为全部菜谱的正确性证明。

在仓库根目录运行。默认使用 Playwright 的 Chromium，本次使用已安装的 Edge。`--html` 可指定固定版；`--screenshots` 可指定本机截图目录。

```sh
python -m pip install playwright==1.62.0
python -m playwright install chromium
python bench/2026-11-28/servings-adjustments.py
python bench/2026-11-28/servings-adjustments.py --channel msedge --output servings-adjustments-rerun.json
```

脚本在状态或显示量不符时以非零状态退出。JSON 包含各阶段的用量、缺口、控件状态、原始缺料文字与刷新检查。实验未改动应用，只新增合成夹具与复现材料。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/cd96c0723f8cebe2da825c501dff096db4f00e1a/index.html) · [来源与许可](../../DATA-SOURCES.md)
