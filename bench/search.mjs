import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { runInNewContext } from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const baselineCode = await readFile(new URL("baseline-cookbook.js", import.meta.url), "utf8");
const scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/gu), (match) => match[1]);
const searchIndex = scripts.findIndex((code) => code.includes("const Cookbook ="));
assert.ok(searchIndex > 0);
const feed = scripts[searchIndex + 1].split("\n").find((line) => line.startsWith("Cookbook.addWebsiteRecipes("));
assert.ok(feed);

function loadSearch(code) {
  return runInNewContext(
    [...scripts.slice(0, searchIndex), code, feed, "Cookbook"].join("\n"),
    Object.create(null),
    { filename: "public-recipe-index", timeout: 10_000 },
  );
}

const baseline = loadSearch(baselineCode);
const release = loadSearch(scripts[searchIndex]);
const queries = [
  "", "番茄炒蛋", "西红柿炒鸡蛋", "鸡蛋 土豆", "鸡蛋和土豆", "洋芋丝",
  "土豆 蒸", "空气炸锅 鸡腿", "清蒸", "三姜汤", "家常煎豆腐", "番茄汤",
  "如何做红烧肉", "电饭锅 米饭", "虾仁 豆腐", "黄瓜拌蒜", "玉米 粥",
  "土豆  鸡蛋 蒸", "香菇、白菜", "酸辣土豆丝的做法", "鸡蛋+番茄",
  "ＧＨＺｈｅｄｕｎ无匹配", "豆腐 煮 香菇", "盐焗鸡",
];
const stock = {
  egg: { quantity: 4 },
  tomato: { quantity: 300, priority: true },
  potato: { quantity: 250, estimated: true },
};
const ready = new Set(["tomato-eggs", "tomato-egg-soup"]);
const cases = [
  { stock: {}, ready: new Set(), scope: "all", category: "" },
  { stock, ready, scope: "all", category: "" },
  { stock, ready, scope: "quick", category: "meatless" },
  { stock, ready, scope: "ready", category: "" },
].flatMap((settings) => queries.map((query) => ({ ...settings, query })));

function find(library, { stock, ready, query, category, scope }) {
  return library.search(stock, ready, query, category, scope);
}

function signature(rows) {
  return JSON.stringify(rows.map(({ recipe, type, relevance, fits, covered, estimated, priority }) =>
    [recipe.id, type, relevance, fits, covered, estimated, priority]));
}

for (const settings of cases) {
  assert.equal(signature(find(baseline, settings)), signature(find(release, settings)), settings.query);
}

function round(library) {
  let resultCount = 0;
  const start = performance.now();
  for (const settings of cases) resultCount += find(library, settings).length;
  return { averageMs: (performance.now() - start) / cases.length, resultCount };
}

for (let run = 0; run < 4; run++) {
  round(baseline);
  round(release);
}
const measurements = [[], []];
for (let run = 0; run < 16; run++) {
  const order = run % 2 ? [1, 0] : [0, 1];
  for (const index of order) measurements[index].push(round([baseline, release][index]));
}

function stats(measurements) {
  const times = measurements.map(({ averageMs }) => averageMs).sort((a, b) => a - b);
  const middle = times.length / 2;
  const median = (times[middle - 1] + times[middle]) / 2;
  return {
    medianMsPerQuery: Number(median.toFixed(4)),
    slowestRoundMsPerQuery: Number(times.at(-1).toFixed(4)),
    resultCountPerRound: measurements[0].resultCount,
  };
}
const before = stats(measurements[0]);
const after = stats(measurements[1]);
console.log(JSON.stringify({
  node: process.version,
  totalRecipes: release.entries.length + release.sites.size,
  queryTexts: queries.length,
  cases: cases.length,
  timedRounds: measurements[0].length,
  sameOrderAndScores: true,
  before,
  after,
  medianReductionPercent: Number(((before.medianMsPerQuery - after.medianMsPerQuery) / before.medianMsPerQuery * 100).toFixed(1)),
}, null, 2));
