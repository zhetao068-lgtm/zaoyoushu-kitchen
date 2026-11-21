import argparse
import copy
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import sys

from playwright.sync_api import expect, sync_playwright


def stock_quantities(book):
    return {food: item["quantity"] for food, item in book["stock"].items()}


def latest_book(page):
    return page.evaluate("JSON.parse(localStorage.getItem('zhedun:v2')).books.home")


def run_case(browser, entry, recipe, scenario, screenshots):
    viewport = {"width": 390, "height": 844}
    context = browser.new_context(
        viewport=viewport, is_mobile=True, has_touch=True, offline=True,
        locale="zh-CN", timezone_id="Asia/Shanghai",
    )
    page = context.new_page()
    page.set_default_timeout(12_000)
    errors, console_issues, requests = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_issues.append(message.text)
            if message.type in {"warning", "error"} else None)
    context.on("request", lambda request: requests.append(request.url)
               if request.url.startswith(("http:", "https:")) else None)
    actor = None
    try:
        page.goto(entry, wait_until="load")
        assert page.title() == "灶有数 · 手机菜谱"
        expect(page.locator("#library-search")).to_be_visible()
        setup = page.evaluate(
            """async (recipeId) => {
              const recipe = Cookbook.exact.find((item) => item.id === recipeId);
              const needs = MealModel.scaleRecipe(recipe, 2);
              const result = await MealModel.update((state) => {
                state.mode = "home";
                state.notes = [];
                state.books.home = {
                  servings: 2, plan: [recipeId],
                  stock: Object.fromEntries(Object.entries(needs).map(
                    ([food, quantity]) => [food, {quantity: quantity * 3}]
                  )),
                };
              });
              return {
                saved: result.saved, needs,
                units: Object.fromEntries(Object.keys(needs).map(
                  (food) => [food, MealCatalog.ingredients[food].unit]
                )),
              };
            }""", recipe["id"],
        )
        assert setup["saved"] is True
        page.reload(wait_until="load")
        page.locator(".primary-nav a[href='#shop']").tap()
        expect(page.locator("#view-shop")).to_be_visible()
        page.evaluate(
            """() => {
              globalThis.__finishEvents = 0;
              document.getElementById('confirm-finish').addEventListener(
                'click', () => { globalThis.__finishEvents += 1; }
              );
            }"""
        )
        page.locator("#finish-meal").tap()
        expect(page.locator("#finish-dialog")).to_be_visible()
        original = latest_book(page)
        changed = copy.deepcopy(original)
        first_food = next(iter(setup["needs"]))

        if scenario in {"stock-topup", "stock-shortage", "servings-change"}:
            actor = context.new_page()
            actor.on("pageerror", lambda error: errors.append(str(error)))
            actor.on("console", lambda message: console_issues.append(message.text)
                     if message.type in {"warning", "error"} else None)
            actor.goto(entry, wait_until="load")
            changed = actor.evaluate(
                """async ({scenario, food}) => {
                  const result = await MealModel.update((state) => {
                    const book = state.books.home;
                    if (scenario === 'stock-topup') book.stock[food].quantity += 10;
                    if (scenario === 'stock-shortage') book.stock[food].quantity = 0;
                    if (scenario === 'servings-change') book.servings = 3;
                  });
                  if (!result.saved || result.error) throw new Error('Synthetic actor update failed');
                  return MealModel.snapshot().books.home;
                }""",
                {"scenario": scenario, "food": first_food},
            )
            page.wait_for_function(
                """({food, quantity, servings}) => {
                  const book = JSON.parse(localStorage.getItem('zhedun:v2')).books.home;
                  return book.stock[food].quantity === quantity && book.servings === servings;
                }""",
                arg={"food": first_food, "quantity": changed["stock"][first_food]["quantity"],
                     "servings": changed["servings"]},
            )
            expect(page.locator("#finish-dialog")).to_be_visible()

        before_first = copy.deepcopy(changed)
        if scenario == "five-event-burst":
            page.locator("#confirm-finish").evaluate("(button) => { for (let n=0; n<5; n+=1) button.click(); }")
        else:
            page.locator("#confirm-finish").tap()

        rejected = scenario in {"stock-shortage", "servings-change"}
        if rejected:
            expect(page.locator("#finish-feedback")).not_to_be_empty()
            expect(page.locator("#finish-dialog")).to_be_visible()
            after_first = latest_book(page)
            assert after_first == changed
            message = page.locator("#finish-feedback").inner_text()
            if scenario == "stock-shortage":
                assert "补齐或核对" in message
            else:
                assert "菜单或用量已变化" in message
        else:
            expect(page.locator("#finish-dialog")).to_be_hidden()
            page.wait_for_function("JSON.parse(localStorage.getItem('zhedun:v2')).books.home.plan.length === 0")
            after_first = latest_book(page)
            message = ""
            expected_first = {food: changed["stock"][food]["quantity"] - amount
                              for food, amount in setup["needs"].items()}
            assert stock_quantities(after_first) == expected_first
            assert after_first["plan"] == []

        first_events = page.evaluate("globalThis.__finishEvents")
        assert first_events == (5 if scenario == "five-event-burst" else 1)
        if screenshots and recipe["id"] == "tomato-eggs":
            if rejected:
                page.locator("#finish-feedback").scroll_into_view_if_needed()
            page.screenshot(path=str(screenshots / (scenario + ".png")), animations="disabled")

        recovered = False
        final = after_first
        if rejected:
            page.locator("#finish-dialog [data-close]").tap()
            if scenario == "stock-shortage":
                changed = actor.evaluate(
                    """async ({food, quantity}) => {
                      const result = await MealModel.update((state) => {
                        state.books.home.stock[food].quantity = quantity;
                      });
                      if (!result.saved || result.error) throw new Error('Synthetic replenishment failed');
                      return MealModel.snapshot().books.home;
                    }""",
                    {"food": first_food, "quantity": original["stock"][first_food]["quantity"]},
                )
                page.wait_for_function(
                    "(data) => JSON.parse(localStorage.getItem('zhedun:v2')).books.home.stock[data.food].quantity === data.quantity",
                    arg={"food": first_food, "quantity": changed["stock"][first_food]["quantity"]},
                )
            page.locator("#finish-meal").tap()
            expect(page.locator("#finish-dialog")).to_be_visible()
            page.locator("#confirm-finish").tap()
            expect(page.locator("#finish-dialog")).to_be_hidden()
            page.wait_for_function("JSON.parse(localStorage.getItem('zhedun:v2')).books.home.plan.length === 0")
            final = latest_book(page)
            expected_needs = {food: (amount * changed["servings"] + 1) // 2
                              for food, amount in setup["needs"].items()}
            assert stock_quantities(final) == {
                food: changed["stock"][food]["quantity"] - needed
                for food, needed in expected_needs.items()
            }
            assert final["plan"] == []
            recovered = True

        page.reload(wait_until="load")
        assert latest_book(page) == final
        expect(page.locator("#finish-meal")).to_be_hidden()
        assert not errors and not console_issues and not requests, (errors, console_issues, requests)
        return {
            "recipeId": recipe["id"], "recipeName": recipe["name"], "scenario": scenario,
            "viewportCssPx": viewport, "needsAtTwoServings": setup["needs"], "units": setup["units"],
            "originalBook": original, "bookBeforeFirstConfirm": before_first,
            "firstConfirmClickEvents": first_events,
            "firstConfirmationRejected": rejected, "firstFeedback": message,
            "bookAfterFirstConfirm": after_first,
            "recoveredByReopeningConfirmation": recovered,
            "finalBook": final, "persistedAfterReload": True,
            "runtimeErrors": len(errors), "consoleWarningsOrErrors": len(console_issues),
            "httpRequests": len(requests),
        }
    finally:
        context.close()


