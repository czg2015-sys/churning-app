// Copyright-friendly RSS lead discovery: read only titles and article URLs,
// never copy article bodies or treat third-party summaries as verified terms.
export type BankLeadCategory = "checking_bonus" | "savings_bonus" | "hysa";
export type BankRssLead = { title: string; articleUrl: string; category: BankLeadCategory; institution: string };

function decodeXml(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (key.startsWith("#")) {
      const hex = key.startsWith("#x");
      const n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[key] ?? match;
  });
}

function readTag(xml: string, tag: string) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  if (!match) return "";
  return decodeXml(match[1].replace(/^<!\\[CDATA\\[/, "").replace(/\\]\\]>$/, "").replace(/<[^>]*>/g, "").trim()).trim();
}

export function categorizeBankHeadline(title: string): BankLeadCategory | null {
  // Keep news, stocks, referrals, credit cards, business and unrelated
  // cashback deals out of the bank-account review queue.
  if (/\\b(credit card|airline|miles|points|business|merchant|coupon|giftcard|gift card|loan|mortgage|ira|brokerage|stock|cryptocurrency)\\b/i.test(title)) return null;
  const cashBonus = /\\bbonus\\b|\\$\\s*[0-9][\\d,]*/i.test(title);
  if (/\\b(checking|bank account)\\b/i.test(title) && cashBonus) return "checking_bonus";
  if (/\\b(savings|money market|money-market)\\b/i.test(title) && cashBonus) return "savings_bonus";
  if (/\\b(savings|money market|high.yield)\\b/i.test(title) && /\\d+(?:\\.\\d+)?\\s*%\\s*(?:apy|yield)|\\bapy\\b/i.test(title)) return "hysa";
  if (/\\b(bank|credit union|\\bfcu\\b)\\b/i.test(title) && /\\bbonus\\b/i.test(title)) return "checking_bonus";
  return null;
}

function bankNameFromHeadline(title: string) {
  const clean = title.replace(/^(?:\\[[^\\]]{1,80}\\]\\s*)+/g, "").replace(/^(?:Update|Updated)\\s*[:–-]\\s*/i, "");
  const split = /^(.*?)\\s+(?:\\$\\s*[0-9]|(?:up to )?\\d+(?:\\.\\d+)?%|checking|savings|bank account)/i.exec(clean);
  const candidate = (split?.[1] || clean.split(/[:–—]/)[0]).trim();
  return candidate && candidate.length <= 75 ? candidate : "Bank name needs verification";
}

export function parseBankAccountRss(xml: string, maxItems = 30): BankRssLead[] {
  const out: BankRssLead[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<item(?:\\s[^>]*)?>([\\s\\S]*?)<\\/item>/gi)) {
    const title = readTag(match[1], "title").slice(0, 180);
    const raw = readTag(match[1], "link");
    const category = categorizeBankHeadline(title);
    if (!title || !raw || !category) continue;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || !["doctorofcredit.com", "www.doctorofcredit.com"].includes(url.hostname.toLowerCase()) || url.username || url.password) continue;
      url.hash = "";
      if (seen.has(url.toString())) continue;
      seen.add(url.toString());
      out.push({ title, articleUrl: url.toString(), category, institution: bankNameFromHeadline(title) });
      if (out.length >= maxItems) break;
    } catch { /* Ignore invalid and off-site links. */ }
  }
  return out;
}
