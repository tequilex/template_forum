import { FeedShell } from "@/components/layout/FeedShell";

export default function PublicFeedLayout({ children }: { children: React.ReactNode }) {
  return <FeedShell>{children}</FeedShell>;
}
