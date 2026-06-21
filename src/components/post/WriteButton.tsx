import Link from "next/link";
import type { Route } from "next";
import { PenSquare } from "lucide-react";
import { content } from "@theme/content";

export type WriteButtonVariant = "nav" | "fab" | "cta";

interface Props {
  variant: WriteButtonVariant;
  isAuthed: boolean;
  className?: string;
}

export function WriteButton({ variant, isAuthed, className = "" }: Props) {
  const href = (isAuthed ? "/drafts/new" : "/login?from=/drafts/new") as Route;

  if (variant === "nav") {
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity ${className}`}
      >
        <PenSquare className="h-4 w-4" />
        {content.write.label}
      </Link>
    );
  }

  if (variant === "fab") {
    return (
      <Link
        href={href}
        aria-label={content.write.cta}
        className={`flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity ${className}`}
      >
        <PenSquare className="h-6 w-6" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity ${className}`}
    >
      <PenSquare className="h-4 w-4" />
      {content.write.cta}
    </Link>
  );
}
