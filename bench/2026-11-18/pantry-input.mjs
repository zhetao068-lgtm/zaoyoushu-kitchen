import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { runInNewContext } from "node:vm";

const { values } = parseArgs({ options: { html: { type: "string" }, output: { type: "string" } } });
const bytes = await readFile(values.html ?? new URL("../../index.html", import.meta.url));
const scripts = [...bytes.toString("utf8").matchAll(/<script>([\s\S]*?)<\/script>/gu)].map(([, code]) => code);
const library = scripts.findIndex((code) => code.includes("const Cookbook ="));
const modelCode = scripts.find((code) => code.includes("const MealModel ="));
const inputCode = scripts.find((code) => code.includes("const byLabel = new Map();"));
assert.ok(library > 0 && modelCode && inputCode, "Expected released catalog, model and pantry parser");
const { MealCatalog: catalog, MealModel: model } = runInNewContext(
  [...scripts.slice(0, library + 1), modelCode, "({ MealCatalog, MealModel })"].join("\n"),
  { localStorage: { getItem() { return null; } } },
  { timeout: 10_000 },
);
const cut = inputCode.indexOf("\n  function homeStock(");
assert.ok(cut > inputCode.indexOf("\n  function parse("));
// Stop the original UI closure immediately after its pure parser. The DOM
// references above it are inert stubs, and no browser handlers are evaluated.
const parser = runInNewContext(inputCode.slice(0, cut) + "\n  return { parse };\n})();", {
  ingredients: catalog.ingredients,
  pieceWeights: catalog.pieceWeights,
  model,
  id() { return {}; },
}, { timeout: 5000 });
const rows = [];

function check(group, input, expected) {
  const actual = parser.parse(input);
  const entries = actual.entries ? Object.fromEntries(
    [...actual.entries].map(([food, entry]) => [food, { value: Number(entry.value), unit: entry.unit }]),
  ) : null;
  if (expected === null) assert.ok(actual.error && entries === null, input);
  else assert.deepEqual(entries, expected, input);
  rows.push({ group, input, accepted: Boolean(entries), entries, error: actual.error ?? null });
}

function entry(food, value, unit) {
  return { [food]: { value, unit } };
}

const owners = new Map();
for (const [food, info] of Object.entries(catalog.ingredients)) {
  for (const label of [info.name, ...info.aliases]) {
    if (!owners.has(label)) owners.set(label, new Set());
    owners.get(label).add(food);
  }
}
const primaryNames = new Map(Object.entries(catalog.ingredients).map(([food, info]) => [info.name, food]));
for (const [label, candidates] of owners) {
  const food = primaryNames.get(label) ?? (candidates.size === 1 ? [...candidates][0] : null);
  const unit = food ? catalog.ingredients[food].unit : "克";
  const quantity = unit === "个" ? 4 : 200;
  check("declared-label", label + quantity + unit, food ? entry(food, quantity, unit) : null);
}

const massCases = [
  ["250克", 250], ["250g", 250], ["0.25千克", 250], ["0.25公斤", 250], ["0.25kg", 250],
  ["半斤", 250], ["5两", 250], ["２５０ｇ", 250], ["０．２５ＫＧ", 250],
  ["0克", 0], [model.maxQuantity + "克", model.maxQuantity],
];
const countCases = [["4个", 4], ["４枚", 4], ["4颗", 4], ["4", 4], ["1.0个", 1], ["0个", 0]];
for (const [food, info] of Object.entries(catalog.ingredients)) {
  for (const [text, quantity] of info.unit === "个" ? countCases : massCases) {
    check("quantity-unit", info.name + text, entry(food, quantity, info.unit));
  }
  const text = info.name + (info.unit === "个" ? "2个" : "200克");
  check("repeated-ingredient", text + " " + text, null);
}
for (const food of Object.keys(catalog.pieceWeights)) {
  for (const [text, quantity] of [["2个", 2], ["3枚", 3], ["0颗", 0]]) {
    check("piece-estimate-input", catalog.ingredients[food].name + text, entry(food, quantity, "个"));
  }
}
for (const text of ["鸡蛋2个 蛋3枚", "马铃薯200克 洋芋300克", "豆皮100克 千张200克"]) {
  check("repeated-alias", text, null);
}
const malformed = [
  "", "豆腐100克", "鸡精100克", "鸡蛋半个", "鸡蛋1.5个", "鸡蛋100克", "牛肉2个",
  "金针菇2个", "土豆0.1克", "土豆半克", "土豆-1克", "土豆1e3克", "土豆1,000克",
  "土豆100001克", "番茄667个", "土豆250克 鸡精10克", "土豆250克多一点", "250克土豆",
  "土豆一斤", "鸡蛋4个。土豆半斤",
];
for (const text of malformed) check("invalid-or-unsupported", text, null);
const thirty = Object.entries(catalog.ingredients).slice(0, 30);
const makeBatch = (foods) => foods.map(([, info]) => info.name + (info.unit === "个" ? "2个" : "200克")).join(" ");
check("batch-limit", makeBatch(thirty), Object.fromEntries(
  thirty.map(([food, info]) => [food, { value: info.unit === "个" ? 2 : 200, unit: info.unit }]),
));
check("batch-limit", makeBatch(Object.entries(catalog.ingredients).slice(0, 31)), null);
check("mixed-batch", "番茄2个 鸡蛋4个 土豆半斤", {
  ...entry("tomato", 2, "个"), ...entry("egg", 4, "个"), ...entry("potato", 250, "克"),
});
check("mixed-batch", "西红柿２００克，鸡蛋４枚；洋芋半斤", {
  ...entry("tomato", 200, "克"), ...entry("egg", 4, "个"), ...entry("potato", 250, "克"),
});
check("mixed-batch", "鸡蛋4个土豆半斤", { ...entry("egg", 4, "个"), ...entry("potato", 250, "克") });

const groups = {};
for (const row of rows) {
  const group = groups[row.group] ??= { cases: 0, accepted: 0, rejected: 0 };
  group.cases += 1;
  group[row.accepted ? "accepted" : "rejected"] += 1;
}
const result = {
  artifact: { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") },
  environment: { node: process.version, platform: process.platform, architecture: process.arch,
    unicode: process.versions.unicode, icu: process.versions.icu },
  method: "Released pure parser, declared label coverage and synthetic unit/batch cases. Every row matched its explicit expected outcome.",
  ingredientIds: Object.keys(catalog.ingredients).length,
  distinctDeclaredLabels: owners.size,
  ambiguousLabels: [...owners].filter(([label, foods]) => foods.size > 1 && !primaryNames.has(label))
    .map(([label, foods]) => ({ label, foodIds: [...foods] })),
  countUnitIngredients: Object.entries(catalog.ingredients).filter(([, info]) => info.unit === "个").map(([food]) => food),
  estimatedPieceIngredients: Object.keys(catalog.pieceWeights),
  maximumStoredQuantity: model.maxQuantity,
  units: { mass: "grams", count: "pieces", pieceEstimateInputs: "pieces before the UI applies its approximate gram weight" },
  cases: rows.length,
  groups,
  rows,
};
const output = JSON.stringify(result, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
else process.stdout.write(output);
