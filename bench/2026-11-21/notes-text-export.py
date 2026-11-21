import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import sys

from playwright.sync_api import expect, sync_playwright


PROBES = [
    ("plain-punctuation", "盐 < 5 克 & 糖 > 1 克"),
    ("em-tag", "<em>合成文字</em>"),
    ("entities", "&lt;img&gt; &amp;"),
    ("script-tag", "<script>globalThis.__noteProbe=1</script>"),
    ("image-event", "<img src=x onerror=globalThis.__noteProbe=1>"),
    ("svg-event", "<svg onload=globalThis.__noteProbe=1></svg>"),
    ("attribute-prefix", '\"><img src=x onerror=globalThis.__noteProbe=1>'),
    ("javascript-link", "<a href=javascript:globalThis.__noteProbe=1>文字</a>"),
]
FIELDS = ["name", "ingredients", "steps", "safety", "taste"]


def assert_literal(page, field, payload, name):
    selectors = {
        "name": "#recipe-title",
        "ingredients": "#recipe-ingredients dt",
        "steps": "#recipe-steps > li",
        "safety": "#recipe-safety-list > li",
        "taste": "#recipe-taste",
    }
    container = page.locator(selectors[field]).first
    expect(container).to_be_visible()
    expected = "口味与调整：" + payload if field == "taste" else payload
    assert container.text_content() == expected
    assert container.locator(":scope > *").count() == 0
    assert page.locator("#recipe-title").text_content() == name
    assert page.evaluate("globalThis.__noteProbe") == 0


def run_case(browser, entry, field, probe_name, payload, screenshots):
    context = browser.new_context(
        viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, offline=True,
        locale="zh-CN", timezone_id="Asia/Shanghai", accept_downloads=True,
    )
    context.add_init_script("globalThis.__noteProbe = 0;")
    page = context.new_page()
    page.set_default_timeout(12_000)
    errors, console_issues, requests = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_issues.append(message.text)
            if message.type in {"warning", "error"} else None)
    page.on("request", lambda request: requests.append(request.url)
            if request.url.startswith(("http:", "https:")) else None)
    expected_note = {
        "name": "合成做法", "servings": 2, "minutes": 10,
        "ingredients": ["合成食材 1 克"], "steps": ["合成步骤"], "safety": ["合成提醒"],
        "tasteTip": "合成口味",
    }
    output_field = "tasteTip" if field == "taste" else field
    expected_note[output_field] = [payload] if field in {"ingredients", "steps", "safety"} else payload
    name = expected_note["name"]
    try:
        page.goto(entry, wait_until="load")
        assert page.title() == "灶有数 · 手机菜谱"
        expect(page.locator("#library-search")).to_be_visible()
        seeded = page.evaluate(
            """async () => {
              const result = await MealModel.update((state) => {
                state.books.home.stock = {tomato: {quantity: 17}};
              });
              return result.saved;
            }"""
        )
        assert seeded is True
        page.locator(".primary-nav a[href='#notebook']").tap()
        expect(page.locator("#view-notebook")).to_be_visible()
        page.locator("#new-note").tap()
        expect(page.locator("#note-dialog")).to_be_visible()
        for name_field in FIELDS:
            key = "tasteTip" if name_field == "taste" else name_field
            value = expected_note[key]
            page.locator("#note-" + name_field).fill("\n".join(value) if isinstance(value, list) else value)
        page.locator("#note-servings").fill("2")
        page.locator("#note-minutes").fill("10")
        page.locator("#note-form button[type=submit]").tap()
        expect(page.locator("#note-dialog")).to_be_hidden()
        expect(page.locator("#note-list article")).to_have_count(1)
        title = page.locator("#note-list h3")
        assert title.text_content() == name
        assert title.locator(":scope > *").count() == 0
        page.get_by_role("button", name="打开：" + name, exact=True).tap()
        expect(page.locator("#recipe-dialog")).to_be_visible()
        assert_literal(page, field, payload, name)
        if screenshots and field == "steps" and probe_name == "image-event":
            page.locator("#recipe-steps").scroll_into_view_if_needed()
            page.screenshot(path=str(screenshots / "literal-step.png"), animations="disabled")
        page.locator("#recipe-dialog [data-close]").tap()
        with page.expect_download() as downloaded:
            page.get_by_role("button", name="导出：" + name, exact=True).tap()
        exported = json.loads(Path(downloaded.value.path()).read_text(encoding="utf-8"))
        assert exported == expected_note
        assert set(exported) == {"name", "servings", "minutes", "ingredients", "steps", "safety", "tasteTip"}
        page.reload(wait_until="load")
        expect(page.locator("#view-notebook")).to_be_visible()
        expect(page.locator("#note-list article")).to_have_count(1)
        assert page.locator("#note-list h3").text_content() == name
        assert page.locator("#note-list h3").locator(":scope > *").count() == 0
        page.get_by_role("button", name="打开：" + name, exact=True).tap()
        expect(page.locator("#recipe-dialog")).to_be_visible()
        assert_literal(page, field, payload, name)
        assert page.evaluate("MealModel.snapshot().books.home.stock.tomato.quantity") == 17
        assert not errors and not console_issues and not requests, (errors, console_issues, requests)
        return {
            "field": field, "probe": probe_name, "input": payload,
            "literalBeforeReload": True, "literalAfterReload": True,
            "renderedChildElements": 0, "executionMarker": page.evaluate("globalThis.__noteProbe"),
            "exportKeys": sorted(exported), "exportEqualsEnteredRecord": exported == expected_note,
            "syntheticStockRetained": True,
            "runtimeErrors": len(errors), "consoleWarningsOrErrors": len(console_issues),
            "httpRequests": len(requests),
        }
    finally:
        context.close()


def main():
    cli = argparse.ArgumentParser(description="Literal rendering and selected-note JSON export using harmless synthetic markup probes.")
    cli.add_argument("--html", type=Path, default=Path(__file__).resolve().parents[2] / "index.html")
    cli.add_argument("--channel", choices=["chromium", "msedge", "chrome"], default="chromium")
    cli.add_argument("--output", type=Path)
    cli.add_argument("--screenshots", type=Path)
    args = cli.parse_args()
    assert all(len(payload) <= 60 for _, payload in PROBES)
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    content = args.html.read_bytes()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**({} if args.channel == "chromium" else {"channel": args.channel}))
        try:
            rows = [run_case(browser, args.html.resolve().as_uri(), field, probe, payload, args.screenshots)
                    for field in FIELDS for probe, payload in PROBES]
            result = {
                "artifact": {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()},
                "environment": {
                    "python": platform.python_version(), "platform": platform.system(),
                    "platformRelease": platform.release(), "machine": platform.machine(),
                    "playwright": importlib.metadata.version("playwright"),
                    "channel": args.channel, "browser": browser.version,
                    "browserPlugin": "Browser plugin not available; regular Playwright used",
                },
                "method": "Eight synthetic text probes times five fields, each in a fresh offline 390x844 touch context. Enter through the normal note form, open, export the selected record, reload and open again. The execution marker only assigns a local test variable.",
                "cases": len(rows),
                "fields": FIELDS,
                "exportFields": sorted(["name", "servings", "minutes", "ingredients", "steps", "safety", "tasteTip"]),
                "rows": rows,
                "limitation": "A finite literal-rendering and field-selection test in one emulated browser. No general XSS, PII redaction, exported-file sharing, backend posting, other channels or real-handset security guarantee is assessed.",
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
