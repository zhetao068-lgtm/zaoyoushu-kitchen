# 做菜记录中的特殊字符与单条导出边界

*Literal text and single-record export boundaries in cooking notes*

灶有数工程论文 · 北京时间 2026 年 11 月 21 日

## 摘要

使用者填写的做法可能含小于号、实体字符或类似 HTML 的文字。本实验把八种合成文字分别填入菜名、食材、步骤、安全提示和口味调整，通过正常表单执行 40 组保存、打开、导出和刷新操作。40 组在首次打开和刷新后均按原文字显示，被检查的文字容器没有生成元素子节点，执行标记均为 0。40 次单条 JSON 导出均与填写的那一份记录一致，只含七个指定字段。该结果限定于这些样例和当前渲染路径。 [实验脚本](../../bench/2026-11-21/notes-text-export.py) · [逐组结果](../../bench/2026-11-21/notes-text-export-results.json)

## English abstract

We submitted eight synthetic text probes through five cooking-note fields in 40 fresh offline browser contexts. Each case used the normal form to save a note, opened it, downloaded the selected-note JSON, reloaded the page, and opened the note again. All 40 cases preserved literal text before and after reload. The inspected text containers had no generated element children, and a harmless local execution marker stayed at zero. Every exported JSON object exactly matched the entered note and contained only name, servings, minutes, ingredients, steps, safety and tasteTip. A separate synthetic stock record remained in browser storage. This finite test covers one browser, these text inputs and the selected-record export structure. It supplies no general XSS, automatic PII-redaction, backend or real-handset security guarantee. [Script](../../bench/2026-11-21/notes-text-export.py) · [Results](../../bench/2026-11-21/notes-text-export-results.json)

## 问题与方法

笔记列表、做法详情和导出文件会接收同一份用户文字。实验沿着实际的「我的」「新增做菜记录」「保存到我的厨房」「打开」「导出」操作，并在刷新后再次打开。每组使用新的断网浏览器上下文，视口为 390×844 CSS 像素，启用触摸事件、简体中文和上海时区。普通 Playwright 驱动已安装的 Edge，本次会话未提供 Browser 插件。

每组先写入番茄 17 克这一条合成库存，再通过表单填写一条两人份、预计 10 分钟的合成做法。五个文字字段中每次只替换一个，八类输入各运行一次，共 8×5＝40 组。

| 输入类别 | 检查意图 |
| --- | --- |
| 小于号、大于号与与号 | 保留普通标点 |
| em 标签形状 | 保留标签文字 |
| 字符实体形状 | 保留原实体写法 |
| script 标签形状 | 观察局部执行标记 |
| 带事件属性的 img 形状 | 观察文本节点与执行标记 |
| 带事件属性的 svg 形状 | 观察文本节点与执行标记 |
| 引号加标签形状 | 检查属性分隔字符 |
| javascript 链接形状 | 检查链接文字 |

包含执行表达式的样例只尝试把测试页面的局部标记设为 1。案例不含收集数据或向外发送内容的操作。输入均在菜名 60 字符限制内，具体字符串随脚本公开。 [输入样例与操作](../../bench/2026-11-21/notes-text-export.py)

每次打开核对目标容器的完整 textContent 与输入相等，且没有元素子节点，同时检查执行标记。列表中的菜名也逐次核对。口味栏包含页面固定前缀，其后文字按输入比较。下载 JSON 后比较完整对象与填写的记录，以及键集合。刷新后重做显示检查，并核对合成库存仍为 17 克。

## 结果

| 目标字段 | 组数 | 首次原文字显示 | 刷新后原文字显示 | 导出内容相同 |
| --- | ---: | ---: | ---: | ---: |
| 菜名 | 8 | 8 | 8 | 8 |
| 食材与用量 | 8 | 8 | 8 | 8 |
| 做法步骤 | 8 | 8 | 8 | 8 |
| 安全和过敏提示 | 8 | 8 | 8 | 8 |
| 口味和调整 | 8 | 8 | 8 | 8 |
| 合计 | 40 | 40 | 40 | 40 |

40 组的目标文字容器在首次打开和刷新后都没有生成元素子节点，执行标记均为 0。比如包含 img 和 onerror 字样的步骤被显示为文字，仍属于一条做法步骤。页面运行错误、控制台警告或错误和 HTTP 请求计数均为 0。 [逐例观测](../../bench/2026-11-21/notes-text-export-results.json)

单条导出的键集合在 40 组中均为 name、servings、minutes、ingredients、steps、safety 和 tasteTip。完整对象与本组填写的做法相等，合成库存仍保存在本机。导出覆盖了这七个字段中的填写文字，字段范围本身不能判断这些文字是否含个人信息。

## 渲染与导出路径

公开版 make 函数通过 textContent 写入文字。笔记列表使用它建立菜名，做法详情也用文字节点建立材料、步骤、提醒和口味说明。DOM 的 textContent 设置会以文字节点替换内容。源代码路径与样例中没有元素子节点的观测一致。 [公开文字节点助手](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html#L3832) · [笔记渲染](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html#L4819) · [DOM textContent 定义](https://dom.spec.whatwg.org/#dom-node-textcontent)

导出函数先由 selectedPayload 构造七个字段的对象，再序列化为 JSON 下载。测试逐次解析实际下载文件后与表单内容比较。页面同时提示发送前检查这份内容。 [字段选择与下载](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html#L4786)

测试沿用 HTML 自带的内容安全策略。内容安全策略可约束资源获取和执行，本次观察的是整个当前页面配置下的结果。其他策略、其他浏览器、另一种 DOM 写入路径及下游软件读取导出文件的行为需分别验证。 [CSP3 机制说明](https://www.w3.org/TR/CSP3/)

## 环境、局限与复现

环境为 Windows 10 AMD64、Python 3.11.3、Playwright 1.62.0 和 Edge 157.0.4341.60。公开 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。案例只使用合成做法、局部测试标记与合成库存。

有限样例不能覆盖全部脚本注入形式。自动识别个人信息、网站投稿与后台处理、真实手机、输入法边界和文件分享过程也需要另测。该实验没有检查真实用户记录。

在仓库根目录运行以下命令。默认使用 Playwright 安装的 Chromium，本次测量使用已安装的 Edge。

```sh
python -m pip install playwright==1.62.0
python -m playwright install chromium
python bench/2026-11-21/notes-text-export.py
python bench/2026-11-21/notes-text-export.py --channel msedge --output notes-text-export-rerun.json
```

`--html` 可指定固定版 HTML，`--screenshots` 可指定本机截图目录。流程检查失败时脚本以非零状态退出。结果包含输入样例、显示检查、下载键集合和执行标记。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/36bd775b4ee3af9ef1bd5882ec7dac415d816c69/index.html) · [来源与许可](../../DATA-SOURCES.md)
