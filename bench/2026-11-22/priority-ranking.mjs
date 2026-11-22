import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { openRelease } from "../2026-11-19/release.mjs";

const { values } = parseArgs({ options: { html: { type: "string" }, output: { type: "string" } } });
const release = await openRelease(values.html);
const model = release.createModel({ getItem() { return null; } });
const foods = Object.keys(release.catalog.ingredients);
const fixtures = ["ample", "one-unit", "zero", "estimated"];
const rows = [], recommendations = [], precedenceExamples = {};
const ids = (hits) => hits.map(({ recipe }) => recipe.id);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const brief = (hit, rank) => ({
  id: hit.recipe.id, name: hit.recipe.name, rank, type: hit.type,
  relevance: hit.relevance, fits: hit.fits, priority: hit.priority,
});

for (const fixture of fixtures) {
  for (const food of foods) {
    const ingredient = release.catalog.ingredients[food];
    const stock = Object.fromEntries(foods.map((id) => [id, { quantity: model.maxQuantity }]));
    if (fixture === "one-unit") stock[food].quantity = 1;
    if (fixture === "zero") stock[food].quantity = 0;
    if (fixture === "estimated") stock[food].estimated = true;
    const baseline = { servings: 2, plan: [], stock };
    const flagged = structuredClone(baseline);
    flagged.stock[food].priority = true;
    const beforeState = JSON.stringify([baseline, flagged]);
    const baselineReady = new Set([...model.searchRecipes(baseline, "", "ready")].map(({ recipe }) => recipe.id));
    const flaggedReady = new Set([...model.searchRecipes(flagged, "", "ready")].map(({ recipe }) => recipe.id));
    assert.deepEqual([...baselineReady].sort(), [...flaggedReady].sort());

    for (const queryKind of ["empty", "ingredient-name"]) {
      const query = queryKind === "empty" ? "" : ingredient.name;
      const before = [...release.cookbook.search(baseline.stock, baselineReady, query, "", "all")];
      const after = [...release.cookbook.search(flagged.stock, flaggedReady, query, "", "all")];
      assert.deepEqual(ids(before).sort(), ids(after).sort());
      const oldRanks = new Map(before.map((hit, index) => [hit.recipe.id, index + 1]));
      const oldHits = new Map(before.map((hit) => [hit.recipe.id, hit]));
      const promoted = [], unchanged = [], demoted = [];
      for (const [index, hit] of after.entries()) {
        const old = oldHits.get(hit.recipe.id);
        assert.equal(old.relevance, hit.relevance);
        assert.equal(old.fits, hit.fits);
        assert.equal(hit.priority, Number(stock[food].quantity > 0 && hit.foods.includes(food)));
        if (hit.priority) {
          const difference = oldRanks.get(hit.recipe.id) - (index + 1);
          (difference > 0 ? promoted : difference < 0 ? demoted : unchanged).push(hit.recipe.id);
        }
        if (index) {
          const previous = after[index - 1];
          assert.ok(previous.relevance >= hit.relevance);
          if (previous.relevance === hit.relevance) {
            assert.ok(Number(previous.fits) >= Number(hit.fits));
            if (previous.fits === hit.fits) assert.ok(previous.priority >= hit.priority);
          }
        }
      }
      assert.equal(demoted.length, 0);
      if (fixture === "zero") assert.deepEqual(ids(before), ids(after));
      for (const [key, predicate] of [
        ["relevance-before-priority", (earlier, later) => earlier.relevance > later.relevance],
        ["ready-before-priority", (earlier, later) => earlier.relevance === later.relevance && earlier.fits && !later.fits],
      ]) {
        if (precedenceExamples[key]) continue;
        const laterIndex = after.findIndex((later, index) => later.priority > 0 &&
          after.slice(0, index).some((earlier) => !earlier.priority && predicate(earlier, later)));
        if (laterIndex >= 0) {
          const earlierIndex = after.findIndex((earlier, index) => index < laterIndex && !earlier.priority && predicate(earlier, after[laterIndex]));
          precedenceExamples[key] = { fixture, food, query, earlier: brief(after[earlierIndex], earlierIndex + 1), later: brief(after[laterIndex], laterIndex + 1) };
        }
      }
      rows.push({
        fixture, food, name: ingredient.name, unit: ingredient.unit, queryKind, query,
        quantity: stock[food].quantity, results: after.length, readyRecipes: flaggedReady.size,
        prioritizedResults: promoted.length + unchanged.length, promoted: promoted.length,
        unchanged: unchanged.length, demoted: demoted.length,
        orderChanged: digest(ids(before)) !== digest(ids(after)),
        baselineOrderSha256: digest(ids(before)), flaggedOrderSha256: digest(ids(after)),
        baselineTop3: before.slice(0, 3).map((hit, index) => brief(hit, index + 1)),
        flaggedTop3: after.slice(0, 3).map((hit, index) => brief(hit, index + 1)),
      });
    }

    const beforePlan = [...model.suggestMeal(baseline)];
    const afterPlan = [...model.suggestMeal(flagged)];
    for (const [book, plan] of [[baseline, beforePlan], [flagged, afterPlan]]) {
      assert.ok(plan.length <= 2);
      assert.ok([...model.shopping({ ...book, plan })].every((item) => item.shortfall === 0));
    }
    const used = (plan) => plan.reduce((sum, id) => sum + (model.recipeNeeds(baseline, id)[food] ?? 0), 0);
    recommendations.push({ fixture, food, name: ingredient.name, unit: ingredient.unit,
      baselinePlan: beforePlan, flaggedPlan: afterPlan, changed: JSON.stringify(beforePlan) !== JSON.stringify(afterPlan),
      baselineUse: used(beforePlan), flaggedUse: used(afterPlan),
    });
    assert.equal(JSON.stringify([baseline, flagged]), beforeState, "Search must leave input fixtures unchanged");
  }
}

