CREATE TYPE "public"."post_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_tags" (
	"post_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(200) NOT NULL,
	"excerpt" varchar(280),
	"content" jsonb NOT NULL,
	"content_html" text,
	"cover_url" text,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"pub_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(40) NOT NULL,
	"name" varchar(60) NOT NULL,
	"description" text,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_tags_tag_idx" ON "post_tags" USING btree ("tag_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_feed_idx" ON "posts" USING btree ("status","pub_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uploads" ADD CONSTRAINT "uploads_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Seed tags (plan-04 §8.3 требует ≥1 тэг на публикации).
-- Niche fork: замени эти строки в своей миграции перед первым деплоем.
-- Opaque seed identifiers (не генерятся через newId(), форма Crockford-base32 намеренно не валидируется);
-- стабильны между окружениями by design — внешние ссылки всё равно идут через slug.
INSERT INTO tags (id, slug, name, description) VALUES
  ('01J0SEED000000000000TAGEXP', 'experience',  'Опыт',      'Личный опыт автора'),
  ('01J0SEED000000000000TAGQST', 'question',    'Вопрос',    'Вопросы сообществу'),
  ('01J0SEED000000000000TAGNWS', 'news',        'Новости',   'Новости и анонсы'),
  ('01J0SEED000000000000TAGRVW', 'review',      'Обзор',     'Обзор продукта / события'),
  ('01J0SEED000000000000TAGOPN', 'opinion',     'Мнение',    'Колонка-мнение'),
  ('01J0SEED000000000000TAGLFH', 'lifehack',    'Лайфхаки',  'Практические советы')
ON CONFLICT (slug) DO NOTHING;
