# 删除库存与清除本机数据的实际边界

*What pantry deletion and private-data clearing actually remove*

灶有数工程论文 · 北京时间 2026 年 11 月 22 日

## 摘要

删除一条库存、清空库存和清除本机私人数据涉及不同的状态范围。本实验使用公开离线版，在六种操作范围下分别取消和确认，共执行 12 组双标签页浏览器流程。六组取消均保持原状态。六组确认各自符合预期范围，另页模型和记录列表同步变化，两页刷新后仍一致。清空库存保留菜单、人数和做菜记录；清除私人数据重置自己的账本与记录，同时保留示例账本。两组清除私人数据的场景中，另页旧编辑框仍显示原文字，重新保存被拒绝，之前下载的文件仍在。 [实验脚本](../../bench/2026-11-22/deletion-scope.py) · [完整状态比较](../../bench/2026-11-22/deletion-scope-results.json)

## English abstract

We exercised six deletion scopes with cancel and confirm decisions in 12 fresh, offline, touch-enabled browser contexts, each containing two tabs. All six cancellations preserved the original app state. All six confirmations matched their explicitly constructed expected state. The peer model and note list updated without reload, and both tabs preserved the expected state after reload. Clearing pantry stock retained the selected menu, servings and cooking notes. Clearing private data reset the home book and removed notes while preserving the modified demonstration book and current mode. In the two confirmed private-clear cases, an already open peer note editor retained its old text. Saving that deleted record was rejected, and the previously downloaded copy remained byte-identical. Unrelated local-storage and session-storage sentinels also remained. This measures logical app-state deletion with available storage in one emulated browser, without assessing forensic erasure, website submissions, other profiles or physical phones. [Script](../../bench/2026-11-22/deletion-scope.py) · [Results](../../bench/2026-11-22/deletion-scope-results.json)

## 问题与方法

