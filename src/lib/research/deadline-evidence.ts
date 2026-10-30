// Only extract dates explicitly coupled with promotional expiration language.
// Evidence is advisory: matching a date does not establish eligibility, and
// this parser never changes a live offer or certifies its official terms.
export type DeadlineEvidence = { date: string; excerpt: string };

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function extractExplicitDeadlines(text: string, limit = 8): DeadlineEvidence[] {
  if (!text || text.length > 1_000_000) return [];
  const pattern = /\b(?:offer\s+)?(?:expires?|ends?|open\s+by|apply\s+by|enroll\s+by|valid\s+(?:through|until)|available\s+until|offer\s+through|deadline(?:\s+is)?)\s*(?:on|by|:)?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/gi;
  const found: DeadlineEvidence[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const month = MONTHS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = Number(match[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCMonth() + 1 !== month || utc.getUTCDate() !== day) continue;
    const date = utc.toISOString().slice(0, 10);
    if (seen.has(date)) continue;
    seen.add(date);
    const pos = match.index ?? 0;
    const excerpt = text.slice(Math.max(0, pos - 80), Math.min(text.length, pos + match[0].length + 80)).replace(/\s+/g, " ").trim();
    found.push({ date, excerpt });
    if (found.length >= limit) break;
  }
  return found;
}

export function storedDeadlineDisagrees(storedExpiry: string | null | undefined, evidence: DeadlineEvidence[]) {
  if (!storedExpiry || evidence.length !== 1) return false;
  const stored = Date.parse(storedExpiry);
  const onPage = Date.parse(evidence[0].date + "T12:00:00Z");
  // Allow for offer end-of-day and US time zones; beyond 36 hours is a
  // meaningful mismatch. Multiple advertised deadlines remain ambiguous.
  return Number.isFinite(stored) && Number.isFinite(onPage) && Math.abs(stored - onPage) > 36 * 60 * 60 * 1000;
}
