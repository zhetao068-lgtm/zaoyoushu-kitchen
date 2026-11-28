import argparse
from copy import deepcopy
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import sys

from playwright.sync_api import expect, sync_playwright


def navigate(page, route):
    page.locator(".primary-nav a[href='#" + route + "']").tap()
    expect(page.locator("#view-" + route)).to_be_visible()


def book(page):
    return page.evaluate("JSON.parse(JSON.stringify(MealModel.snapshot().books.home))")


def scaled(recipe, servings):
    # Independent integer ceiling of the published two-serving quantities.
    return {food: (quantity * servings + 1) // 2 for food, quantity in recipe["needs"].items()}


def amount(quantity, unit):
    return f"{quantity:,} {unit}"


def search_and_cook(page, recipe, selected=False):
    expect(page.locator("#view-library")).to_be_visible()
    page.locator("#library-search").fill(recipe["name"])
    page.locator("#global-search-form button[type=submit]").tap()
    label = ("继续做：" if selected else "做这道：") + recipe["name"]
    page.get_by_role("button", name=label, exact=True).tap()
    expect(page.locator("#shortage-dialog")).to_be_visible()
    expect(page.locator("#shortage-items li")).to_have_count(1)
    expect(page.locator("#shortage-continue")).to_be_visible()
    expect(page.locator("#shortage-note")).to_contain_text("20%")


def check_detail(page, recipe, expected_needs, servings):
    expect(page.locator("#recipe-dialog")).to_be_visible()
    expect(page.locator("#recipe-meta")).to_contain_text(str(servings) + " 人")
    rendered = page.locator("#recipe-ingredients > div").evaluate_all(
        "rows => Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]))"
    )
    expected = {recipe["foods"][food]["name"]: amount(quantity, recipe["foods"][food]["unit"])
                for food, quantity in expected_needs.items()}
    assert rendered == expected, (rendered, expected)


def shop_stage(page, recipe, expected_needs):
    navigate(page, "shop")
    current = book(page)
    assert current["plan"] == [recipe["id"]]
    actual_needs = page.evaluate("recipeId => MealModel.recipeNeeds(MealModel.snapshot().books.home, recipeId)", recipe["id"])
    assert actual_needs == expected_needs
    observed = page.locator("#shopping-list > .shopping-row").evaluate_all("""rows => Object.fromEntries(rows.map(row => [
      row.querySelector('strong').textContent,
      {summary: row.querySelector('.muted').textContent, status: row.querySelector('.shop-status').textContent}
    ]))""")
    shortfalls = {food: max(0, quantity - current["stock"][food]["quantity"]) for food, quantity in expected_needs.items()}
    assert len(observed) == len(expected_needs)
    for food, quantity in expected_needs.items():
        item = recipe["foods"][food]
        row = observed[item["name"]]
        assert row["summary"] == "需要 " + amount(quantity, item["unit"]) + " · 家里有 " + amount(current["stock"][food]["quantity"], item["unit"])
        expected_status = "还差 " + amount(shortfalls[food], item["unit"]) if shortfalls[food] else "家里够用"
        assert row["status"] == expected_status
    disabled = page.locator("#finish-meal").is_disabled()
    assert disabled == any(shortfalls.values())
    return {"servings": current["servings"], "needs": actual_needs, "shortfalls": shortfalls,
            "adjustmentPresent": "adjustments" in current, "finishDisabled": disabled, "rendered": observed}


def run_case(browser, entry, recipe, initial_servings, offset, screenshots):
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                  has_touch=True, device_scale_factor=1, offline=True,
                                  locale="zh-CN", timezone_id="Asia/Shanghai")
    page = context.new_page()
    page.set_default_timeout(12_000)
    errors, issues, requests = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: issues.append(message.text) if message.type in {"warning", "error"} else None)
    page.on("request", lambda request: requests.append(request.url) if request.url.startswith(("http:", "https:")) else None)
    baseline = scaled(recipe, initial_servings)
    target = next(iter(baseline))
    available = (baseline[target] * 4 + 4) // 5
    assert 0 < available < baseline[target]
    stock = {food: {"quantity": available if food == target else quantity} for food, quantity in baseline.items()}
    adjusted = {**baseline, target: available}
    try:
        page.goto(entry, wait_until="load")
        assert page.title() == "灶有数 · 手机菜谱" and page.url.startswith(entry)
        expect(page.locator("#library-search")).to_be_visible()
        assert page.locator("nextjs-portal, vite-error-overlay, #webpack-dev-server-client-overlay").count() == 0
        assert page.evaluate("""async fixture => {
          const result = await MealModel.update(state => {
            state.mode = 'home';
            state.books.home = {servings: fixture.servings, plan: [], stock: fixture.stock};
          });
          return result.saved;
        }""", {"servings": initial_servings, "stock": stock}) is True
        page.reload(wait_until="load")
        search_and_cook(page, recipe)
        initial_warning = page.locator("#shortage-items").inner_text()
        page.locator("#shortage-continue").tap()
        check_detail(page, recipe, adjusted, initial_servings)
        before = book(page)
        assert before["adjustments"] == {recipe["id"]: {"servings": initial_servings, "needs": {target: available}}}
        assert before["stock"] == stock and before["plan"] == [recipe["id"]]
        page.locator("#recipe-dialog [data-close]").tap()
        initial_stage = shop_stage(page, recipe, adjusted)
        navigate(page, "library")
        control = page.locator("#servings-more" if offset > 0 else "#servings-less")
        blocked = not 1 <= initial_servings + offset <= 8
        after_change, after_return, repeat_warning = None, None, None
        if blocked:
            expect(control).to_be_disabled()
            assert book(page) == before
            final_expected = before
        else:
            expect(control).to_be_enabled()
            control.tap()
            changed_servings = initial_servings + offset
            expect(page.locator("#servings-count")).to_have_text(f"{changed_servings} 人")
            changed = book(page)
            assert "adjustments" not in changed
            assert changed["stock"] == stock and changed["plan"] == before["plan"]
            after_change = shop_stage(page, recipe, scaled(recipe, changed_servings))
            navigate(page, "library")
            page.locator("#servings-less" if offset > 0 else "#servings-more").tap()
            expect(page.locator("#servings-count")).to_have_text(f"{initial_servings} 人")
            restored_servings = book(page)
            assert "adjustments" not in restored_servings
            assert restored_servings["stock"] == stock and restored_servings["plan"] == before["plan"]
            after_return = shop_stage(page, recipe, baseline)
            assert after_return["finishDisabled"]
            if screenshots and recipe["id"] == "tomato-eggs" and initial_servings == 2 and offset == 1:
                page.screenshot(path=str(screenshots / "returned-to-two-needs-reconfirmation.png"), animations="disabled")
            navigate(page, "library")
            search_and_cook(page, recipe, selected=True)
            repeat_warning = page.locator("#shortage-items").inner_text()
            assert repeat_warning == initial_warning
            if screenshots and recipe["id"] == "tomato-eggs" and initial_servings == 2 and offset == 1:
                page.screenshot(path=str(screenshots / "shortage-reconfirmation.png"), animations="disabled")
            page.locator("#shortage-continue").tap()
            check_detail(page, recipe, adjusted, initial_servings)
            assert book(page) == before
            page.locator("#recipe-dialog [data-close]").tap()
            final_expected = deepcopy(before)
        page.reload(wait_until="load")
        assert book(page) == final_expected
        assert page.evaluate("JSON.parse(localStorage.getItem(MealModel.key)).books.home") == final_expected
        assert not errors and not issues and not requests, (errors, issues, requests)
        return {"recipeId": recipe["id"], "recipeName": recipe["name"], "initialServings": initial_servings,
                "offset": offset, "targetIngredient": target, "baseTwoServingNeeds": recipe["needs"],
                "catalogFoodMetadata": recipe["foods"], "initialStock": stock, "initialAdjustment": before["adjustments"],
                "boundControlDisabled": blocked, "initial": initial_stage, "afterChange": after_change,
                "afterReturning": after_return, "initialShortageText": initial_warning, "repeatedShortageText": repeat_warning,
                "readjustmentConfirmed": not blocked, "stockAndPlanPreserved": True,
                "reloadPreservedFinalAdjustment": True, "runtimeErrors": len(errors),
                "consoleWarningsOrErrors": len(issues), "httpRequests": len(requests)}
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, default=Path(__file__).resolve().parents[2] / "index.html")
    parser.add_argument("--channel", default=None)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    content = args.html.read_bytes()
    entry = args.html.resolve().as_uri()
    with sync_playwright() as runner:
        browser = runner.chromium.launch(headless=True, channel=args.channel)
        try:
            probe = browser.new_context(offline=True)
            try:
                tab = probe.new_page()
                tab.goto(entry, wait_until="load")
                recipes = tab.evaluate("""Cookbook.exact.slice(0,3).map(({id,name,needs}) => ({id,name,needs,
                  foods: Object.fromEntries(Object.keys(needs).map(food => [food, {
                    name: MealCatalog.ingredients[food].name, unit: MealCatalog.ingredients[food].unit
                  }]))
                }))""")
            finally:
                probe.close()
            rows = [run_case(browser, entry, recipe, servings, offset, args.screenshots)
                    for recipe in recipes for servings in [1, 2, 8] for offset in [-1, 1]]
            result = {
                "artifact": {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()},
                "environment": {"python": platform.python_version(), "system": platform.system(),
                                "release": platform.release(), "machine": platform.machine(),
                                "playwright": importlib.metadata.version("playwright"), "channel": args.channel,
                                "browser": browser.version, "browserPlugin": "Browser plugin not available; regular Playwright used"},
                "method": "Three published recipes times starting servings 1, 2, 8 times minus/plus. First save a within-20-percent adjustment through the real UI. Enabled changes are reversed and the shortage is reconfirmed; disabled bound controls are observed without forced clicks. Independent integer arithmetic checks model and rendered quantities.",
                "viewportCssPx": {"width": 390, "height": 844}, "cases": len(rows),
                "enabledChanges": sum(not row["boundControlDisabled"] for row in rows),
                "disabledBounds": sum(row["boundControlDisabled"] for row in rows), "rows": rows,
                "limitation": "One emulated browser and three deterministic fixtures, with exact synthetic quantities and available storage. No cooking trials, real handset, multiple selected recipes, estimated stock, cross-tab race or broad quantitative-model correctness claim.",
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
