// In-memory rate limiter — single-instance деплой (Hetzner V1).
// TODO(phase-2): persistent backend (Redis/Postgres) при scale-out.

export type LimitKind = "comment" | "post";
export type LimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; reason: "gap" | "window" };

interface Rule { windowMs: number; maxInWindow: number; gapMs: number; }

const RULES: Record<LimitKind, Rule> = {
  comment: { windowMs: 60 * 60 * 1000, maxInWindow: 20, gapMs: 10_000 },
  post:    { windowMs: 60 * 60 * 1000, maxInWindow: 5,  gapMs: 30_000 },
};

const MAX_KEYS = 10_000;
const store = new Map<string, number[]>();

function evictIfFull(): void {
  if (store.size < MAX_KEYS) return;
  const firstKey = store.keys().next().value;
  if (firstKey !== undefined) store.delete(firstKey);
}

export function checkLimit(userId: string, kind: LimitKind): LimitResult {
  const rule = RULES[kind];
  const now = Date.now();
  const key = `${userId}:${kind}`;
  const arr = store.get(key) ?? [];

  const fresh = arr.filter((t) => now - t < rule.windowMs);

  if (fresh.length > 0) {
    const last = fresh[fresh.length - 1];
    if (now - last < rule.gapMs) {
      return { ok: false, retryAfterSec: Math.ceil((rule.gapMs - (now - last)) / 1000), reason: "gap" };
    }
  }

  if (fresh.length >= rule.maxInWindow) {
    const oldest = fresh[0];
    return { ok: false, retryAfterSec: Math.ceil((rule.windowMs - (now - oldest)) / 1000), reason: "window" };
  }

  fresh.push(now);
  if (store.has(key)) store.delete(key);
  evictIfFull();
  store.set(key, fresh);
  return { ok: true };
}

export function _resetForTests(): void { store.clear(); }
