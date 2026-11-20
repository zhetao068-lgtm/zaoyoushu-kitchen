import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { openRelease } from "../2026-11-19/release.mjs";

const { values } = parseArgs({ options: { html: { type: "string" }, output: { type: "string" } } });
const release = await openRelease(values.html);
const model = release.createModel({ getItem() { return null; } });
const all = [...release.cookbook.search({}, new Set(), "", "", "all")];
const foods = Object.keys(release.catalog.ingredients);
const types = [...new Set(all.map((row) => row.type))];

function countTypes(rows) {
  return Object.fromEntries(types.map((type) => [type, rows.filter((row) => row.type === type).length]));
}

const metadata = types.map((type) => {
  const rows = all.filter((row) => row.type === type);
  return {
    type, recipes: rows.length,
    positiveNumericMinutes: rows.filter(({ recipe }) => Number.isFinite(recipe.minutes) && recipe.minutes > 0).length,
    noMinutesField: rows.filter(({ recipe }) => !Object.hasOwn(recipe, "minutes")).length,
    structuredNeeds: rows.filter(({ recipe }) => recipe.needs && typeof recipe.needs === "object" &&
      !Array.isArray(recipe.needs) && Object.keys(recipe.needs).length > 0).length,
    minutesAtMost20: rows.filter(({ recipe }) => recipe.minutes > 0 && recipe.minutes <= 20).length,
    examplesWithoutMinutes: rows.filter(({ recipe }) => !Object.hasOwn(recipe, "minutes"))
      .slice(0, 3).map(({ recipe }) => ({ id: recipe.id, name: recipe.name })),
  };
});
const scopes = ["all", "quick", "ready"];
const categories = ["", "meatless"];
const observations = [];
for (let servings = 1; servings <= 8; servings += 1) {
  for (const inventory of ["empty", "zero", "full"]) {
    const stock = inventory === "empty" ? {} : Object.fromEntries(
      foods.map((food) => [food, { quantity: inventory === "full" ? model.maxQuantity : 0 }]),
    );
    const book = { servings, plan: [], stock };
    // Follow the page's normal ready-set construction before calling the
    // same search API used by renderLibrary.
    const matches = model.searchRecipes(book, "", "all");
    const ready = new Set([...matches].filter((row) => row.fits).map(({ recipe }) => recipe.id));
    assert.equal(ready.size, inventory === "full" ? release.cookbook.exact.length : 0);
    for (const category of categories) {
      for (const scope of scopes) {
        const rows = [...release.cookbook.search(stock, ready, "", category, scope)];
        const ids = rows.map(({ recipe }) => recipe.id);
        assert.equal(new Set(ids).size, ids.length);
        observations.push({
          servings, inventory, category: category || "all", scope,
          readyMeasuredRecipes: ready.size,
          results: rows.length, types: countTypes(rows),
          orderedIdsSha256: createHash("sha256").update(JSON.stringify(ids)).digest("hex"),
        });
      }
    }
  }
}
const result = {
  artifact: release.artifact, environment: release.environment,
  method: "Read field availability from the complete public search index, then use the page's ready-set construction and Cookbook.search with an empty query over all fixture combinations.",
  indexedRecipes: all.length,
  ingredientIds: foods.length,
  metadata,
  fixture: {
    servings: "integers 1 through 8",
    inventories: { empty: "no ingredient records", zero: "all known ingredients at zero", full: "all known ingredients at maximum quantity" },
    fullQuantity: model.maxQuantity,
    units: "Each ingredient uses its catalog base unit: grams or pieces.",
    plannedRecipes: 0,
    categories: ["all", "meatless"],
    scopes,
  },
  observations: observations.length,
  rows: observations,
  limitation: "The minute field is an editorial estimate. This study measures data fields and software filters, without cooking trials, inferred preparation times, nutritional or dietary guarantees, or search relevance labels.",
};
const output = JSON.stringify(result, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
else process.stdout.write(output);
