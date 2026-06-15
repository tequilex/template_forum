import { describe, it, expect, vi, beforeEach } from "vitest";

// Моки до import'а тестируемого модуля.
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  getDb: () => mockDb,
  getPool: () => ({ end: () => Promise.resolve() }),
}));

// Моки helpers — чтобы фокусироваться на ветках экшена, не на их внутренностях.
vi.mock("@/lib/slugify", () => ({
  slugify: (s: string) => s.toLowerCase().replace(/\s+/g, "-"),
  uniqueSlug: async (base: string) => base,
}));
vi.mock("@/components/editor/renderBlock", () => ({ renderBlock: () => "<rendered/>" }));
vi.mock("@/components/editor/sanitize", () => ({ sanitize: (s: string) => s }));
vi.mock("@/components/editor/extractPlainText", () => ({ extractPlainText: () => "excerpt" }));
vi.mock("@/components/editor/extractCoverUrl", () => ({ extractCoverUrl: () => null }));
vi.mock("@/lib/auth/id", () => ({ newId: () => "01J0NEW000000000000000000ID" }));

import { saveDraft, publishPost } from "@/server/posts";

beforeEach(() => {
  // resetAllMocks (а не clearAllMocks) — чистит и mockReturnValueOnce-очередь,
  // иначе остатки из предыдущего теста съест requireOwnPost в следующем.
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "USER01" } });
});

const fluentInsert = () => ({ values: vi.fn().mockResolvedValue(undefined) });
const fluentUpdate = () => ({
  set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
});
const fluentSelectReturn = (rows: unknown[]) => {
  const whereResult: any = Promise.resolve(rows);
  whereResult.limit = () => Promise.resolve(rows);
  return {
    from: () => ({
      where: () => whereResult,
      orderBy: () => Promise.resolve(rows),
    }),
  };
};

describe("saveDraft", () => {
  it("без сессии → throws unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(saveDraft(null, "title", { blocks: [] })).rejects.toThrow(/unauth/i);
  });

  it("postId=null → INSERT с новым ULID", async () => {
    mockDb.insert.mockReturnValueOnce(fluentInsert());
    const out = await saveDraft(null, "Новый пост", { blocks: [] });
    expect(out.postId).toBe("01J0NEW000000000000000000ID");
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("postId !== null → UPDATE без смены статуса", async () => {
    // requireOwnPost вернёт строку
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "POST01", authorId: "USER01", status: "draft", deletedAt: null }]));
    mockDb.update.mockReturnValueOnce(fluentUpdate());
    const out = await saveDraft("POST01", "обновлённый", { blocks: [] });
    expect(out.postId).toBe("POST01");
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("postId чужой → notFound (через requireOwnPost)", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([])); // не найден
    // notFound в Next.js кидает специальную ошибку
    await expect(saveDraft("POST_OTHER", "x", { blocks: [] })).rejects.toThrow();
  });

  it("title > 200 chars → zod throws", async () => {
    await expect(saveDraft(null, "x".repeat(201), { blocks: [] })).rejects.toThrow();
  });
});

describe("publishPost", () => {
  beforeEach(() => {
    // Дефолт: тэги существуют
    mockDb.transaction.mockImplementation(async (cb: any) => {
      await cb({
        update: () => fluentUpdate(),
        insert: () => fluentInsert(),
      });
    });
  });

  it("happy path", async () => {
    // requireOwnPost
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{
      id: "POST01", authorId: "USER01", status: "draft", deletedAt: null,
      title: "Hello world", content: { blocks: [{ type: "paragraph", data: { text: "тело" } }] },
    }]));
    // tags exist check
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "TAGEXP" }]));
    const out = await publishPost("POST01", ["TAGEXP"]);
    expect(out.slug).toBe("hello-world");
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it("без тэгов → tags_required", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{
      id: "POST01", authorId: "USER01", status: "draft", deletedAt: null,
      title: "Hello", content: { blocks: [{ type: "paragraph", data: { text: "x" } }] },
    }]));
    await expect(publishPost("POST01", [])).rejects.toThrow(/tags_required/);
  });

  it("пустой content → content_empty", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{
      id: "POST01", authorId: "USER01", status: "draft", deletedAt: null,
      title: "Hello", content: { blocks: [] },
    }]));
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "TAGEXP" }]));
    await expect(publishPost("POST01", ["TAGEXP"])).rejects.toThrow(/content_empty/);
  });

  it("status уже published → not_draft", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{
      id: "POST01", authorId: "USER01", status: "published", deletedAt: null,
      title: "Hello", content: { blocks: [{ type: "paragraph", data: { text: "x" } }] },
    }]));
    await expect(publishPost("POST01", ["TAGEXP"])).rejects.toThrow(/not_draft/);
  });

  it("несуществующий тэг → bad_tags", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{
      id: "POST01", authorId: "USER01", status: "draft", deletedAt: null,
      title: "Hello", content: { blocks: [{ type: "paragraph", data: { text: "x" } }] },
    }]));
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([])); // ни один из запрошенных тэгов не существует
    await expect(publishPost("POST01", ["TAGBOGUS"])).rejects.toThrow(/bad_tags/);
  });
});
