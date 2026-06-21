"use client";

import { useState, useId } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

type Props = {
  trigger: React.ReactNode;
  title: string;
  description: string;
  typedConfirm?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  trigger, title, description, typedConfirm, confirmLabel, destructive, onConfirm,
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const canConfirm = typedConfirm ? input === typedConfirm : true;

  const handle = async () => {
    setBusy(true);
    try { await onConfirm(); setOpen(false); setInput(""); }
    finally { setBusy(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setInput(""); }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(90vw,420px)] rounded-md bg-background border border-border p-6 shadow-lg">
          <Dialog.Title className="font-display text-lg mb-2">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground mb-4">
            {description}
          </Dialog.Description>
          {typedConfirm && (
            <div className="mb-4">
              <label htmlFor={inputId} className="block text-xs text-muted-foreground mb-1">
                Введи <code>{typedConfirm}</code> для подтверждения
              </label>
              <input
                id={inputId}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" type="button">Отмена</Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              disabled={!canConfirm}
              pending={busy}
              onClick={handle}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
