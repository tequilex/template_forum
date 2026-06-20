import { FeedShell } from "@/components/layout/FeedShell";

export default function AppFeedLayout({ children }: { children: React.ReactNode }) {
  return <FeedShell>{children}</FeedShell>;
}
