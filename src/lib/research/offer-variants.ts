// Conservative multi-promotion extraction for already fetched, publicly readable
// bank webpages. These are discovery *leads*, not verified terms or payouts.
// Never infer a bonus from an unrelated balance/deposit/fee amount.
export type ExplicitBonus = {
  amount: number;
  product: string;
  key: string;
  excerpt: string;
};

export type BonusCategory = "checking_bonus" | "savings_bonus";

function productNear(text: string, at: number, end: number) {
  // The product label must be present on the page; do not invent it.
  // The capitalization check helps avoid generic phrases like "checking account".
  const pattern = /\b((?:[A-Z][A-Za-z0-9&'-]*\s+){1,3}(?:Checking|Savings|Banking)(?:\s+Account)?)\b/g;
  const before = text.slice(Math.max(0, at - 180), at);
  const labels = [...before.matchAll(pattern)];
  const near = labels.at(-1);
  if (near && before.length - (near.index || 0) - near[0].length < 135) {
    return near[1].trim();
  }
  const after = text.slice(end, Math.min(text.length, end + 100));
  const found = pattern.exec(after);
  return found && (found.index || 0) < 55 ? found[1].trim() : null;
}

function validForCategory(product: string, category: BonusCategory) {
  return category === "checking_bonus"
    ? /\b(checking|banking)\b/i.test(product)
    : /\b(savings|money market)\b/i.test(product);
}

export function extractExplicitBonusVariants(text: string, category: BonusCategory, limit = 8): ExplicitBonus[] {
  if (!text || text.length > 700_000) return [];
  const matches: { at: number; end: number; amount: number }[] = [];
  const money = String.raw`\$\s*([0-9]{2,3}(?:,[0-9]{3})?|[0-9]{4,5})(?:\.[0-9]{2})?`;
  const patterns = [
    new RegExp(money + String.raw`\s*(?:cash\s+)?(?:bonus|reward)\b`, "gi"),
    new RegExp(String.raw`\b(?:bonus|reward)\s*(?:of|up to|:)\s*` + money, "gi"),
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const amount = Number((match[1] || "").replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount < 50 || amount > 20_000) continue;
      matches.push({ at: match.index || 0, end: (match.index || 0) + match[0].length, amount });
    }
  }
  matches.sort((a, b) => a.at - b.at);
  const results: ExplicitBonus[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const product = productNear(text, match.at, match.end);
    // Generic pages often discuss both checking and savings; only assign a
    // variant when its own product label supports the chosen category.
    if (!product || !validForCategory(product, category)) continue;
    const normalizedProduct = product.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const key = "bonus-" + match.amount + "-" + normalizedProduct;
    if (seen.has(key)) continue;
    seen.add(key);
    const excerpt = text.slice(Math.max(0, match.at - 95), Math.min(text.length, match.end + 240)).replace(/\s+/g, " ").trim();
    results.push({ amount: match.amount, product, key, excerpt });
    if (results.length >= limit) break;
  }
  return results;
}


// Even when the webpage lacks reliable product labels, multiple distinct
// advertised bonus amounts make page-wide "closest dollar" extraction unsafe.
export function distinctAdvertisedBonusAmounts(text: string): number[] {
  if (!text || text.length > 700_000) return [];
  const money = String.raw`\$\s*([0-9]{2,3}(?:,[0-9]{3})?|[0-9]{4,5})(?:\.[0-9]{2})?`;
  const expressions = [
    new RegExp(money + String.raw`\s*(?:cash\s+)?(?:bonus|reward)\b`, "gi"),
    new RegExp(String.raw`\b(?:bonus|reward)\s*(?:of|up to|:)\s*` + money, "gi"),
  ];
  const amounts = new Set<number>();
  for (const expression of expressions) {
    for (const match of text.matchAll(expression)) {
      const amount = Number((match[1] || "").replace(/,/g, ""));
      if (amount >= 50 && amount <= 20_000 && Number.isFinite(amount)) amounts.add(amount);
    }
  }
  return [...amounts].sort((a, b) => b - a);
}
