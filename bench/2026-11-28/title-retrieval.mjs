import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { openRelease } from "../2026-11-19/release.mjs";

const { values } = parseArgs({ options: { html: { type: "string" }, output: { type: "string" } } });
const release = await openRelease(values.html);
const model = release.createModel({ getItem() { return null; } });
const catalog = [...release.cookbook.entries, ...release.cookbook.sites.values()];
const types = [...new Set(catalog.map((entry) => entry.type))];
assert.equal(new Set(catalog.map(({ recipe }) => recipe.id)).size, catalog.length);

function groupBy(key) {
  const groups = new Map();
  for (const entry of catalog) {
    const label = key(entry);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(entry);
  }
  return groups;
}
const rawGroups = groupBy((entry) => entry.recipe.name);
const titleGroups = groupBy((entry) => entry.title);
const duplicates = (groups) => [...groups].filter(([, entries]) => entries.length > 1).map(([title, entries]) => ({
  title, records: entries.length, entries: entries.map(({ recipe, type }) => ({ id: recipe.id, name: recipe.name, type })),
}));
const fixtures = [
  { name: "empty", stock: {} },
  { name: "ample", stock: Object.fromEntries(Object.keys(release.catalog.ingredients).map((food) => [food, { quantity: model.maxQuantity }])) },
].map((fixture) => ({ ...fixture,
  ready: new Set([...model.searchRecipes({ servings: 2, plan: [], stock: fixture.stock }, "", "ready")].map(({ recipe }) => recipe.id)),
}));

const rows = [], examples = { missing: [], beyondFirst12: [], differentTitleFirst: [], nonFirstUniqueTitle: [] };
for (const subject of catalog) {
  assert.ok(typeof subject.recipe.name === "string" && subject.recipe.name.trim());
  assert.equal(subject.title, release.cookbook.diagnostics.recipeText(subject.recipe.name));
  for (const fixture of fixtures) {
    const hits = [...release.cookbook.search(fixture.stock, fixture.ready, subject.recipe.name, "", "all")];
    const hitIds = hits.map(({ recipe }) => recipe.id);
    assert.equal(new Set(hitIds).size, hitIds.length);
    const position = hitIds.indexOf(subject.recipe.id);
    const rank = position < 0 ? null : position + 1;
    const self = position < 0 ? null : hits[position];
    const row = {
      fixture: fixture.name, id: subject.recipe.id, type: subject.type, query: subject.recipe.name,
      normalizedTitle: subject.title, rawTitleGroupSize: rawGroups.get(subject.recipe.name).length,
      normalizedTitleGroupSize: titleGroups.get(subject.title).length,
      results: hits.length, selfRank: rank, selfRelevance: self?.relevance ?? null,
      firstId: hits[0]?.recipe.id ?? null, firstName: hits[0]?.recipe.name ?? null,
      firstType: hits[0]?.type ?? null, firstNormalizedTitle: hits[0]?.title ?? null,
      firstHasSameNormalizedTitle: hits[0]?.title === subject.title,
      differentTitleRecordsBeforeSelf: rank === null ? null : hits.slice(0, position).filter((hit) => hit.title !== subject.title).length,
      orderedIdsSha256: createHash("sha256").update(JSON.stringify(hitIds)).digest("hex"),
    };
    rows.push(row);
    for (const [kind, condition] of [
      ["missing", rank === null],
      ["beyondFirst12", rank !== null && rank > 12],
      ["differentTitleFirst", hits.length && !row.firstHasSameNormalizedTitle],
      ["nonFirstUniqueTitle", row.normalizedTitleGroupSize === 1 && rank !== 1],
    ]) {
      if (condition && examples[kind].length < 8) examples[kind].push({ ...row,
        first3: hits.slice(0, 3).map((hit) => ({ id: hit.recipe.id, name: hit.recipe.name, type: hit.type, relevance: hit.relevance })),
      });
    }
  }
}

const summary = fixtures.flatMap((fixture) => ["all", ...types].map((type) => {
  const selected = rows.filter((row) => row.fixture === fixture.name && (type === "all" || row.type === type));
  const ranks = selected.map((row) => row.selfRank).filter((rank) => rank !== null);
  const unique = selected.filter((row) => row.normalizedTitleGroupSize === 1);
  return { fixture: fixture.name, type, subjects: selected.length,
    selfPresent: ranks.length, selfFirst: ranks.filter((rank) => rank === 1).length,
    selfWithin3: ranks.filter((rank) => rank <= 3).length,
    selfWithin12: ranks.filter((rank) => rank <= 12).length,
    worstSelfRank: ranks.length ? Math.max(...ranks) : null,
    sameNormalizedTitleFirst: selected.filter((row) => row.firstHasSameNormalizedTitle).length,
    uniqueNormalizedTitleSubjects: unique.length,
    uniqueNormalizedTitleFirst: unique.filter((row) => row.selfRank === 1).length,
    selfWithNon150Relevance: selected.filter((row) => row.selfRank !== null && row.selfRelevance !== 150).length,
  };
}));
const paired = catalog.map(({ recipe }) => {
  const [empty, ample] = rows.filter((row) => row.id === recipe.id);
  return { id: recipe.id, rankChanged: empty.selfRank !== ample.selfRank, firstIdChanged: empty.firstId !== ample.firstId };
});
const result = {
  artifact: release.artifact, environment: release.environment,
  method: "Each indexed record supplies its own unedited full name as a query to the released search function. Identity is checked by exact record ID, separately from equality of the app-normalized title. Two inventory fixtures use the page's ready-set construction.",
  fixture: { servings: 2, plannedRecipes: 0, category: "all", scope: "all", querySource: "Public recipe names only; no user queries", ampleQuantity: model.maxQuantity,
    units: "Catalog base units, grams or pieces; the maximum fixture isolates software ranking and is not a realistic pantry.",
    readyCounts: Object.fromEntries(fixtures.map((fixture) => [fixture.name, fixture.ready.size])),
  },
  indexedRecords: catalog.length, searches: rows.length,
  rawTitleGroups: rawGroups.size, normalizedTitleGroups: titleGroups.size,
  duplicateRawGroups: duplicates(rawGroups), duplicateNormalizedGroups: duplicates(titleGroups),
  normalizationMergedGroups: [...titleGroups].filter(([, entries]) => new Set(entries.map(({ recipe }) => recipe.name)).size > 1)
    .map(([title, entries]) => ({ title, entries: entries.map(({ recipe, type }) => ({ id: recipe.id, name: recipe.name, type })) })),
  summary, rankChangesBetweenFixtures: paired.filter((row) => row.rankChanged).length,
  firstIdChangesBetweenFixtures: paired.filter((row) => row.firstIdChanged).length,
  examples, rows,
  sourceAndLicense: "Input titles are already bundled in the public release. See DATA-SOURCES.md for upstream attribution and licenses; this experiment adds no external content.",
  limitation: "A known-record identity probe using unchanged full titles, not human relevance labeling or a user-search accuracy estimate. It does not evaluate typos, partial names, aliases as queries, traditional Chinese input, other filters, mobile rendering or culinary equivalence of same-title records.",
};
const output = JSON.stringify(result, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
else process.stdout.write(output);
