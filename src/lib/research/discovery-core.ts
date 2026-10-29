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

export const SEED_SOURCES: DiscoverySource[] = [
  { institution: "American Express", url: "https://www.americanexpress.com/en-us/banking/online-savings/high-yield-savings-account/", category: "hysa" },
  { institution: "Synchrony Bank", url: "https://www.synchrony.com/banking/products/high-yield-savings", category: "hysa" },
  { institution: "Capital One", url: "https://www.capitalone.com/bank/savings-accounts/online-performance-savings-account/", category: "hysa" },
  { institution: "Banner Bank", url: "https://www.bannerbank.com/new-account-offers/personal-account-offers", category: "checking_bonus" },
  { institution: "Banner Bank", url: "https://www.bannerbank.com/new-account-offers/personal-account-offers", category: "savings_bonus" },
  { institution: "Frontwave Credit Union", url: "https://www.frontwavecu.com/new-member", category: "checking_bonus" },
  { institution: "Frontwave Credit Union", url: "https://www.frontwavecu.com/deposit-offers", category: "savings_bonus" },
];
