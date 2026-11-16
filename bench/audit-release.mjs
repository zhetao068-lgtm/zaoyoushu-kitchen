import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const buffer = await readFile(process.argv[2] ?? new URL("../index.html", import.meta.url));
const html = buffer.toString("utf8");
const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/u.exec(html)?.[1];
assert.ok(csp);
assert.match(csp, /default-src 'none'/u);
assert.match(csp, /connect-src 'none'/u);
assert.match(csp, /form-action 'none'/u);
assert.match(csp, /require-trusted-types-for 'script'/u);
assert.doesNotMatch(html, /chatgpt\.site|here\.now\/c\/|api\/community\/|COMMUNITY_(?:OWNER_KEY|ADMIN_TOKEN)|-----BEGIN [ A-Z]+PRIVATE KEY-----|[a-z]:[\\/]+Users[\\/]/iu);
assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src=|rel="stylesheet")/u);

const inlineScripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/gu), ([, content]) => content);
const inlineStyles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/gu), ([, content]) => content);
assert.ok(inlineScripts.length && inlineStyles.length);
const directives = new Map(csp.split(";").map((part) => {
  const [name, ...values] = part.trim().split(/\s+/u);
  return [name, values];
}));
for (const [directive, entries] of [["script-src", inlineScripts], ["style-src", inlineStyles]]) {
  const hashes = entries.map((body) => "'sha256-" + createHash("sha256").update(body).digest("base64") + "'");
  assert.deepEqual(directives.get(directive), hashes);
}

const field = /^const sharedCatalogDetails = (.+);$/mu.exec(html)?.[1];
assert.ok(field);
const onlineRecipes = Object.values(JSON.parse(field));
const licenses = {};
for (const recipe of onlineRecipes) {
  assert.ok(recipe.name && recipe.steps.length && recipe.safety.length && recipe.source && recipe.licenseUrl);
  const label = new URL(recipe.licenseUrl).hostname;
  licenses[label] = (licenses[label] ?? 0) + 1;
}
assert.match(html, /MIT License/u);
console.log(JSON.stringify({
  htmlBytes: buffer.length,
  gzipLevel9Bytes: gzipSync(buffer, { level: 9 }).length,
  sha256: createHash("sha256").update(buffer).digest("hex"),
  checkedScriptHashes: inlineScripts.length,
  checkedStyleHashes: inlineStyles.length,
  sourceRecipesWithAttribution: onlineRecipes.length,
  licenses,
}, null, 2));