def main():
    cli = argparse.ArgumentParser(description="Offline completion confirmation with repeated clicks and a second-tab writer.")
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
                recipes = tab.evaluate("Cookbook.exact.slice(0,3).map(({id,name}) => ({id,name}))")
            finally:
                probe.close()
            scenarios = ["single-confirm", "five-event-burst", "stock-topup", "stock-shortage", "servings-change"]
            rows = [run_case(browser, args.html.resolve().as_uri(), recipe, scenario, args.screenshots)
                    for recipe in recipes for scenario in scenarios]
            result = {
                "artifact": {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()},
                "environment": {
                    "python": platform.python_version(), "platform": platform.system(),
                    "platformRelease": platform.release(), "machine": platform.machine(),
                    "playwright": importlib.metadata.version("playwright"),
                    "channel": args.channel, "browser": browser.version,
                    "browserPlugin": "Browser plugin not available; regular Playwright used",
                },
                "method": "First three measured recipes, two-serving needs times three as initial stock, one 390x844 touch viewport and five scenarios. The burst dispatches five synchronous DOM click events. Cross-tab fixtures update the released model in a second page of the same fresh context.",
                "cases": len(rows),
                "summary": [{
                    "scenario": scenario,
                    "cases": sum(row["scenario"] == scenario for row in rows),
                    "firstRejected": sum(row["scenario"] == scenario and row["firstConfirmationRejected"] for row in rows),
                    "recovered": sum(row["scenario"] == scenario and row["recoveredByReopeningConfirmation"] for row in rows),
                } for scenario in scenarios],
                "rows": rows,
                "limitation": "Browser emulation and controlled same-context writers. The synthetic click burst does not reproduce physical touch timing. Real handsets, crashes, browser quota failures, multiple selected recipes and different browser channels are outside the test.",
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
