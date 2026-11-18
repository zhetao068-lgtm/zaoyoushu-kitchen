# 三种手机视口下的做菜流程与控件尺寸

*Cooking flow and control geometry at three mobile viewport sizes*

灶有数工程论文 · 北京时间 2026 年 11 月 18 日

## 摘要

手机页面的流程可运行与控件易点程度需要分别测量。本实验在 320×568、390×844 和 430×932 CSS 像素的浏览器视口中，断网打开同一公开离线包。三个独立上下文都通过 7 个功能检查点，包括别名入库、逐步做菜、确认扣减和刷新。18 个界面状态没有测得页面或当前对话框的横向溢出。153 次可见控件边框盒观察中，有 86 次的宽或高小于 44 CSS 像素，其中 16 次小于 24 CSS 像素。该尺寸筛查没有评定 WCAG 符合性，真机触摸体验仍待验证。 [实验脚本](../../bench/2026-11-18/mobile-flow.py) · [完整观察数据](../../bench/2026-11-18/mobile-flow-results.json)

## English abstract

We exercised a public standalone cooking app offline in three fresh touch-enabled browser contexts at 320×568, 390×844, and 430×932 CSS pixels. All three contexts passed seven functional checkpoints, including alias-based pantry capture, rejection of a mixed invalid batch, forward and backward step navigation, stock deduction, and persistence after reload. Across six sampled states per viewport, neither the page nor the active dialog had horizontal overflow. Of 153 enabled-control border-box observations intersecting the viewport, 86 had a width or height below 44 CSS pixels, including 16 below 24. These are repeated state observations rather than unique controls. Geometry screening omits labels, pseudo-elements, spacing and other WCAG exceptions. The experiment reports desktop-browser emulation and supplies no real-handset or WeChat usability measurement. [Script](../../bench/2026-11-18/mobile-flow.py) · [Results](../../bench/2026-11-18/mobile-flow-results.json)

## 问题与方法

流程实验以番茄炒蛋为例，每个视口重新创建非持久浏览器上下文。页面从文件打开，网络设为离线，启用触摸事件，设备缩放因子为 1，语言为简体中文，时区为上海。本次会话未提供 Browser 插件，实验使用 Python Playwright 驱动 Edge。Playwright 的视口与触摸模拟参数用于复查布局和操作顺序。 [Playwright 模拟参数](https://playwright.dev/python/docs/emulation)

每个上下文逐项执行以下检查。点击动作用 Playwright 的 `tap()`，录入使用 `fill()`，后者直接填入合成文字。

1. 打开页面，标题正确且首批显示 12 条菜谱。
2. 空库存点击「做这道」，番茄和鸡蛋均提示待核对，「继续制作」隐藏。
3. 提交「土豆250克 鸡精10克」，界面留在库存页，存储键原始值与提交前一致。
4. 提交「西红柿300克 鸡蛋4个」，存成番茄 300 克与鸡蛋 4 个，跳回找菜页。
5. 找到番茄炒蛋并进入逐步做菜，从第 1 步前进到第 2 步再返回，然后走完全部 4 步，最后显示全部步骤。
6. 在买菜页确认「做完这顿」，主料扣去番茄 280 克和鸡蛋 4 个，库存剩番茄 20 克和鸡蛋 0 个，菜单清空。
7. 刷新页面，读回相同的剩余库存与空菜单。

六个尺寸采样时刻依次为首次找菜、缺料对话框、空库存录入、做菜第 1 步、买菜清单和完成确认。做菜采样前将进度文字滚入视口，其余采样在各状态的自然滚动位置。只采集与视口相交的启用按钮、链接、输入框、选择框、文本域与详情标题。有打开的模态框时，只采集当前模态框中的控件。

尺寸取 `getBoundingClientRect()` 的宽高。宽或高小于阈值就计入对应列，两个阈值的集合重叠。W3C 的 AA 最小尺寸说明采用 24 CSS 像素，AAA 增强尺寸说明采用 44 CSS 像素，并列有间距、等效控件、行内和用户代理控件等适用例外。本次保留原始尺寸做几何筛查。 [W3C 最小尺寸说明](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [W3C 增强尺寸说明](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

## 结果

每格按「控件观察数 / 宽或高小于 24 / 宽或高小于 44」排列，单位为 CSS 像素。

| 采样状态 | 320×568 | 390×844 | 430×932 |
| --- | ---: | ---: | ---: |
| 首次找菜 | 20 / 2 / 14 | 28 / 6 / 22 | 32 / 8 / 26 |
| 缺料对话框 | 3 / 0 / 1 | 3 / 0 / 1 | 3 / 0 / 1 |
| 库存录入 | 9 / 0 / 2 | 9 / 0 / 2 | 9 / 0 / 2 |
| 做菜第 1 步 | 2 / 0 / 0 | 3 / 0 / 1 | 2 / 0 / 2 |
| 买菜清单 | 8 / 0 / 3 | 8 / 0 / 3 | 8 / 0 / 3 |
| 完成确认 | 2 / 0 / 1 | 2 / 0 / 1 | 2 / 0 / 1 |
| 合计 | 44 / 2 / 21 | 53 / 6 / 30 | 56 / 8 / 35 |

在 320 像素宽的首屏里，人数增减按钮均为 35×40 CSS 像素，第一条菜名按钮为 72×22.5，旁边的「做这道」为 76×40。食材核对和完成确认的关闭按钮为 38×38。较高的视口会看到更多菜谱行，因此控件观察数也随之增加。三个视口的数据共同保存在逐控件结果中，重复出现的控件按各次观察分别计数。 [控件级结果](../../bench/2026-11-18/mobile-flow-results.json)

三次流程共通过 21 个检查点。18 个状态的页面及当前对话框横向溢出测量均为 0 CSS 像素。三个上下文的页面运行错误、控制台警告或错误，以及 HTTP 请求数均为 0。合成原料确切扣减到 20 克番茄和 0 个鸡蛋。逐步导航没有将「返回全部步骤」当作完成扣库存的操作。

## 环境、局限与复现

测量环境为 Windows 10 AMD64、Python 3.11.3、Playwright 1.62.0 与 Edge 157.0.4341.60。输入是公开 HTML 和合成库存。HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。测试上下文独立于使用者的日常浏览器配置。

桌面浏览器模拟没有覆盖 Android、iOS、微信内置浏览器、真实软键盘、手指遮挡、屏幕阅读器和不同字体的表现。边框盒筛查没有计算标签或伪元素扩大的点击区，也未逐一判定间距和等效入口等例外。不能据此给出 WCAG 通过率或真实用户的点按成功率。流程仅覆盖一种定量菜、两人份和本地文件打开。

在仓库根目录运行下列命令。已安装 Edge 时可选择 `--channel msedge`，记录本次通道的命令也列在下方。默认使用 Playwright 自带的 Chromium，浏览器版本与字体变化可能改变尺寸观察数。

```sh
python -m pip install playwright==1.62.0
python -m playwright install chromium
python bench/2026-11-18/mobile-flow.py
python bench/2026-11-18/mobile-flow.py --channel msedge --output mobile-flow-rerun.json
```

`--html` 接受固定版 HTML 文件，`--screenshots` 可指定本机截图目录。结果包含输入哈希、环境、检查点与每个控件的尺寸。脚本检查失败时以非零状态退出。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/961403142b58a4ffb673d69c905d3a996f69a872/index.html) · [发布版来源与许可](../../DATA-SOURCES.md)
