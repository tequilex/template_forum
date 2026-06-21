"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { adminBanUser } from "@/server/actions/moderation";
import { content } from "@theme/content";

interface Props {
  trigger: React.ReactNode;
  userId: string;
}

export function BanUserDialog({ trigger, userId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await adminBanUser(userId, reason);
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(null); setReason(""); } }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(90vw,480px)] rounded-md bg-background border border-border p-6 shadow-lg">
          <Dialog.Title className="font-display text-lg mb-2">
            {content.moderation.banUser}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {content.moderation.banReasonLabel}
          </Dialog.Description>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="text-sm">
              <span className="block mb-1">{content.moderation.banReasonLabel}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={content.moderation.banReasonPlaceholder}
                className="w-full min-h-[80px] p-2 rounded-md border border-border bg-background text-sm"
                required
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {content.comments.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" pending={busy} variant="destructive">
                {content.moderation.banSubmit}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
