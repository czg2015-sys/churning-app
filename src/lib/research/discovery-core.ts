export type DiscoveryCategory = "hysa" | "savings_bonus" | "checking_bonus" | "debit_spend" | "credit_card_bonus";
export type DiscoverySource = { institution: string; url: string; category: DiscoveryCategory };

export function canonicalizeUrl(raw: string) {
  const url = new URL(raw);
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (/^(utm_|gclid$|fbclid$)/i.test(key)) url.searchParams.delete(key);
  }
  // Preserve offer/referral codes: they can change eligibility and reward amounts.
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  url.searchParams.sort();
  return url.toString();
}

export function isDiscoveryCategory(value: string): value is DiscoveryCategory {
  return ["hysa", "savings_bonus", "checking_bonus", "debit_spend", "credit_card_bonus"].includes(value);
}

export function uniqueSources(sources: DiscoverySource[]) {
  const seen = new Set<string>();
  return sources.filter(source => {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
      const key = `${source.category}|${canonicalizeUrl(source.url)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch { return false; }
  });
}

// Discover one level of relevant links, restricted to the exact source host.
// Linked pages must still be fetched and checked; anchor text is not evidence.
export function extractOfferLinks(html: string, baseUrl: string, limit = 3): string[] {
  const base = new URL(baseUrl);
  const urls = new Set<string>();
  const clean = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const match of clean.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = match[2].replace(/<[^>]*>/g, " ");
    if (!/bonus|offer|promotion|high.yield|cash.back|rewards|savings.*rate/i.test(`${match[1]} ${label}`)) continue;
    try {
      const url = new URL(match[1].replace(/&amp;/gi, "&"), base);
      if (url.protocol !== "https:" || url.host !== base.host || url.username || url.password) continue;
      if (/login|sign.in|apply|application|business|commercial|mortgage|loan|\.pdf$/i.test(url.pathname)) continue;
      url.hash = "";
      if (canonicalizeUrl(url.href) === canonicalizeUrl(base.href)) continue;
      urls.add(url.href);
      if (urls.size >= limit) break;
    } catch { /* Ignore malformed links. */ }
  }
  return [...urls];
}

export function offerSignal(text: string, category: DiscoveryCategory) {
  // Generic navigation mentioning "direct deposit" is not a bonus offer.
  if (category === "hysa") return /\d+(?:\.\d+)?\s*%\s*(?:annual percentage yield|apy)|(?:apy|annual percentage yield)[\s\S]{0,50}\d+(?:\.\d+)?\s*%/i.exec(text);
  if (category === "debit_spend") return /cash\s*back|cashback|debit[\s\S]{0,80}(?:bonus|rewards)/i.exec(text);
  return /(?:bonus|welcome offer|earn|receive|get)[\s\S]{0,100}\$\s*[\d,]+|\$\s*[\d,]+[\s\S]{0,100}(?:bonus|welcome offer)/i.exec(text);
}

// Linked pages occasionally advertise multiple product types. Keep the
// category tied to the linked product URL, not blindly copied from a generic
// parent page. Unclear links remain private candidates for manual review.
export function categorizeLinkedSource(parent: DiscoverySource, rawUrl: string): DiscoveryCategory | null {
  let path: string;
  try { path = new URL(rawUrl).pathname.toLowerCase(); } catch { return null; }
  if (/\\b(?:business|commercial|mortgage|loan|credit-card)\\b/.test(path)) return null;
  if (/checking/.test(path) && !/savings/.test(path)) return "checking_bonus";
  if (/savings|money-market|moneymarket/.test(path)) {
    if (/bonus|offer|promo/.test(path)) return "savings_bonus";
    if (/yield|rate|savings-account/.test(path)) return "hysa";
  }
  return parent.category;
}

export const SEED_SOURCES: DiscoverySource[] = [
  { institution: "American Express", url: "https://www.americanexpress.com/en-us/banking/online-savings/high-yield-savings-account/", category: "hysa" },
  { institution: "Synchrony Bank", url: "https://www.synchrony.com/banking/products/high-yield-savings", category: "hysa" },
  { institution: "Capital One", url: "https://www.capitalone.com/bank/savings-accounts/online-performance-savings-account/", category: "hysa" },
  { institution: "Banner Bank", url: "https://www.bannerbank.com/new-account-offers/personal-account-offers", category: "checking_bonus" },
  { institution: "Banner Bank", url: "https://www.bannerbank.com/new-account-offers/personal-account-offers/personal-savings-bonus", category: "savings_bonus" },
  { institution: "Frontwave Credit Union", url: "https://www.frontwavecu.com/new-member", category: "checking_bonus" },
  { institution: "Frontwave Credit Union", url: "https://www.frontwavecu.com/deposit-offers", category: "savings_bonus" },
  { institution: "E*TRADE", url: "https://us.etrade.com/promo/savings", category: "savings_bonus" },
  { institution: "Citizens Bank", url: "https://www.citizensbank.com/promo/checking/ag-move-money-chk-2026.aspx", category: "savings_bonus" },
  { institution: "Chase", url: "https://account.chase.com/consumer/banking/savingsoffer", category: "savings_bonus" },
  { institution: "SoFi", url: "https://www.sofi.com/banking/", category: "checking_bonus" },
];
