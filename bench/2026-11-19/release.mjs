import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createContext, Script } from "node:vm";

export async function openRelease(input) {
  const bytes = await readFile(input ?? new URL("../../index.html", import.meta.url));
  const scripts = [...bytes.toString("utf8").matchAll(/<script>([\s\S]*?)<\/script>/gu)]
    .map(([, code]) => code);
  const library = scripts.findIndex((code) => code.includes("const Cookbook ="));
  const modelCode = scripts.find((code) => code.includes("const MealModel ="));
  assert.ok(library > 0 && modelCode, "Released library and model are required");
  const feed = scripts[library + 1].split("\n").find((line) => line.startsWith("Cookbook.addWebsiteRecipes("));
  assert.ok(feed?.endsWith(");"), "The bundled expansion index is required");
  const returnMarker = "\n  return { exact, reference, entries,";
  assert.equal(scripts[library].split(returnMarker).length, 2);
  // Expose two diagnostic functions without changing their bodies or the
  // search implementation. The input HTML is left untouched.
  const exposedLibrary = scripts[library].replace(returnMarker,
    "\n  return { diagnostics: { recipeText, splitWord }, exact, reference, entries,");
  const context = createContext({});
  const dataProgram = new Script([
    ...scripts.slice(0, library), exposedLibrary, feed, "({ MealCatalog, Cookbook })",
  ].join("\n"), { filename: "released-catalog" });
  const { MealCatalog, Cookbook } = dataProgram.runInContext(context, { timeout: 10_000 });
  const modelProgram = new Script(modelCode + "\nMealModel", { filename: "released-storage-model" });
  return {
    catalog: MealCatalog,
    cookbook: Cookbook,
    createModel(storage) {
      return modelProgram.runInNewContext({
        MealCatalog, Cookbook, localStorage: storage, navigator: {}, structuredClone,
      }, { timeout: 5000 });
    },
    artifact: { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") },
    environment: {
      node: process.version, platform: process.platform, architecture: process.arch,
      unicode: process.versions.unicode, icu: process.versions.icu,
    },
  };
}
