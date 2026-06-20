import { PostCard, type PostCardData } from "./PostCard";
import { Paginator } from "./Paginator";
import { EmptyFeed } from "./EmptyFeed";

interface PostListProps {
  items: PostCardData[];
  basePath: string;
  currentPage: number;
  totalPages: number;
  emptyMessage: string;
}

export function PostList({
  items,
  basePath,
  currentPage,
  totalPages,
  emptyMessage,
}: PostListProps) {
  if (items.length === 0) {
    return <EmptyFeed message={emptyMessage} />;
  }
  return (
    <>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <PostCard key={item.post.id} {...item} />
        ))}
      </div>
      <Paginator basePath={basePath} currentPage={currentPage} totalPages={totalPages} />
    </>
  );
}
