import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { openRelease } from "./release.mjs";

const { values } = parseArgs({ options: { html: { type: "string" }, output: { type: "string" } } });
const release = await openRelease(values.html);
const plain = (value) => JSON.parse(JSON.stringify(value));

function storage(raw = null) {
  return {
    raw, reads: 0, writes: 0, readError: null, writeError: null,
    getItem(key) {
      assert.equal(key, "zhedun:v2");
      this.reads += 1;
      if (this.readError) throw Object.assign(new Error("Synthetic read failure"), { name: this.readError });
      return this.raw;
    },
    setItem(key, text) {
      assert.equal(key, "zhedun:v2");
      this.writes += 1;
      if (this.writeError) throw Object.assign(new Error("Synthetic write failure"), { name: this.writeError });
      this.raw = text;
    },
  };
}

const initial = plain(release.createModel(storage()).snapshot());
const baseline = structuredClone(initial);
baseline.books.home = {
  servings: 2, plan: ["tomato-eggs"],
  stock: { tomato: { quantity: 300 }, egg: { quantity: 4 } },
};
baseline.notes = [{
  id: "synthetic-note", name: "合成菜谱记录",
  ingredients: ["番茄 300克"], steps: ["合成步骤"], safety: ["合成提醒"],
}];
const checks = [];
const note = () => structuredClone(baseline.notes[0]);

function coldCase(name, group, accepted, mutate) {
  const candidate = structuredClone(baseline);
  mutate(candidate);
  rawCase(name, group, accepted, JSON.stringify(candidate), candidate);
}

function rawCase(name, group, accepted, raw, candidate = null) {
  const backend = storage(raw);
  const actual = plain(release.createModel(backend).snapshot());
  assert.deepEqual(actual, accepted ? candidate : initial, name);
  assert.equal(backend.writes, 0, name);
  assert.equal(backend.raw, raw, name);
  checks.push({
    name, group, accepted, sourceRecordUnchanged: true, writes: backend.writes,
    loadedHomeStockKeys: Object.keys(actual.books.home.stock),
    loadedNotes: actual.notes.length,
    sourceSha256: createHash("sha256").update(raw ?? "").digest("hex"),
  });
}

