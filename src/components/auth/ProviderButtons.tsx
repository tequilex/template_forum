"use client";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const LABELS: Record<string, string> = {
  google: "Google",
  yandex: "Яндекс",
  vk: "VK",
  github: "GitHub",
};

export function ProviderButtons({ providers }: { providers: { id: string }[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {providers.map(p => (
        <Button
          key={p.id}
          variant="outline"
          className="w-full"
          onClick={() => signIn(p.id, { callbackUrl: "/" })}
        >
          {LABELS[p.id] ?? p.id}
        </Button>
      ))}
    </div>
  );
}
