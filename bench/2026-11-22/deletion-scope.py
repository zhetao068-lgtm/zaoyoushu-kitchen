import argparse
from copy import deepcopy
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import sys

from playwright.sync_api import expect, sync_playwright


ACTIONS = ["delete-home-food", "delete-demo-food", "clear-home-stock", "delete-note", "clear-private-home", "clear-private-demo"]
NOTE_NAME = "合成删除样本甲"
SENTINEL_KEY = "zaoyoushu-synthetic-unrelated"
SENTINEL_VALUE = "retained-test-value"


def snapshot(page):
    return page.evaluate("JSON.parse(JSON.stringify(MealModel.snapshot()))")


def navigate(page, route):
    page.locator(".primary-nav a[href='#" + route + "']").tap()
    expect(page.locator("#view-" + route)).to_be_visible()


def wait_state(page, expected):
    page.wait_for_function("expected => JSON.stringify(MealModel.snapshot()) === JSON.stringify(expected)", arg=expected)
    assert snapshot(page) == expected
    assert page.evaluate("JSON.parse(localStorage.getItem(MealModel.key))") == expected


def run_case(browser, entry, action, decision, screenshots):
    context = browser.new_context(viewport={"width": 390, "height": 844},
                                  is_mobile=True, has_touch=True, offline=True,
                                  locale="zh-CN", timezone_id="Asia/Shanghai", accept_downloads=True)
    errors, console_issues, requests = [], [], []
    def observe(page):
        page.set_default_timeout(12_000)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: console_issues.append(message.text)
                if message.type in {"warning", "error"} else None)
        page.on("request", lambda request: requests.append(request.url)
                if request.url.startswith(("http:", "https:")) else None)

    page = context.new_page()
    observe(page)
    mode = "demo" if action.endswith("-demo") or action == "delete-demo-food" else "home"
    try:
        page.goto(entry, wait_until="load")
        assert page.evaluate("""async mode => {
          const result = await MealModel.update(state => {
            state.mode = mode;
            state.books.demo.servings = 4;
            state.books.demo.stock.tomato.quantity = 913;
            state.books.home = {
              servings: 3, plan: ['tomato-eggs'],
              stock: {tomato: {quantity: 711, priority: true}, egg: {quantity: 7}},
              adjustments: {'tomato-eggs': {servings: 3, needs: {tomato: 400}}}
            };
            state.notes = [
              {id: 'synthetic-note-a', name: '合成删除样本甲', servings: 2, minutes: 8,
               ingredients: ['合成材料 1 克'], steps: ['合成步骤甲'], safety: ['合成提醒'], tasteTip: '合成口味'},
              {id: 'synthetic-note-b', name: '合成删除样本乙', servings: 1, minutes: 9,
               ingredients: ['合成材料 2 克'], steps: ['合成步骤乙'], safety: [], tasteTip: ''}
            ];
          });
          localStorage.setItem('zaoyoushu-synthetic-unrelated', 'retained-test-value');
          sessionStorage.setItem('zaoyoushu-synthetic-session', 'retained-test-value');
          return result.saved;
        }""", mode) is True
        page.reload(wait_until="load")
        before = snapshot(page)
        expected = deepcopy(before)
        peer = context.new_page()
        observe(peer)
        peer.goto(entry, wait_until="load")
        navigate(peer, "notebook")
        expect(peer.locator("#note-list article")).to_have_count(2)
        # Keep an existing edit dialog open across private-data removal.
        stale_editor = action.startswith("clear-private") and decision == "confirm"
        if stale_editor:
            peer.get_by_role("button", name="编辑：" + NOTE_NAME, exact=True).tap()
            expect(peer.locator("#note-dialog")).to_be_visible()
        exported_path, exported_before = None, None
        if action.startswith("clear-private"):
            navigate(page, "notebook")
            with page.expect_download() as download_info:
                page.get_by_role("button", name="导出：" + NOTE_NAME, exact=True).tap()
            exported_path = download_info.value.path()
            exported_before = exported_path.read_bytes()
            page.locator("#view-notebook .data-management summary").tap()
            page.locator("#clear-private").tap()
            if decision == "confirm":
                expected["books"]["home"] = {"servings": 2, "stock": {}, "plan": []}
                expected["notes"] = []
        elif action == "delete-note":
            navigate(page, "notebook")
            page.get_by_role("button", name="删除：" + NOTE_NAME, exact=True).tap()
            if decision == "confirm":
                expected["notes"] = [before["notes"][1]]
        else:
            navigate(page, "pantry")
            if action == "clear-home-stock":
                page.locator("#pantry-data-actions summary").tap()
                page.locator("#clear-stock").tap()
                if decision == "confirm":
                    expected["books"]["home"]["stock"] = {}
            else:
                page.get_by_role("button", name="删除：番茄", exact=True).tap()
                if decision == "confirm":
                    del expected["books"][mode]["stock"]["tomato"]
        expect(page.locator("#remove-dialog")).to_be_visible()
        confirmation = page.locator("#remove-text").text_content()
        if decision == "confirm":
            page.locator("#confirm-remove").tap()
        else:
            page.locator("#remove-dialog [data-close]").tap()
        expect(page.locator("#remove-dialog")).to_be_hidden()
        wait_state(page, expected)
        wait_state(peer, expected)
        note_count = len(expected["notes"])
        expect(peer.locator("#note-list article")).to_have_count(note_count)
        stale_error, stale_form_values = None, None
        if stale_editor:
            # The unchanged mode leaves this dialog open; submitting must not recreate its deleted ID.
            expect(peer.locator("#note-dialog")).to_be_visible()
            stale_form_values = {
                "name": peer.locator("#note-name").input_value(),
                "ingredients": peer.locator("#note-ingredients").input_value(),
                "steps": peer.locator("#note-steps").input_value(),
            }
            assert stale_form_values == {"name": NOTE_NAME, "ingredients": "合成材料 1 克", "steps": "合成步骤甲"}
            peer.locator("#note-form button[type=submit]").tap()
            expect(peer.locator("#note-error")).to_have_text("这条记录已经删除，请重新新建。")
            stale_error = peer.locator("#note-error").text_content()
            wait_state(peer, expected)
            wait_state(page, expected)
            if screenshots and action == "clear-private-demo":
                peer.screenshot(path=str(screenshots / "deleted-note-editor.png"), animations="disabled")
            peer.locator("#note-dialog [data-close]").tap()
        export_retained = None
        if exported_path:
            export_retained = exported_path.is_file() and exported_path.read_bytes() == exported_before
            assert export_retained
        for current in [page, peer]:
            current.reload(wait_until="load")
            wait_state(current, expected)
            assert current.evaluate("localStorage.getItem('zaoyoushu-synthetic-unrelated')") == SENTINEL_VALUE
        assert page.evaluate("sessionStorage.getItem('zaoyoushu-synthetic-session')") == SENTINEL_VALUE
        if screenshots and action == "clear-home-stock" and decision == "confirm":
            navigate(page, "shop")
            page.screenshot(path=str(screenshots / "stock-cleared-menu-retained.png"), animations="disabled")
        assert not errors, errors
        assert not console_issues, console_issues
        assert not requests, requests
        return {
            "action": action, "decision": decision, "mode": mode,
            "confirmationText": confirmation, "before": before, "after": expected,
            "stateMatchesImmediately": True, "peerMatchesWithoutReload": True,
            "bothReloadsMatch": True, "unrelatedLocalStorageRetained": True,
            "sessionSentinelRetained": True, "downloadRetained": export_retained,
            "staleEditRejected": stale_error is not None, "staleEditMessage": stale_error,
            "staleFormValuesAfterDeletion": stale_form_values,
            "runtimeErrors": len(errors), "consoleWarningsOrErrors": len(console_issues), "httpRequests": len(requests),
        }
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
    data = args.html.read_bytes()
    with sync_playwright() as runner:
        browser = runner.chromium.launch(headless=True, channel=args.channel)
        try:
            rows = [run_case(browser, args.html.resolve().as_uri(), action, decision, args.screenshots)
                    for action in ACTIONS for decision in ["cancel", "confirm"]]
            result = {
                "artifact": {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()},
                "environment": {"python": platform.python_version(), "system": platform.system(),
                                "release": platform.release(), "machine": platform.machine(),
                                "playwright": importlib.metadata.version("playwright"),
                                "channel": args.channel, "browser": browser.version},
                "method": "Six deletion scopes times cancel/confirm in fresh offline, touch-enabled 390x844 contexts. Actual UI actions and two tabs, model fixtures only. Compare complete expected state, other storage sentinels, previously downloaded bytes and stale note edits.",
                "cases": len(rows), "rows": rows,
                "limitation": "Logical app-state deletion in one emulated browser with available storage. No disk-forensic erasure, downloaded-copy deletion, submitted-website removal, storage-failure recovery, other browser profiles, arbitrary concurrent writers or physical phone tests.",
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