coldCase("valid-baseline", "control", true, () => {});
for (const [value, accepted] of [[0, false], [1, true], [8, true], [9, false], [2.5, false], ["2", false]]) {
  coldCase("servings-" + JSON.stringify(value), "servings", accepted, (saved) => { saved.books.home.servings = value; });
}
for (const [name, value, accepted] of [
  ["empty", [], true], ["two-known", ["tomato-eggs", "tomato-egg-soup"], true],
  ["duplicate", ["tomato-eggs", "tomato-eggs"], false], ["unknown", ["synthetic-unknown-recipe"], false],
  ["string", "tomato-eggs", false], ["null", null, false],
]) {
  coldCase("plan-" + name, "plan", accepted, (saved) => { saved.books.home.plan = value; });
}
for (const [name, value, accepted] of [
  ["zero", 0, true], ["maximum", 100000, true], ["negative", -1, false], ["above-maximum", 100001, false],
  ["fraction", 0.5, false], ["string", "300", false], ["null", null, false],
]) {
  coldCase("quantity-" + name, "quantity", accepted, (saved) => { saved.books.home.stock.tomato.quantity = value; });
}
coldCase("quantity-missing", "quantity", false, (saved) => { delete saved.books.home.stock.tomato.quantity; });
coldCase("stock-null", "stock-shape", false, (saved) => { saved.books.home.stock = null; });
coldCase("stock-unknown-food", "stock-shape", false, (saved) => { saved.books.home.stock["synthetic-unknown-food"] = { quantity: 1 }; });
coldCase("stock-empty-array", "stock-shape", true, (saved) => { saved.books.home.stock = []; });
coldCase("estimated-and-priority-strings", "unchecked-fields", true, (saved) => {
  Object.assign(saved.books.home.stock.tomato, { estimated: "yes", priority: "yes" });
});
coldCase("adjustments-string", "unchecked-fields", true, (saved) => { saved.books.home.adjustments = "synthetic-unvalidated-value"; });
coldCase("unknown-top-level-field", "unchecked-fields", true, (saved) => { saved.syntheticExtra = "retained"; });
coldCase("demo-corrupt-home-valid", "book-coupling", false, (saved) => { saved.books.demo.servings = 0; });
coldCase("demo-missing-home-valid", "book-coupling", false, (saved) => { delete saved.books.demo; });
coldCase("mode-unknown", "mode", false, (saved) => { saved.mode = "synthetic-unknown-mode"; });
coldCase("mode-demo", "mode", true, (saved) => { saved.mode = "demo"; });
coldCase("notes-missing", "notes-shape", false, (saved) => { delete saved.notes; });
coldCase("notes-null", "notes-shape", false, (saved) => { saved.notes = null; });
coldCase("notes-empty", "notes-shape", true, (saved) => { saved.notes = []; });
coldCase("notes-100", "notes-limit", true, (saved) => { saved.notes = Array.from({ length: 100 }, (_, id) => ({ ...note(), id: "synthetic-" + id })); });
coldCase("notes-101", "notes-limit", false, (saved) => { saved.notes = Array.from({ length: 101 }, (_, id) => ({ ...note(), id: "synthetic-" + id })); });
coldCase("note-null", "notes-shape", false, (saved) => { saved.notes = [null]; });
coldCase("note-numeric-id", "notes-shape", false, (saved) => { saved.notes[0].id = 1; });
coldCase("note-numeric-name", "notes-shape", false, (saved) => { saved.notes[0].name = 1; });
coldCase("note-ingredients-string", "notes-shape", false, (saved) => { saved.notes[0].ingredients = "番茄"; });
coldCase("note-steps-numeric-entry", "notes-shape", false, (saved) => { saved.notes[0].steps = [1]; });
coldCase("note-safety-missing", "notes-shape", false, (saved) => { delete saved.notes[0].safety; });
coldCase("note-empty-strings", "unchecked-fields", true, (saved) => { saved.notes[0].id = ""; saved.notes[0].name = ""; });
coldCase("note-duplicate-ids", "unchecked-fields", true, (saved) => { saved.notes.push(note()); });
coldCase("note-long-name", "unchecked-fields", true, (saved) => { saved.notes[0].name = "字".repeat(5000); });
for (const [name, raw] of [["absent", null], ["empty-string", ""], ["malformed-json", "{"], ["json-null", "null"], ["json-array", "[]"]]) {
  rawCase(name, "raw-input", false, raw);
}

const baseRaw = JSON.stringify(baseline);
const faultResults = [];
const addTomato = (state) => { state.books.home.stock.tomato.quantity += 10; };