const summaries = fixtures.flatMap((fixture) => ["empty", "ingredient-name"].map((queryKind) => {
  const selected = rows.filter((row) => row.fixture === fixture && row.queryKind === queryKind);
  return { fixture, queryKind, cases: selected.length,
    changedOrders: selected.filter((row) => row.orderChanged).length,
    prioritizedObservations: selected.reduce((sum, row) => sum + row.prioritizedResults, 0),
    promotedObservations: selected.reduce((sum, row) => sum + row.promoted, 0),
    demotedObservations: selected.reduce((sum, row) => sum + row.demoted, 0),
  };
}));
const recommendationSummaries = fixtures.map((fixture) => {
  const selected = recommendations.filter((row) => row.fixture === fixture);
  return { fixture, cases: selected.length, changedPlans: selected.filter((row) => row.changed).length,
    higherUse: selected.filter((row) => row.flaggedUse > row.baselineUse).length,
    equalUse: selected.filter((row) => row.flaggedUse === row.baselineUse).length,
    lowerUse: selected.filter((row) => row.flaggedUse < row.baselineUse).length,
    flaggedPlansUsingIngredient: selected.filter((row) => row.flaggedUse > 0).length,
  };
});
const result = {
  artifact: release.artifact, environment: release.environment,
  method: "Paired flag-off/flag-on observations using released Cookbook.search and MealModel.suggestMeal. Search uses the page's model-computed ready set. Each fixture starts without a selected menu or adjustments.",
  fixture: { ingredientIds: foods.length, servings: 2, otherQuantities: model.maxQuantity,
    units: "Catalog base units, grams or pieces; one-unit is deliberately one base unit, not one serving.",
    ample: "All quantities at the maximum; no estimates.",
    "one-unit": "Only the target ingredient is reduced to one base unit.",
    zero: "Only the target ingredient is set to zero, with its priority flag still toggled.",
    estimated: "All quantities at the maximum; only the target is marked estimated.",
    categories: "all", scope: "all", queries: ["empty", "canonical ingredient name"],
  },
  searchComparisons: rows.length, searchCalls: rows.length * 2,
  recommendationComparisons: recommendations.length, recommendationCalls: recommendations.length * 2,
  summaries, recommendationSummaries, precedenceExamples, rows, recommendations,
  limitation: "Controlled software-ranking observations in Node, with synthetic stock and no relevance labels, spoilage dates, cooking trials, actual food waste measurement or UI/browser timing measurements. Repeated recipes across cases are observations, not independent dishes.",
};
const output = JSON.stringify(result, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
else process.stdout.write(output);
