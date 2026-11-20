import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import re
import sys

from playwright.sync_api import expect, sync_playwright


def progress(page):
    text = page.locator("#recipe-progress").inner_text()
    match = re.fullmatch(r"第\s*(\d+)\s*/\s*(\d+)\s*步", text)
    assert match, text
    expect(page.locator("#recipe-steps > li:visible")).to_have_count(1)
    current = page.locator("#recipe-steps > li[aria-current='step']")
    assert int(current.get_attribute("value")) == int(match[1])
    return {"currentStep": int(match[1]), "totalSteps": int(match[2]), "text": text}


def search_recipe(page, name):
    page.locator("#library-search").fill(name)
    page.locator("#global-search-form button[type=submit]").tap()
    expect(page.locator("#view-library")).to_be_visible()


def run_case(browser, entry, viewport, recipe, scenario, screenshots):
    context = browser.new_context(
        viewport=viewport, is_mobile=True, has_touch=True, device_scale_factor=1,
        offline=True, locale="zh-CN", timezone_id="Asia/Shanghai",
    )
    page = context.new_page()
    page.set_default_timeout(12_000)
    errors, console_issues, requests = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_issues.append(message.text)
            if message.type in {"warning", "error"} else None)
    page.on("request", lambda request: requests.append(request.url)
            if request.url.startswith(("http:", "https:")) else None)
    try:
        page.goto(entry, wait_until="load")
        assert page.title() == "灶有数 · 手机菜谱"
        # Seed only a fresh context with the selected public recipe's exact
        # two-serving quantities. No existing browser profile is accessed.
        setup = page.evaluate(
            """async (recipeId) => {
              const recipe = Cookbook.exact.find((item) => item.id === recipeId);
              const needs = MealModel.scaleRecipe(recipe, 2);
              const result = await MealModel.update((state) => {
                state.mode = "home";
                state.notes = [];
                state.books.home = {
                  servings: 2, plan: [],
                  stock: Object.fromEntries(Object.entries(needs).map(
                    ([food, quantity]) => [food, {quantity}]
                  )),
                };
              });
              return {saved: result.saved, needs};
            }""",
            recipe["id"],
        )
        assert setup["saved"] is True
        page.reload(wait_until="load")
        search_recipe(page, recipe["name"])
        page.get_by_role("button", name="做这道：" + recipe["name"], exact=True).tap()
        expect(page.locator("#recipe-dialog")).to_be_visible()
        expect(page.locator("#recipe-progress")).to_contain_text("第 1 /")
        total = page.locator("#recipe-steps > li").count()
        assert total >= 3
        for step in [2, 3]:
            page.locator("#next-cook-step").tap()
            expect(page.locator("#recipe-progress")).to_have_text(f"第 {step} / {total} 步")
        before = progress(page)
        stock_before = page.evaluate("MealModel.snapshot().books.home")
        assert stock_before["plan"] == [recipe["id"]]
        screenshot_prefix = str(viewport["width"]) + "-" + recipe["id"] + "-" + scenario
        if screenshots:
            page.locator("#recipe-progress").scroll_into_view_if_needed()
            page.screenshot(path=str(screenshots / (screenshot_prefix + "-before.png")), animations="disabled")

        if scenario == "close-and-reopen":
            page.locator("#recipe-dialog [data-close]").tap()
            expect(page.locator("#recipe-dialog")).to_be_hidden()
            search_recipe(page, recipe["name"])
            page.get_by_role("button", name="继续做：" + recipe["name"], exact=True).tap()
        elif scenario == "reload-and-reopen":
            page.reload(wait_until="load")
            expect(page.locator("#recipe-dialog")).to_be_hidden()
            search_recipe(page, recipe["name"])
            page.get_by_role("button", name="继续做：" + recipe["name"], exact=True).tap()
        else:
            assert scenario == "back-then-forward"
            page.locator("#prev-cook-step").tap()
            expect(page.locator("#recipe-progress")).to_have_text(f"第 2 / {total} 步")
            page.locator("#next-cook-step").tap()
            expect(page.locator("#recipe-progress")).to_have_text(f"第 3 / {total} 步")

        expect(page.locator("#recipe-dialog")).to_be_visible()
        expect(page.locator("#recipe-progress")).to_be_visible()
        after = progress(page)
        stock_after = page.evaluate("MealModel.snapshot().books.home")
        assert stock_after == stock_before
        assert after["totalSteps"] == before["totalSteps"]
        assert not errors and not console_issues and not requests, (errors, console_issues, requests)
        if screenshots:
            page.locator("#recipe-progress").scroll_into_view_if_needed()
            page.screenshot(path=str(screenshots / (screenshot_prefix + "-after.png")), animations="disabled")
        return {
            "viewportCssPx": viewport,
            "recipeId": recipe["id"], "recipeName": recipe["name"], "scenario": scenario,
            "fixtureServings": 2,
            "fixtureNeeds": setup["needs"],
            "before": before, "after": after,
            "sameStep": before["currentStep"] == after["currentStep"],
            "returnedToFirstStep": before["currentStep"] > 1 and after["currentStep"] == 1,
            "stockAndPlanUnchanged": stock_before == stock_after,
            "runtimeErrors": len(errors), "consoleWarningsOrErrors": len(console_issues),
            "httpRequests": len(requests),
        }
    finally:
        context.close()


def main():
    cli = argparse.ArgumentParser(description="Measure guided cooking-step recovery in isolated offline mobile browser contexts.")
    cli.add_argument("--html", type=Path, default=Path(__file__).resolve().parents[2] / "index.html")
    cli.add_argument("--channel", choices=["chromium", "msedge", "chrome"], default="chromium")
    cli.add_argument("--output", type=Path)
    cli.add_argument("--screenshots", type=Path)
    args = cli.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    content = args.html.read_bytes()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**({} if args.channel == "chromium" else {"channel": args.channel}))
        try:
            probe = browser.new_context(offline=True)
            try:
                tab = probe.new_page()
                tab.goto(args.html.resolve().as_uri(), wait_until="load")
                recipes = tab.evaluate("Cookbook.exact.slice(0, 3).map(({id,name}) => ({id,name}))")
            finally:
                probe.close()
            viewports = [{"width": 320, "height": 568}, {"width": 390, "height": 844}]
            scenarios = ["close-and-reopen", "reload-and-reopen", "back-then-forward"]
            rows = [
                run_case(browser, args.html.resolve().as_uri(), viewport, recipe, scenario, args.screenshots)
                for viewport in viewports for recipe in recipes for scenario in scenarios
            ]
            result = {
                "artifact": {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()},
                "environment": {
                    "python": platform.python_version(), "platform": platform.system(),
                    "platformRelease": platform.release(), "machine": platform.machine(),
                    "playwright": importlib.metadata.version("playwright"),
                    "channel": args.channel, "browser": browser.version,
                },
                "method": "First three measured recipes in release order. Two touch-enabled viewports, three scenarios, and a fresh nonpersistent offline context per case. Each case advances from step 1 to step 3 before its scenario.",
                "cases": len(rows),
                "summary": [
                    {
                        "scenario": scenario,
                        "cases": sum(row["scenario"] == scenario for row in rows),
                        "sameStep": sum(row["scenario"] == scenario and row["sameStep"] for row in rows),
                        "returnedToFirstStep": sum(row["scenario"] == scenario and row["returnedToFirstStep"] for row in rows),
                    }
                    for scenario in scenarios
                ],
                "rows": rows,
                "limitation": "Desktop browser emulation, one browser channel, three recipes and two-serving synthetic stock. No real handset, OS suspension, process termination, screen reader or completed-meal behavior was tested.",
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
