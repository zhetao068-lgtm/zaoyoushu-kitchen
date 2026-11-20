# 逐步做菜在关闭与刷新后的进度恢复

*Cooking-step recovery after closing and reloading the recipe dialog*

灶有数工程论文 · 北京时间 2026 年 11 月 20 日

## 摘要

逐步做菜中的上一页和下一页可以正确切换，但中断后的恢复还需独立检查。本实验在两个手机尺寸视口中，对三道定量菜执行 18 组断网浏览器操作，每组先到达第 3 步。关闭做法后点「继续做」的 6 组，以及刷新后点「继续做」的 6 组，都回到第 1 步。留在同一窗口内先返回第 2 步、再前进的 6 组，均回到第 3 步。所有组的库存和已选菜单都保持相同。实验记录了当前公开版本的恢复行为。 [实验脚本](../../bench/2026-11-20/step-recovery.py) · [逐组结果](../../bench/2026-11-20/step-recovery-results.json)

## English abstract

We tested cooking-step recovery offline in 18 fresh browser contexts across two touch-enabled viewport sizes and three measured recipes. Each case first advanced to step 3 of a four-step recipe. All six close-and-reopen cases and all six reload-and-reopen cases returned to step 1 through the visible continue-cooking control. All six same-dialog back-and-forward controls returned to step 3. Stock quantities and the selected menu were unchanged in every case. No page errors, console warnings or errors, or HTTP requests were observed. The released openRecipe function initializes guided mode at the first step, consistent with these observations. This is desktop-browser emulation with synthetic two-serving stock. Real handset suspension, process termination and completed-meal behavior were outside the experiment. [Script](../../bench/2026-11-20/step-recovery.py) · [Results](../../bench/2026-11-20/step-recovery-results.json)

## 问题与方法

11 月 18 日的手机实验覆盖了逐步前进、后退与显示全部步骤。本次把关闭和刷新作为独立中断，观察「继续做」重新打开后所处的步骤，同时检查库存与菜单。当前页面按菜谱是否在已选菜单中决定显示「做这道」或「继续做」。 [前次手机流程实验](../2026-11-18/mobile-flow.md) · [列表入口代码](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/d5f1dacb2f2fda4b7b7322c0dff2a3afd1a4ef41/index.html#L4246)

样本为发布顺序中的前三道定量菜，分别是番茄炒蛋、番茄鸡蛋汤和家常煎豆腐。三道菜的当前编辑步骤均为 4 步。每道菜分别使用 320×568 和 390×844 CSS 像素视口，启用触摸事件、简体中文和上海时区。页面通过本地文件打开，浏览器上下文设置为断网。 [Playwright 模拟参数](https://playwright.dev/python/docs/emulation)

每组使用新的非持久浏览器上下文。准备阶段调用公开模型的更新接口，写入该菜两人份恰好够用的合成库存，菜单置空，再刷新加载。之后通过页面搜索和「做这道」进入做菜流程，两次点「下一步」到第 3 步。步骤通过进度文字和当前可见步骤的编号交叉核对。三种场景各运行 6 组。

1. 关闭并重开，点做法窗口的关闭键，重新搜索该菜并点「继续做」。
2. 刷新并重开，在第 3 步执行页面刷新，再搜索该菜并点「继续做」。
3. 窗口内后退再前进，点「上一步」到第 2 步，再点「下一步」回去。

刷新操作使用 Playwright 的 page.reload，等待页面 load 完成。每次新界面操作后都等待目标窗口和进度可见，再记录步骤。三个场景均比较前后完整的个人库存账本，其中包含人数、食材和菜单。 [刷新接口](https://playwright.dev/python/docs/api/class-page#page-reload) · [完整复现过程](../../bench/2026-11-20/step-recovery.py)

## 结果

每个单元格记录「操作前步骤 → 操作后步骤」。同一道菜在两个视口下的结果相同。

| 菜谱 | 关闭并重开 | 刷新并重开 | 窗口内后退再前进 |
| --- | --- | --- | --- |
| 番茄炒蛋 | 3 → 1 | 3 → 1 | 3 → 3 |
| 番茄鸡蛋汤 | 3 → 1 | 3 → 1 | 3 → 3 |
| 家常煎豆腐 | 3 → 1 | 3 → 1 | 3 → 3 |

| 汇总指标 | 结果 |
| --- | ---: |
| 全部组合 | 18 |
| 关闭重开后回到第 1 步 | 6 / 6 |
| 刷新重开后回到第 1 步 | 6 / 6 |
| 同一窗口内回到第 3 步 | 6 / 6 |
| 库存与菜单前后一致 | 18 / 18 |
| 页面运行错误 | 0 |
| 控制台警告或错误 | 0 |
| HTTP 请求 | 0 |

在关闭或刷新后，菜单仍包含所选菜，因而列表继续显示「继续做」。再次打开时进度为第 1 步。源码中的 cookingStep 是当前页面变量，openRecipe 在 guided 为真时将其设为 0，再渲染第 1 步。这个初始化路径与实测结果一致。 [公开打开函数](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/d5f1dacb2f2fda4b7b7322c0dff2a3afd1a4ef41/index.html#L4041)

本次到达第 3 步的导航与重新进入过程都没有确认「做完这顿」。记录的库存数值保持番茄炒蛋所需的 280 克番茄和 4 个鸡蛋、番茄鸡蛋汤所需的 200 克番茄和 2 个鸡蛋，或家常煎豆腐所需的 300 克北豆腐和 15 克葱。每组菜单只包含该菜。 [合成库存与步骤记录](../../bench/2026-11-20/step-recovery-results.json)

## 环境、局限与复现

运行环境为 Windows 10 AMD64、Python 3.11.3、Playwright 1.62.0 和 Edge 157.0.4341.60。公开 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。测试只写入各自新上下文中的合成库存。

浏览器模拟没有覆盖 Android、iOS、微信内置浏览器、系统后台挂起、进程终止、屏幕阅读器或真实厨房操作。样本只有三道四步菜谱、两人份和第 3 步这一中断位置。其他步骤数、参考菜谱、多个已选菜和完成后的再次打开需要另行测试。

在仓库根目录运行以下命令。默认使用 Playwright 安装的 Chromium，本次结果采用已经安装的 Edge 通道。浏览器版本、系统和字体变化可能影响渲染。

```sh
python -m pip install playwright==1.62.0
python -m playwright install chromium
python bench/2026-11-20/step-recovery.py
python bench/2026-11-20/step-recovery.py --channel msedge --output step-recovery-rerun.json
```

`--html` 可指定固定版 HTML，`--screenshots` 可指定本机截图目录。脚本在流程检查失败时以非零状态退出，结果包含每组进度、库存一致性、控制台与网络计数。当前发布版的恢复行为按观测值报告。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/d5f1dacb2f2fda4b7b7322c0dff2a3afd1a4ef41/index.html) · [来源与许可](../../DATA-SOURCES.md)
