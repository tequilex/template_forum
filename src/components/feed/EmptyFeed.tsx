interface EmptyFeedProps {
  message: string;
}

export function EmptyFeed({ message }: EmptyFeedProps) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}
