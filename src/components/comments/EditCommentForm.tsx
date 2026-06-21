"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateComment } from "@/server/actions/comments";
import { content } from "@theme/content";

const MAX = 2000;

interface Props {
  commentId: string;
  initialText: string;
  onCancel: () => void;
}

export function EditCommentForm({ commentId, initialText, onCancel }: Props) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateComment(commentId, text);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
      onCancel();
    });
  };

  const overLimit = text.length > MAX;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 my-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full min-h-[80px] p-3 rounded-md border border-border bg-background text-sm resize-y"
        disabled={isPending}
        required
      />
      <div className="flex gap-2 items-center justify-end">
        <span className={`text-xs mr-auto ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {content.comments.charCount(text.length)}
        </span>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {content.comments.cancel}
        </Button>
        <Button type="submit" pending={isPending} disabled={overLimit || text.trim().length === 0}>
          {content.comments.save}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