前面的研究验证了单条导出的字段选择。本次检查用户点删除时的范围，以及删除后的另页状态。实验不读取实际用户库存和做法，所有数据都写入新建的 Playwright 浏览器上下文。每组使用 390×844 CSS 像素视口、触摸、离线模式、简体中文与上海时区，通过 file URL 打开固定 HTML。 [前次导出实验](../2026-11-21/notes-text-export.md) · [Playwright 上下文隔离](https://playwright.dev/python/docs/browser-contexts) · [设备模拟范围](https://playwright.dev/python/docs/emulation)

每组夹具包含自己的三人份账本，已选番茄炒蛋，番茄 711 克、鸡蛋 7 个，并保存番茄 400 克的菜单用量调整。示例账本改为四人份、番茄 913 克，其余六项示例库存与两道示例菜单保留。另有两条合成做菜记录。这样可以分别观察自己的数据、示例数据、菜单与记录是否被误改。

准备数据通过公开模型接口保存，随后完全通过页面的删除按钮和确认窗口操作。六种范围为删除自己的番茄、删除示例的番茄、清空自己的库存、删除一条做菜记录，以及在自己和示例两种模式下清除私人数据。每种都分别取消与确认，共 6×2＝12 组。

脚本独立构造每次操作后的完整状态对象，比较当前页、另页以及两页刷新后的值。另页停留在做菜记录列表。两组确认清除私人数据的场景还预先打开另页的旧记录编辑框，之后尝试再次保存。两组清除操作及其取消对照均提前实际下载一条记录，比较删除动作前后的文件字节。

## 取消与确认的结果

六组取消均与完整初始状态一致。下表列出六组确认的状态结果，每行对应一组实际操作。

| 确认操作 | 自己的库存 | 自己的菜单、人数与调整 | 做菜记录 | 示例账本 |
| --- | --- | --- | --- | --- |
| 删除自己的番茄 | 删除番茄，保留鸡蛋 | 保留 | 保留 2 条 | 保留 |
| 删除示例的番茄 | 保留 2 项 | 保留 | 保留 2 条 | 只删示例番茄 |
| 清空自己的库存 | 清空 | 保留 | 保留 2 条 | 保留 |
| 删除一条记录 | 保留 2 项 | 保留 | 剩余另一条 | 保留 |
| 自己模式清除私人数据 | 清空 | 空菜单、两人份、移除调整 | 清空 | 保留，包括 913 克番茄 |
| 示例模式清除私人数据 | 清空 | 空菜单、两人份、移除调整 | 清空 | 保留，包括 913 克番茄 |

全部 12 组在当前页和另页都得到预期状态，两页刷新后仍相同。确认清空库存后的买菜页面继续保留一道番茄炒蛋，但材料转为待核对，“做完这顿”不可用。删除记录与清空库存是分别实现的操作。 [单条库存删除](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L4305) · [清空库存](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L4420) · [单条记录删除](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L4811)

清除私人数据的处理函数替换 books.home 并清空 notes，没有重置 books.demo 或 mode。因此在示例模式发起操作后，页面仍处于示例模式。表格中保留示例账本的结果包含人为改过的数量，并非加载出一份全新的默认示例。 [清除处理函数](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L4872)

## 另页旧编辑框与下载副本

两组确认清除私人数据之前，另页已打开第一条合成记录的编辑框。清除后，模型和底层列表已经没有记录，编辑框仍然打开。其菜名、食材与步骤输入框保留原文字。脚本读取这三个 input/textarea 的实际值并保存到结果中的 staleFormValuesAfterDeletion。

点击旧编辑框的保存按钮，两组都得到“这条记录已经删除，请重新新建。”，共享状态保持清空，没有重新创建旧编号。这个保护发生在保存时，不能据此宣称清除操作已经移除了所有打开界面上的旧文字。 [编辑保存检查](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L4860) · [跨页存储事件处理](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L4520)

清除私人数据的两组确认及两组取消对照中，之前实际下载的文件均存在，内容与下载时逐字节一致。确认窗口本来就提示“已经下载的文件和已投稿菜谱需要另行删除”。本次只验证离线下载副本，网站投稿不在实验中。

另行写入的无关 localStorage 键在 12 组中均保留，当前页 sessionStorage 哨兵在刷新后也保留。实验读取的应用键 zhedun:v2 仍存在，其内容是更新后的 JSON 状态。这种实现是应用内部字段的逻辑移除。Web Storage 的键值接口与跨文档通知机制可以解释共享状态的读取路径，不能提供磁盘数据擦除证明。 [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface) · [发布版写入路径](https://github.com/zhetao068-lgtm/zaoyoushu-kitchen/blob/f637d2d0a67417eacb917b121b499c967dd5b610/index.html#L3631)

## 环境、局限与复现

环境为 Windows 10 AMD64、Python 3.11.3、Playwright 1.62.0、Edge 157.0.4341.60。输入 HTML 共 2,263,560 字节，SHA-256 为 `f428a0c2d2f8de7af2f3ac7435635af5c054d77110c5c6dd49300cdc1b2839d4`。12 组执行没有记录到运行时错误、控制台警告或错误、HTTP/HTTPS 请求。

测试使用桌面浏览器的手机参数模拟，存储读写正常。它不覆盖系统磁盘恢复、浏览器备份、其他设备或用户配置、已投稿内容、存储写入失败及任意并发写入。旧编辑框保留文字是当前实际观察到的界面边界。未来若要把“清除”扩展为清理所有打开页面的编辑状态，需要单独设计并测试对应通知与表单重置流程。

在仓库根目录运行。默认使用 Playwright 的 Chromium，本次使用已安装的 Edge。`--html` 可指定固定版，`--screenshots` 可把检查截图保存到本机目录。

```sh
python -m pip install playwright==1.62.0
python -m playwright install chromium
python bench/2026-11-22/deletion-scope.py
python bench/2026-11-22/deletion-scope.py --channel msedge --output deletion-scope-rerun.json
```

脚本在状态不符时以非零状态退出。结果包含完整合成前后状态、确认文字、跨页与刷新检查、旧表单值和下载保留检查。 [固定版 HTML](https://raw.githubusercontent.com/zhetao068-lgtm/zaoyoushu-kitchen/f637d2d0a67417eacb917b121b499c967dd5b610/index.html) · [来源与许可](../../DATA-SOURCES.md)
