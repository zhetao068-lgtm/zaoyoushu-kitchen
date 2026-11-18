import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import sys

from playwright.sync_api import expect, sync_playwright


def geometry(page, state):
    return page.evaluate(
        """(state) => {
          const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
          const root = dialog ?? document;
          const controls = [...root.querySelectorAll(
            'button, a[href], input:not([type="hidden"]), select, textarea, summary'
          )].filter((node) => {
            const rect = node.getBoundingClientRect();
            const css = getComputedStyle(node);
            return !node.disabled && !node.closest('[hidden], [inert]') &&
              css.visibility !== 'hidden' && css.display !== 'none' &&
              rect.width > 0 && rect.height > 0 && rect.bottom > 0 &&
              rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
          }).map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              tag: node.tagName.toLowerCase(),
              id: node.id || null,
              label: node.getAttribute('aria-label') || node.textContent.trim().slice(0, 80) ||
                document.querySelector('label[for="' + node.id + '"]')?.textContent.trim() || null,
              widthCssPx: Number(rect.width.toFixed(3)),
              heightCssPx: Number(rect.height.toFixed(3)),
              below24By24: rect.width < 24 || rect.height < 24,
              below44By44: rect.width < 44 || rect.height < 44,
            };
          });
          return {
            state,
            horizontalOverflowCssPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            dialogOverflowCssPx: dialog ? Math.max(0, dialog.scrollWidth - dialog.clientWidth) : 0,
            controls: controls.length,
            below24By24: controls.filter((node) => node.below24By24).length,
            below44By44: controls.filter((node) => node.below44By44).length,
            measurements: controls,
          };
        }""",
        state,
    )


def run_viewport(browser, entry, width, height, screenshot_dir):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
        offline=True,
        locale="zh-CN",
        timezone_id="Asia/Shanghai",
    )
    page = context.new_page()
    page.set_default_timeout(12_000)
    errors, warnings, requests = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: warnings.append(message.text) if message.type in {"warning", "error"} else None)
    page.on("request", lambda request: requests.append(request.url) if request.url.startswith(("http:", "https:")) else None)
    samples = []
    checkpoints = []

    def record(state):
        sample = geometry(page, state)
        assert sample["controls"] > 0, state
        samples.append(sample)
        if screenshot_dir:
            page.screenshot(path=str(screenshot_dir / f"{width}-{state}.png"), animations="disabled")

    def stock():
        return page.evaluate("JSON.parse(localStorage.getItem('zhedun:v2')).books.home")

    try:
        page.goto(entry, wait_until="load")
        assert page.title() == "灶有数 · 手机菜谱"
        expect(page.locator("#library-search")).to_be_visible()
        expect(page.locator("#library-list > *")).to_have_count(12)
        checkpoints.append("initial-page-and-twelve-recipes")
        record("initial-library")

        page.get_by_role("button", name="做这道：番茄炒蛋", exact=True).tap()
        expect(page.locator("#shortage-dialog")).to_be_visible()
        expect(page.locator("#shortage-items")).to_contain_text("番茄")
        expect(page.locator("#shortage-items")).to_contain_text("鸡蛋")
        expect(page.locator("#shortage-continue")).to_be_hidden()
        checkpoints.append("unknown-stock-requires-verification")
        record("shortage-dialog")
        page.locator("#shortage-dialog [data-close]").tap()

        page.locator(".primary-nav a[href='#pantry']").tap()
        expect(page.locator("#stock-capture-input")).to_be_visible()
        record("pantry-capture")
        previous = page.evaluate("localStorage.getItem('zhedun:v2')")
        page.locator("#stock-capture-input").fill("土豆250克 鸡精10克")
        page.locator("#stock-capture button[type=submit]").tap()
        expect(page.locator("#stock-capture-error")).to_contain_text("没有识别")
        assert page.evaluate("localStorage.getItem('zhedun:v2')") == previous
        expect(page.locator("#view-pantry")).to_be_visible()
        checkpoints.append("invalid-mixed-batch-keeps-storage-unchanged")
        page.locator("#stock-capture-input").fill("西红柿300克 鸡蛋4个")
        page.locator("#stock-capture button[type=submit]").tap()
        expect(page.locator("#view-library")).to_be_visible()
        assert page.url.endswith("#library")
        assert stock()["stock"]["tomato"]["quantity"] == 300
        assert stock()["stock"]["egg"]["quantity"] == 4
        checkpoints.append("alias-capture-and-return-to-library")

        page.locator("#library-search").fill("番茄炒蛋")
        page.locator("#global-search-form button[type=submit]").tap()
        page.get_by_role("button", name="做这道：番茄炒蛋", exact=True).tap()
        expect(page.locator("#recipe-dialog")).to_be_visible()
        expect(page.locator("#recipe-progress")).to_contain_text("第 1 /")
        expect(page.locator("#recipe-steps > li:visible")).to_have_count(1)
        page.locator("#recipe-progress").scroll_into_view_if_needed()
        record("cooking-step")
        total = page.locator("#recipe-steps > li").count()
        assert total >= 2
        page.locator("#next-cook-step").tap()
        expect(page.locator("#recipe-progress")).to_have_text(f"第 2 / {total} 步")
        page.locator("#prev-cook-step").tap()
        expect(page.locator("#recipe-progress")).to_have_text(f"第 1 / {total} 步")
        for step in range(2, total + 1):
            page.locator("#next-cook-step").tap()
            expect(page.locator("#recipe-progress")).to_have_text(f"第 {step} / {total} 步")
            expect(page.locator("#recipe-steps > li:visible")).to_have_count(1)
        expect(page.locator("#next-cook-step")).to_have_text("返回全部步骤")
        page.locator("#next-cook-step").tap()
        expect(page.locator("#recipe-progress")).to_be_hidden()
        expect(page.locator("#recipe-steps > li:visible")).to_have_count(total)
        assert stock()["plan"] == ["tomato-eggs"]
        checkpoints.append("forward-backward-and-all-steps")
        page.locator("#recipe-dialog [data-close]").tap()

        page.locator(".primary-nav a[href='#shop']").tap()
        expect(page.locator("#view-shop")).to_be_visible()
        assert page.url.endswith("#shop")
        expect(page.locator("#finish-meal")).to_be_enabled()
        record("shopping-list")
        page.locator("#finish-meal").tap()
        expect(page.locator("#finish-dialog")).to_be_visible()
        record("finish-confirmation")
        page.locator("#confirm-finish").tap()
        expect(page.locator("#finish-dialog")).to_be_hidden()
        final = stock()
        assert final["plan"] == []
        assert final["stock"]["tomato"]["quantity"] == 20
        assert final["stock"]["egg"]["quantity"] == 0
        checkpoints.append("finish-deducts-280-grams-and-four-eggs")
        page.reload()
        final = stock()
        assert final["plan"] == []
        assert final["stock"]["tomato"]["quantity"] == 20
        assert final["stock"]["egg"]["quantity"] == 0
        checkpoints.append("reload-retains-finished-stock")
        assert not errors and not warnings and not requests, (errors, warnings, requests)
        return {
            "viewportCssPx": {"width": width, "height": height},
            "checkpointsPassed": checkpoints,
            "recipeSteps": total,
            "runtimeErrors": len(errors),
            "consoleWarningsOrErrors": len(warnings),
            "httpRequests": len(requests),
            "samples": samples,
        }
    finally:
        context.close()


