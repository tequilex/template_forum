type Tag = { id: string; slug: string; name: string };
type Props = { tags: Tag[] };

// TODO(plan-05): обернуть в <Link href={`/t/${slug}`}> когда появится страница тэга.
export function PostTags({ tags }: Props) {
  if (tags.length === 0) return null;
  return (
    <ul className="max-w-[680px] mx-auto px-4 py-6 flex flex-wrap gap-2">
      {tags.map(t => (
        <li key={t.id} className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
          {t.name}
        </li>
      ))}
    </ul>
  );
}
