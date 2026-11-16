"use strict";

const Cookbook = (() => {
  const { ingredients, recipes } = MealCatalog;
  const guides = typeof MealGuides === "undefined" ? {} : MealGuides;
  const additional = typeof AdditionalMealRecipes === "undefined" ? [] : AdditionalMealRecipes;
  const everyday = typeof EverydayRecipes === "undefined" ? [] : EverydayRecipes;
  const extra = typeof EXTRA_DISHES === "undefined" ? [] : EXTRA_DISHES;
  const exact = [...recipes, ...additional, ...everyday, ...extra];
  const reference = typeof ExtraRecipeLibrary === "undefined" ? [] : ExtraRecipeLibrary;
  const normal = (text) => String(text).normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
  const safetySource = "https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety";
  const temperatureSource = "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures";
  const ingredientTerms = Object.fromEntries(Object.entries(ingredients).map(([food, info]) => [food, [info.name, ...info.aliases.filter((word) => word.length > 1)]]));
  const methods = ["空气炸", "微波炉", "电饭煲", "红烧", "清蒸", "水煮", "快炒", "凉拌", "焯水", "油炸", "煎", "烤", "拌", "炖", "焖", "蒸", "炒", "煮"];
  const methodAliases = [["空气炸锅", "空气炸"], ["气炸锅", "空气炸"], ["烤箱", "烤"], ["电饭锅", "电饭煲"]];
  const knownWords = [...new Set([...Object.values(ingredientTerms).flat(), ...methods])].sort((a, b) => b.length - a.length);
  const usesMeat = (food) => ingredients[food].group === "肉类与水产";
  const sameIngredient = Object.entries(ingredientTerms).flatMap(([food, words]) =>
    words.slice(1).filter((word) => Object.values(ingredientTerms).filter((group) => group.includes(word)).length === 1)
      .map((word) => [word, ingredients[food].name])
  ).sort((a, b) => b[0].length - a[0].length);
  const replacements = [...sameIngredient, ...methodAliases];
  const sites = new Map();
  const shared = new Map();

  function recipeText(value) {
    return replacements.reduce((text, [alias, label]) => text.replaceAll(alias, label), normal(value));
  }

  function makeEntry(recipe, type) {
    const measured = type === "exact";
    const foods = measured ? Object.keys(recipe.needs) :
      (recipe.matching ?? []).filter((food) => Object.hasOwn(ingredients, food));
    const category = recipe.category ?? (measured ? (
      /[汤羹粥]$/.test(recipe.name) ? "汤粥" : /面条|面$|饭|粉/.test(recipe.name) ? "主食" :
        foods.some(usesMeat) ? "荤菜" : "素菜和蛋豆"
    ) : "大家分享");
    const aliases = foods.flatMap((food) => ingredientTerms[food]);
    const title = recipeText(recipe.name);
    const alternateTitles = (recipe.aliases ?? []).map(recipeText);
    const materials = recipeText([...(recipe.ingredients ?? []), ...(recipe.quantities ?? []), ...aliases].join(" "));
    const steps = (guides[recipe.id]?.steps ?? recipe.steps ?? []).join(" ");
    const methodIndex = recipeText([
      ...(recipe.methods ?? []), ...methods.filter((method) => recipe.name.includes(method) || steps.includes(method))
    ].join(" "));
    return { recipe, type, category, foods, title, alternateTitles, materials, methodIndex };
  }

  const entries = [...exact.map((recipe) => makeEntry(recipe, "exact")), ...reference.map((recipe) => makeEntry(recipe, "reference"))];
  const localIds = new Set(entries.map(({ recipe }) => recipe.id));

  function addWebsiteRecipes(records) {
    for (const recipe of records) if (!localIds.has(recipe.id)) sites.set(recipe.id, makeEntry(recipe, "online"));
  }

  function setCommunityRecipes(records) {
    shared.clear();
    for (const recipe of records) shared.set(recipe.id, makeEntry(recipe, "shared"));
  }

  function categories() {
    return [...new Set([...entries, ...sites.values(), ...shared.values()].map((entry) => entry.category))]
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function splitWord(word) {
    let rest = word;
    const found = [];
    while (rest) {
      const part = knownWords.find((term) => rest.startsWith(term));
      if (!part) return [word];
      found.push(part);
      rest = rest.slice(part.length).replace(/^(?:和|加|配)(?=.)/u, "");
    }
    return found;
  }

  function search(stock, ready, query, category, scope) {
    const text = recipeText(query).replace(/^(?:我想做|我想吃|如何做|怎么做)(?=.)|(?:的做法|怎么做|如何做)$/gu, "");
    const keywords = text.split(/[\s、，,/；;+＋]+/u).filter(Boolean)
      .map((word) => ({ word, parts: splitWord(word) }));
    const rows = [];
    for (const entry of [...entries, ...sites.values(), ...shared.values()]) {
      if (category === "meatless") {
        if (entry.type !== "exact" || entry.foods.some(usesMeat)) continue;
      } else if (category && entry.category !== category) continue;
      if (scope === "shared" && entry.type !== "shared") continue;
      if (scope === "quick" && !(entry.recipe.minutes > 0 && entry.recipe.minutes <= 20)) continue;
      const fits = entry.type === "exact" && ready.has(entry.recipe.id);
      if (scope === "ready" && !fits) continue;
      const matchWord = (word) => entry.title.includes(word) ? 24
        : entry.alternateTitles.some((title) => title.includes(word)) ? 22
          : entry.materials.includes(word) ? 10 : entry.methodIndex.includes(word) ? 4 : 0;
      const scores = keywords.map(({ word, parts }) => {
        const direct = matchWord(word);
        if (direct) return direct;
        const matches = parts.map(matchWord);
        return matches.every(Boolean) ? Math.min(...matches) : 0;
      });
      if (scores.some((value) => !value)) continue;
      let relevance = scores.reduce((sum, value) => sum + value, 0);
      if (text === entry.title) relevance = 150;
      else if (entry.alternateTitles.includes(text)) relevance = 140;
      else if (text && entry.title.includes(text)) relevance += 80;
      const covered = entry.foods.filter((food) => stock[food]?.quantity > 0);
      const estimated = covered.some((food) => stock[food]?.estimated);
      const priority = covered.filter((food) => stock[food].priority).length;
      rows.push({ ...entry, covered, fits, estimated, relevance, priority });
    }
    return rows.sort((first, second) =>
      second.relevance - first.relevance ||
      Number(second.fits) - Number(first.fits) ||
      second.priority - first.priority ||
      second.covered.length / (second.foods.length || 1) - first.covered.length / (first.foods.length || 1) ||
      Number(second.type === "exact") - Number(first.type === "exact")
    );
  }

  function review(recipe) {
    const guide = guides[recipe.id] ?? {};
    const food = new Set(Object.keys(recipe.needs));
    const seasoning = recipe.seasoning ?? "";
    const caution = ["备菜前用肥皂洗手至少 20 秒。蔬果用流动水冲洗。"];
    const allergens = new Set();
    if (food.has("egg")) {
      caution.push("鸡蛋煮到蛋白、蛋黄凝固。整份蛋类菜肴中心温度达到 71℃。");
      allergens.add("鸡蛋");
    }
    if (["firm-tofu", "soft-tofu", "tofu-skin"].some((item) => food.has(item))) allergens.add("大豆");
    if (food.has("noodles")) allergens.add("含麸质谷物，请看包装");
    if (food.has("fish")) {
      caution.push("鱼片检查残刺，最厚处达到 63℃。");
      allergens.add("鱼");
    }
    if (food.has("shrimp") || food.has("dried-shrimp")) {
      caution.push("虾仁加热至中心不透明，呈珍珠白。");
      allergens.add("甲壳类");
    }
    if (food.has("chicken")) caution.push("鸡肉最厚处中心温度达到 74℃。");
    if (food.has("ground-pork")) caution.push("猪肉末中心温度达到 71℃。");
    if (food.has("pork") || food.has("beef")) caution.push("整切猪肉或牛肉用温度计测最厚处，达到 63℃后静置至少 3 分钟。肉末用 71℃标准。");
    if (food.has("cooked-rice")) caution.push("使用及时冷藏的熟米饭，翻炒时让米饭各处复热到 74℃。");
    if (food.has("sprouts")) caution.push("豆芽加热到完全熟透；给儿童、孕妇、老年人或免疫力较弱者烹制时尤其要避免生豆芽。");
    if (/生抽|酱油|蚝油|豆瓣/.test(seasoning)) allergens.add("调味料可能含大豆、小麦或贝类，请看成分表");
    if (/香油|芝麻/.test(seasoning)) allergens.add("芝麻");
    const rawProtein = [...food].some((item) => ingredients[item].group === "肉类与水产");
    if (rawProtein) caution.push("切过生肉或水产的刀、砧板和盘子清洗后再接触熟食，生熟分放。");
    caution.push("剩菜分装后尽快冷藏，常温超过 2 小时的易腐食物应弃置；环境超过 32℃时缩短到 1 小时。");
    return {
      steps: guide.steps ?? recipe.steps,
      taste: guide.taste ?? recipe.taste ?? "",
      caution: [...new Set([...caution, ...(guide.safety ?? recipe.safety ?? [])])],
      allergens: [...allergens],
    };
  }

  return { exact, reference, entries, sites, shared, categories, addWebsiteRecipes, setCommunityRecipes, review, search, safetySource, temperatureSource };
})();
