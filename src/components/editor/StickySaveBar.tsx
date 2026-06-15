"use client";

import { SaveIndicator } from "./SaveIndicator";

type Props = {
  saveState: "idle" | "saving" | "saved" | "error";
  savedAt?: Date;
  primaryAction: React.ReactNode;
};

export function StickySaveBar({ saveState, savedAt, primaryAction }: Props) {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
      <SaveIndicator state={saveState} at={savedAt} />
      {primaryAction}
    </div>
  );
}
