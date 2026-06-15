// Slug-генератор для постов.
// RU → latin транслитерация по предопределённой map (~30 строк),
// потом NFKD-стрип диакритики, lowercase, [^a-z0-9] → '-', collapse, trim, max 80.
//
// TODO(plan-5+): если потребуется смена slug опубликованного поста (например, фикс опечатки)
// — нужна таблица post_slug_history + 301-redirect middleware. В plan-04 slug фиксируется в
// первой публикации и неизменен.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts } from "@db/schema";

const CYR: Record<string, string> = {
  а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo",
  ж:"zh", з:"z", и:"i", й:"y", к:"k", л:"l", м:"m",
  н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u",
  ф:"f", х:"kh", ц:"ts", ч:"ch", ш:"sh", щ:"sch",
  ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya",
};

export function slugify(input: string): string {
  if (!input) return "";
  const lower = input.toLowerCase();
  const translit = Array.from(lower).map(ch => CYR[ch] ?? ch).join("");
  const stripped = translit.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const dashed = stripped.replace(/[^a-z0-9]+/g, "-");
  const trimmed = dashed.replace(/^-+|-+$/g, "");
  const truncated = trimmed.slice(0, 80);
  return truncated.replace(/-+$/g, ""); // re-trim if slice ended on dash
}

// Пробуем base, base-2, base-3, … до 50. Лимит — защита от бесконечного цикла
// в pathological случае (50 одинаковых title'ов от одного автора — крайне маловероятно).
const MAX_TRIES = 50;

export async function uniqueSlug(base: string): Promise<string> {
  if (base.length === 0) throw new Error("slug_empty");
  const db = getDb();
  for (let i = 1; i <= MAX_TRIES; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (candidate.length > 80) break; // base уже почти 80 + суффикс не влез
    const row = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, candidate))
      .limit(1);
    if (row.length === 0) return candidate;
  }
  throw new Error("slug_too_many_collisions");
}
