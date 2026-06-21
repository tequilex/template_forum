// Русское pluralisation: word(1) | word(2..4) | word(5..)
// Исключения 11..14 — всегда 5+-форма.
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const n10 = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (n10 > 1 && n10 < 5) return few;
  if (n10 === 1) return one;
  return many;
}
