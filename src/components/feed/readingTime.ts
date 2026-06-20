// 200 wpm — среднее для русскоязычного non-fiction. Минимум — 1 мин, чтобы
// не показывать «0 мин чтения» для коротких заметок.
const WORDS_PER_MINUTE = 200;

export function readingTimeMinutes(plainText: string): number {
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
