# 重复确认与跨标签页变化下的库存扣减

*Pantry deductions under repeated confirmation and cross-tab changes*

灶有数工程论文 · 北京时间 2026 年 11 月 21 日

## 摘要

完成一顿饭时，界面可能收到连续确认，也可能遇到另一个标签页修改库存或人数。本实验在公开离线版上执行 15 组浏览器操作，覆盖三道菜与五种场景。三个五次同步点击场景均只扣减一次菜谱用量。三个补库存场景按最新库存完成扣减，三个缺料场景和三个改人数场景均拒绝第一次确认，并在补齐或重新打开确认窗口后完成。全部 15 组最终菜单清空，剩余库存与独立计算相符，刷新后读回相同记录。 [实验脚本](../../bench/2026-11-21/finish-consistency.py) · [逐组状态](../../bench/2026-11-21/finish-consistency-results.json)

## English abstract

We exercised completion confirmation in the public standalone app across 15 isolated browser cases, covering three measured recipes and five scenarios. Each fixture initially held three times the recipe's two-serving requirements. All three five-event synchronous click bursts deducted the requirements once. Three second-tab stock top-ups were incorporated into the deduction. Three stock shortages and three serving-count changes rejected the first confirmation without deducting stock. Replenishing or reopening confirmation then completed all six rejected cases. Every final stock quantity matched the independent calculation, each selected menu became empty, and reload preserved the result. The study uses one touch-enabled desktop-browser viewport and controlled second-tab model updates. It does not establish general exactly-once behavior across crashes, physical touch timings or arbitrary concurrent writers. [Script](../../bench/2026-11-21/finish-consistency.py) · [Results](../../bench/2026-11-21/finish-consistency-results.json)

## 问题与方法

已有的恢复实验检查了异常存储接口。本次使用真实浏览器存储，把确认窗口打开后发生的变化放到正常扣减流程中检查。样本为公开版顺序中的番茄炒蛋、番茄鸡蛋汤和家常煎豆腐，各自执行五种场景。每组都使用新的浏览器上下文和两人份菜单，库存为该菜基础用量的三倍，原料按字典中的克或个计量。 [前次存储实验](../2026-11-19/storage-recovery.md) · [完成确认入口](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html#L4495)

页面通过文件打开，设置为离线，视口为 390×844 CSS 像素，启用触摸事件，使用简体中文和上海时区。准备数据通过公开模型接口写入各自新上下文。随后经「买菜」和「做完这顿」打开确认窗口，再执行以下场景。

| 场景 | 确认前的操作 |
| --- | --- |
| 单次确认 | 正常点一次「确认扣减库存」 |
| 五次同步点击 | 对当前按钮同步调用五次 DOM click，监听实际 click 事件数 |
| 另页补库存 | 同一上下文的第二个标签页，将第一项主料增加 10 个原生单位 |
| 另页造成缺料 | 第二个标签页将第一项主料数量设为 0 |
| 另页改人数 | 第二个标签页把用餐人数从 2 改为 3 |

这三道菜的第一项主料均以克计量，因此补库存场景各增加 10 克。第二个标签页通过发布版模型接口更新，主页面读取同一存储键后再确认。同步点击通过 DOM 事件构造，其他确认使用触摸模拟。它们的输入方式和页面变化分别记录在脚本中。 [浏览器定位与交互接口](https://playwright.dev/python/docs/api/class-locator) · [完整步骤](../../bench/2026-11-21/finish-consistency.py)

第一次确认被拒绝时，核对完整账本与第二页变更后的账本相等。缺料案例先补回原数量，两个拒绝类别都关闭并重开确认窗口，再检查完成结果。三人份的预期用量按原配方数量乘三除二后向上取整，分别比较每项库存。最后刷新页面检查账本，并核对完成入口已隐藏。

## 结果

| 场景 | 组数 | 第一次完成 | 第一次被拒绝 | 处理后重新确认完成 |
| --- | ---: | ---: | ---: | ---: |
| 单次确认 | 3 | 3 | 0 | 0 |
| 五次同步点击 | 3 | 3 | 0 | 0 |
| 另页补库存 | 3 | 3 | 0 | 0 |
| 另页造成缺料 | 3 | 0 | 3 | 3 |
| 另页改人数 | 3 | 0 | 3 | 3 |
| 合计 | 15 | 9 | 6 | 6 |

番茄炒蛋的两人份需番茄 280 克和鸡蛋 4 个，起始库存为 840 克和 12 个。单次确认与五次同步点击均剩番茄 560 克和鸡蛋 8 个。另页先补入番茄 10 克时，确认后剩 570 克和 8 个。三个同步点击案例各观察到五个 click 事件，最终库存只减少一份用量。 [事件数与数量](../../bench/2026-11-21/finish-consistency-results.json)

另页将番茄设为 0 后，第一次确认显示「还有食材需要补齐或核对」，鸡蛋仍为 12 个，菜单仍含该菜。补回番茄并重开确认后可完成。另页把人数改为 3 后，旧确认显示菜单或用量已变化，库存与菜单保持变更后的记录。重开确认后按番茄 420 克和鸡蛋 6 个扣减，剩余分别为 420 克和 6 个。

全部 15 组最终菜单为空，库存与预期一致，刷新后账本一致。页面运行错误、控制台警告或错误、HTTP 请求计数均为 0。

## 代码路径与适用范围

页面提交函数在已有提交进行时返回，并在完成后释放标记。模型更新会重新读取存储再生成草稿，在浏览器提供 Web Locks 时通过同名锁请求执行。确认窗口记录模式、人数、菜单编号和主料需求，提交时重新核对这些值，随后计算当前缺料并扣减。上述路径与这五类受控场景的结果一致。 [提交函数](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html#L3866) · [模型更新](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html#L3631) · [完成扣减](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html#L3782) · [Web Locks 机制草案](https://w3c.github.io/web-locks/)

场景采用确定的写入顺序。两个标签同时提交完成、浏览器崩溃、持久化失败、多个已选菜和任意写入时序需要另测。五次 DOM 点击没有模拟真实手指的间隔和命中区域，结果应按这一事件构造解释。

## 环境与复现

环境为 Windows 10 AMD64、Python 3.11.3、Playwright 1.62.0 和 Edge 157.0.4341.60。本次会话未提供 Browser 插件，采用普通 Playwright。公开 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。数据均为合成库存。

在仓库根目录运行以下命令。默认通道为 Playwright 安装的 Chromium，本次结果使用已安装的 Edge。

```sh
python -m pip install playwright==1.62.0
python -m playwright install chromium
python bench/2026-11-21/finish-consistency.py
python bench/2026-11-21/finish-consistency.py --channel msedge --output finish-consistency-rerun.json
```

`--html` 可指定固定版 HTML，`--screenshots` 可指定本机截图目录。脚本失败时以非零状态退出。结果包含确认前后账本、事件数、反馈、重开结果和刷新检查。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html) · [来源与许可](../../DATA-SOURCES.md)
