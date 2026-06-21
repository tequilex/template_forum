import {
  pgTable, text, varchar, integer, bigint, timestamp, pgEnum, jsonb,
  index, primaryKey,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "moderator", "admin"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified"),
  username: varchar("username", { length: 20 }).unique(),
  name: varchar("name", { length: 100 }),
  image: text("image"),
  bio: text("bio"),
  role: userRole("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  banReason: text("ban_reason"),
  bannedAt: timestamp("banned_at"),
}, (t) => ({
  usernameIdx: index("users_username_idx").on(t.username),
}));

// NB: TS-keys в `accounts` намеренно mixed case (camelCase для userId/providerAccountId,
// snake_case для refresh_token/access_token/etc) — этого требует @auth/drizzle-adapter,
// он обращается к property-names напрямую. Спека §6.2 даёт ровно эти имена.
export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => ({
  pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
}));

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.identifier, t.token] }),
}));

export const postStatus = pgEnum("post_status", ["draft", "published", "archived"]);

// posts — основной контент проекта. content (JSONB) — Editor.js OutputData;
// content_html — серверный кеш для public-страниц, регенерится только в publishPost/republishPost.
export const posts = pgTable("posts", {
  id: text("id").primaryKey(),                          // ULID, newId()
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  excerpt: varchar("excerpt", { length: 280 }),
  content: jsonb("content").notNull(),                  // Editor.js OutputData
  contentHtml: text("content_html"),                    // null до publishPost
  coverUrl: text("cover_url"),                          // первый image-блок из content
  status: postStatus("status").notNull().default("draft"),
  pubAt: timestamp("pub_at"),                           // null до publishPost
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  hiddenByAdminAt: timestamp("hidden_by_admin_at"),
  hiddenByAdminId: text("hidden_by_admin_id").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  feedIdx: index("posts_feed_idx").on(t.status, t.pubAt),
  authorIdx: index("posts_author_idx").on(t.authorId),
}));

// tags — 6 generic seed-тэгов (миграция 0002). Admin-UI для добавления — plan-05+.
export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  description: text("description"),
});

// post_tags — m2m posts↔tags. tag_idx добавлен для будущей tag-page (plan-05).
export const postTags = pgTable("post_tags", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.tagId] }),
  tagIdx: index("post_tags_tag_idx").on(t.tagId, t.postId),
}));

// comments — плоские (V1 phase 1). parent_id зарезервирован под threading (канон §6.2,
// spec §2 row 13). В V1 всегда NULL, рендер плоский, миграция в фазу 2 без новых колонок.
// deletedBy: null = живой коммент; иначе userId — определяет плашку:
//   deletedBy === authorId → «удалён автором», иначе → «удалён администратором».
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  contentText: text("content_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by").references(() => users.id),
}, (t) => ({
  postCreatedIdx: index("comments_post_created_idx").on(t.postId, t.createdAt),
  authorCreatedIdx: index("comments_author_created_idx").on(t.authorId, t.createdAt),
}));

// uploads — изображения, нормализованные через /api/upload и положенные в Yandex storage.
export const uploads = pgTable("uploads", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: text("post_id").references(() => posts.id, { onDelete: "set null" }),
  key: text("key").notNull().unique(),
  publicUrl: text("public_url").notNull(),
  mime: varchar("mime", { length: 60 }).notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("uploads_user_idx").on(t.userId, t.createdAt),
  postIdx: index("uploads_post_idx").on(t.postId),
}));
