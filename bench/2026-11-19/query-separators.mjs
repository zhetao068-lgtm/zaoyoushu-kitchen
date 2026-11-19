import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { openRelease } from "./release.mjs";

const { values } = parseArgs({ options: { html: { type: "string" }, output: { type: "string" } } });
const release = await openRelease(values.html);
const foods = Object.entries(release.catalog.ingredients);
const separators = [
  { name: "ideographic-comma", text: "、" },
  { name: "comma", text: "," },
  { name: "plus", text: "+" },
  { name: "fullwidth-plus", text: "＋" },
  { name: "slash", text: "/" },
  { name: "and", text: "和" },
  { name: "with", text: "配" },
  { name: "adjacent", text: "" },
];
const summaries = Object.fromEntries(separators.map(({ name, text }) => [name, {
  separator: text, comparisons: 0, sameSet: 0, sameOrder: 0,
  fewerResults: 0, moreResults: 0, emptyAfterNonemptyBaseline: 0,
  changedSetWithUnsplitNormalizedQuery: 0,
  changedSetExamples: [], changedOrderOnlyExamples: [],
}]));
const ready = new Set();
const search = (query) => release.cookbook.search({}, ready, query, "", "all");
const ids = (rows) => [...rows].map(({ recipe }) => recipe.id);
const equal = (first, second) => first.length === second.length && first.every((value, index) => value === second[index]);
const digest = createHash("sha256");
let pairs = 0;
let nonemptyBaselines = 0;

for (const [index, [firstId, first]] of foods.entries()) {
  for (const [secondId, second] of foods.slice(index + 1)) {
    pairs += 1;
    const baselineQuery = first.name + " " + second.name;
    const baseline = search(baselineQuery);
    const baselineIds = ids(baseline);
    const baselineSet = new Set(baselineIds);
    if (baseline.length) nonemptyBaselines += 1;
    const observed = { foods: [firstId, secondId], baseline: baselineIds, variants: {} };
    for (const { name, text } of separators) {
      const query = first.name + text + second.name;
      const actual = search(query);
      const actualIds = ids(actual);
      const sameSet = actualIds.length === baselineIds.length && actualIds.every((id) => baselineSet.has(id));
      const sameOrder = equal(actualIds, baselineIds);
      const summary = summaries[name];
      summary.comparisons += 1;
      summary.sameSet += Number(sameSet);
      summary.sameOrder += Number(sameOrder);
      summary.fewerResults += Number(actual.length < baseline.length);
      summary.moreResults += Number(actual.length > baseline.length);
      summary.emptyAfterNonemptyBaseline += Number(baseline.length > 0 && actual.length === 0);
      const normalizedQuery = release.cookbook.diagnostics.recipeText(query);
      const splitParts = [...release.cookbook.diagnostics.splitWord(normalizedQuery)];
      summary.changedSetWithUnsplitNormalizedQuery += Number(!sameSet && splitParts.length === 1);
      if ((!sameSet && summary.changedSetExamples.length < 5) ||
          (sameSet && !sameOrder && summary.changedOrderOnlyExamples.length < 3)) {
        const actualSet = new Set(actualIds);
        const example = {
          foodIds: [firstId, secondId], baselineQuery, query, normalizedQuery, splitParts,
          baselineResults: baselineIds.length, results: actualIds.length,
          missingIds: baselineIds.filter((id) => !actualSet.has(id)),
          extraIds: actualIds.filter((id) => !baselineSet.has(id)),
          baselineTopFive: [...baseline].slice(0, 5).map(({ recipe, relevance }) => ({ id: recipe.id, name: recipe.name, score: relevance })),
          topFive: [...actual].slice(0, 5).map(({ recipe, relevance }) => ({ id: recipe.id, name: recipe.name, score: relevance })),
        };
        (sameSet ? summary.changedOrderOnlyExamples : summary.changedSetExamples).push(example);
      }
      observed.variants[name] = actualIds;
    }
    digest.update(JSON.stringify(observed) + "\n");
  }
}
assert.equal(pairs, foods.length * (foods.length - 1) / 2);
assert.ok(Object.values(summaries).every((summary) => summary.comparisons === pairs));
const normalization = foods.map(([id, food]) => {
  const once = release.cookbook.diagnostics.recipeText(food.name);
  const twice = release.cookbook.diagnostics.recipeText(once);
  return { id, name: food.name, once, twice, changedFirstPass: food.name !== once, idempotent: once === twice };
});
const result = {
  artifact: release.artifact,
  environment: release.environment,
  method: "All unordered pairs of primary ingredient names in catalog order. Empty stock, empty ready set, all recipes, no category filter. A single ASCII space is the comparison baseline.",
  inventoryIngredients: foods.length,
  indexedRecipes: search("").length,
  pairs, nonemptyBaselines,
  baselineQueries: pairs,
  variantQueries: pairs * separators.length,
  summaries,
  normalization: {
    namesChecked: normalization.length,
    changedFirstPass: normalization.filter((row) => row.changedFirstPass).length,
    nonIdempotent: normalization.filter((row) => !row.idempotent).length,
    rows: normalization,
  },
  completeOrderedResultDigestSha256: digest.digest("hex"),
  digestFormat: "For each pair in catalog order, hash UTF-8 JSON.stringify({foods:[id1,id2],baseline:[recipe IDs],variants:{separator name:[recipe IDs]}}) followed by LF. The variant property order is the order in the source script.",
  limitation: "Baseline equivalence and result ordering are measured separately. Synthetic syntax comparisons supply no human relevance judgments, ingredient ontology validation or user-level accuracy estimate.",
};
const output = JSON.stringify(result, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
else process.stdout.write(output);
