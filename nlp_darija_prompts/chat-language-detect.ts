export type DetectedChatLang = "darija" | "french" | "arabic" | "mixed";

const DARIJA_KEYWORDS = [
  "wach",
  "wash",
  "kifash",
  "fin",
  "ach",
  "bghit",
  "daba",
  "zwina",
  "mzyan",
  "nta",
  "nti",
  "hna",
  "dial",
  "dyali",
  "walo",
  "bezaf",
  "chwiya",
  "khouya",
  "sahbi",
  "labas",
  "bikhir",
  "wakha",
  "iyeh",
  "la",
] as const;

export function detectLanguage(text: string): DetectedChatLang {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const textLower = text.toLowerCase();
  const hasDarijaKeyword = DARIJA_KEYWORDS.some((k) => textLower.includes(k));

  if (hasDarijaKeyword) return "darija";
  if (arabicChars > latinChars && arabicChars > 5) return "arabic";
  if (latinChars > 0 && arabicChars > 0) return "mixed";
  return "french";
}
