// Only inspect an explicitly labeled post-promotion section. Never substitute
// the headline promotional APY or a lower balance tier for the standard rate.
export function standardRateMismatch(text: string, stored: number | string | null | undefined) {
  if (stored == null || !Number.isFinite(Number(stored))) return false;
  const section = text.match(/after\s+(?:the\s+)?(?:boost|promo(?:tion)?)\s+ends[\s\S]{0,160}?(\d+(?:\.\d+)?)\s*%\s*APY/i);
  return Boolean(section && Math.abs(Number(section[1]) - Number(stored)) > 0.001);
}