def main():
    cli = argparse.ArgumentParser(description="Offline mobile flow and control border-box geometry from the public HTML.")
    cli.add_argument("--html", type=Path, default=Path(__file__).resolve().parents[2] / "index.html")
    cli.add_argument("--channel", default="chromium", choices=["chromium", "msedge", "chrome"])
    cli.add_argument("--output", type=Path)
    cli.add_argument("--screenshots", type=Path)
    args = cli.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    content = args.html.read_bytes()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**({} if args.channel == "chromium" else {"channel": args.channel}))
        try:
            viewports = [
                run_viewport(browser, args.html.resolve().as_uri(), width, height, args.screenshots)
                for width, height in [(320, 568), (390, 844), (430, 932)]
            ]
            result = {
                "artifact": {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()},
                "environment": {
                    "python": platform.python_version(),
                    "platform": platform.system(),
                    "platformRelease": platform.release(),
                    "machine": platform.machine(),
                    "playwright": importlib.metadata.version("playwright"),
                    "channel": args.channel,
                    "browser": browser.version,
                    "browserPlugin": "not available; regular Playwright used",
                },
                "method": "Fresh nonpersistent browser contexts; offline file URL; touch enabled; CSS pixels. Only enabled controls intersecting the viewport and the active modal are measured.",
                "limitation": "Border-box measurements omit pseudo-elements, labels and WCAG exceptions. This is a geometry audit and an emulated functional flow, not a WCAG conformance or real-handset usability assessment.",
                "viewports": viewports,
            }
        finally:
            browser.close()
    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(output, encoding="utf-8")
    else:
        sys.stdout.write(output)


if __name__ == "__main__":
    main()
