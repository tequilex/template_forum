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
const fluentDelete = () => ({ where: vi.fn().mockResolvedValue(undefined) });
const fluentSelectReturn = (rows: unknown[]) => {
  const whereResult: any = Promise.resolve(rows);
  whereResult.limit = () => Promise.resolve(rows);
  const fromResult = {
    where: () => whereResult,
    orderBy: () => Promise.resolve(rows),
    innerJoin: () => ({ where: () => whereResult }),
  };
  return { from: () => fromResult };
};

describe("saveDraft", () => {
  it("без сессии → throws unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(saveDraft(null, "title", { blocks: [] })).rejects.toThrow(/unauth/i);
  });

  it("postId=null → INSERT с новым ULID", async () => {
    // saveDraft теперь оборачивает posts+post_tags INSERT'ы в transaction.
    const txInsert = vi.fn(() => fluentInsert());
    mockDb.transaction.mockImplementationOnce(async (cb: any) => {
      await cb({ insert: txInsert });
    });
    const out = await saveDraft(null, "Новый пост", { blocks: [] });
    expect(out.postId).toBe("01J0NEW000000000000000000ID");
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(txInsert).toHaveBeenCalledTimes(1); // только posts (tagIds=[] → tags insert skip)
  });

  it("postId !== null → UPDATE без смены статуса", async () => {
    // requireOwnPost вернёт строку
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "POST01", authorId: "USER01", status: "draft", deletedAt: null }]));
    const txUpdate = vi.fn(() => fluentUpdate());
    const txDelete = vi.fn(() => fluentDelete());
    mockDb.transaction.mockImplementationOnce(async (cb: any) => {
      await cb({ update: txUpdate, delete: txDelete, insert: () => fluentInsert() });
    });
    const out = await saveDraft("POST01", "обновлённый", { blocks: [] });
    expect(out.postId).toBe("POST01");
    expect(txUpdate).toHaveBeenCalledTimes(1);
    // draft → теги пере-выставляем (delete для пустого tagIds[], insert skip).
    expect(txDelete).toHaveBeenCalledTimes(1);
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
        delete: () => fluentDelete(),
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
    // post-transaction: author username + tag slugs (для IndexNow)
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ username: "alice" }]));
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ slug: "js" }]));
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

import { republishPost, archivePost, unarchivePost, softDeletePost } from "@/server/posts";

describe("republishPost", () => {
  it("happy: пересчитывает excerpt/coverUrl/contentHtml, slug не трогает", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{
      id: "POST01", authorId: "USER01", status: "published", deletedAt: null,
      title: "Hello", slug: "hello",
      content: { blocks: [{ type: "paragraph", data: { text: "обновл" } }] },
    }]));
    // post-transaction: author username + tag slugs (для IndexNow)
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ username: "alice" }]));
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ slug: "js" }]));
    mockDb.transaction.mockImplementation(async (cb: any) => {
      await cb({ update: () => fluentUpdate() });
    });
    await expect(republishPost("POST01")).resolves.toBeUndefined();
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it("status !== published → not_published", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{
      id: "POST01", authorId: "USER01", status: "draft", deletedAt: null,
      title: "X", content: { blocks: [] },
    }]));
    await expect(republishPost("POST01")).rejects.toThrow(/not_published/);
  });
});

describe("archivePost", () => {
  it("happy", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "POST01", status: "published", deletedAt: null }]));
    mockDb.update.mockReturnValueOnce(fluentUpdate());
    await expect(archivePost("POST01")).resolves.toBeUndefined();
  });

  it("из draft нельзя → cannot_archive", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "POST01", status: "draft", deletedAt: null }]));
    await expect(archivePost("POST01")).rejects.toThrow(/cannot_archive/);
  });
});

describe("unarchivePost", () => {
  it("happy", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "POST01", status: "archived", deletedAt: null }]));
    mockDb.update.mockReturnValueOnce(fluentUpdate());
    await expect(unarchivePost("POST01")).resolves.toBeUndefined();
  });

  it("не archived → cannot_unarchive", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "POST01", status: "draft", deletedAt: null }]));
    await expect(unarchivePost("POST01")).rejects.toThrow(/cannot_unarchive/);
  });
});

describe("softDeletePost", () => {
  it("happy", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([{ id: "POST01", status: "draft", deletedAt: null, slug: "hello" }]));
    mockDb.update.mockReturnValueOnce(fluentUpdate());
    await expect(softDeletePost("POST01")).resolves.toBeUndefined();
  });

  it("уже удалён → notFound (через requireOwnPost)", async () => {
    mockDb.select.mockReturnValueOnce(fluentSelectReturn([])); // requireOwnPost не находит (isNull deletedAt)
    await expect(softDeletePost("POST01")).rejects.toThrow();
  });
});