for (const failure of [null, "QuotaExceededError", "SecurityError"]) {
  const backend = storage(baseRaw);
  const model = release.createModel(backend);
  backend.writeError = failure;
  const first = await model.update(addTomato);
  const second = await model.update(addTomato);
  const memoryQuantity = model.snapshot().books.home.stock.tomato.quantity;
  const storedQuantity = JSON.parse(backend.raw).books.home.stock.tomato.quantity;
  assert.equal(memoryQuantity, 320);
  assert.equal(storedQuantity, failure ? 300 : 320);
  assert.deepEqual(plain(first), { saved: !failure });
  assert.deepEqual(plain(second), { saved: !failure });
  assert.equal(backend.writes, failure ? 1 : 2);
  const writesBeforeReload = backend.writes;
  backend.writeError = null;
  const reloaded = release.createModel(backend);
  const afterReload = reloaded.snapshot().books.home.stock.tomato.quantity;
  assert.equal(afterReload, storedQuantity);
  const recovered = await reloaded.update(addTomato);
  assert.equal(recovered.saved, true);
  assert.equal(reloaded.snapshot().books.home.stock.tomato.quantity, storedQuantity + 10);
  faultResults.push({
    name: failure ?? "normal-write", first: plain(first), second: plain(second),
    memoryQuantityGrams: memoryQuantity, storedQuantityGrams: storedQuantity,
    writesBeforeReload, restoredQuantityGrams: afterReload,
    savedAfterFreshInstance: recovered.saved,
  });
}
for (const mode of ["validation-error", "callback-throws"]) {
  const backend = storage(baseRaw);
  const model = release.createModel(backend);
  let outcome;
  try {
    outcome = await model.update((state) => {
      addTomato(state);
      if (mode === "callback-throws") throw new Error("Synthetic callback failure");
      return "Synthetic validation error";
    });
  } catch (error) {
    assert.equal(mode, "callback-throws");
    outcome = { thrown: error.message };
  }
  assert.deepEqual(plain(model.snapshot()), baseline);
  assert.equal(backend.raw, baseRaw);
  assert.equal(backend.writes, 0);
  faultResults.push({ name: mode, outcome: plain(outcome), memoryUnchanged: true, sourceUnchanged: true, writes: 0 });
}
{
  const backend = storage(baseRaw);
  backend.readError = "SecurityError";
  const model = release.createModel(backend);
  assert.deepEqual(plain(model.snapshot()), initial);
  backend.readError = null;
  const outcome = await model.update((state) => { state.books.home.stock.tomato = { quantity: 10 }; });
  assert.equal(outcome.saved, false);
  assert.equal(backend.writes, 0);
  assert.equal(backend.raw, baseRaw);
  assert.equal(model.snapshot().books.home.stock.tomato.quantity, 10);
  const reloaded = release.createModel(backend);
  assert.equal(reloaded.snapshot().books.home.stock.tomato.quantity, 300);
  faultResults.push({
    name: "startup-read-denied-then-allowed", outcome: plain(outcome), writes: 0,
    memoryQuantityGrams: 10, restoredQuantityGrams: 300, sourceUnchanged: true,
  });
}
{
  const damaged = structuredClone(baseline);
  damaged.books.demo.servings = 0;
  const original = JSON.stringify(damaged);
  const backend = storage(original);
  const model = release.createModel(backend);
  assert.deepEqual(plain(model.snapshot()), initial);
  assert.equal(backend.raw, original);
  const outcome = await model.update((state) => { state.books.home.stock.tomato = { quantity: 10 }; });
  assert.equal(outcome.saved, true);
  assert.equal(backend.writes, 1);
  assert.notEqual(backend.raw, original);
  const reloaded = release.createModel(backend);
  assert.deepEqual(plain(reloaded.snapshot().books.home.stock), { tomato: { quantity: 10 } });
  assert.equal(reloaded.snapshot().notes.length, 0);
  faultResults.push({
    name: "invalid-demo-then-home-update", outcome: plain(outcome),
    sourcePreservedUntilUpdate: true, sourceReplacedAfterUpdate: true, writes: backend.writes,
    restoredHomeStockKeys: Object.keys(reloaded.snapshot().books.home.stock),
    restoredQuantityGrams: 10, restoredNotes: 0,
  });
}

const groups = {};
for (const row of checks) {
  const group = groups[row.group] ??= { cases: 0, accepted: 0, fallback: 0 };
  group.cases += 1;
  group[row.accepted ? "accepted" : "fallback"] += 1;
}
const result = {
  artifact: release.artifact, environment: release.environment,
  method: "Released MealModel with synthetic saved JSON and a deterministic in-memory Storage double. Web Locks absent. Each cold-load case uses a fresh model realm.",
  fixture: { servings: 2, plan: ["tomato-eggs"], stockGrams: { tomato: 300 }, stockPieces: { egg: 4 }, notes: 1 },
  coldLoadCases: checks.length, groups, checks, updateScenarios: faultResults,
  limitation: "Faults are injected into the Storage interface. These runs measure model behavior, not actual browser quota, disk durability, UI warnings, cross-tab races or schema migration success on private records.",
};
const output = JSON.stringify(result, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
else process.stdout.write(output);
