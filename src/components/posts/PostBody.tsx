type Props = { html: string };

// dangerouslySetInnerHTML — содержимое уже прошло sanitize-html на сервере
// (publishPost/republishPost). На клиенте не санитайзим — это стоило бы bundle-size.
export function PostBody({ html }: Props) {
  return (
    <div
      className="prose prose-neutral dark:prose-invert max-w-[680px] mx-auto px-4 py-8"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
