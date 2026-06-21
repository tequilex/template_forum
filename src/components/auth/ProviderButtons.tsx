"use client";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import type { IconType } from "react-icons";
import { SiMaildotru, SiOdnoklassniki, SiVk } from "react-icons/si";
import { FaYandex } from "react-icons/fa6";
import { useAsyncLock } from "@/hooks/use-async-lock";

type CustomButton = { kind: "custom"; label: string; href: string; Icon: IconType; bg: string; fg: string };
type NextAuthButton = { kind: "nextauth"; label: string; providerId: string; Icon: IconType; bg: string; fg: string };
type Button = CustomButton | NextAuthButton;

const NEXTAUTH_EXPANSION: Record<string, NextAuthButton[]> = {
  yandex: [{ kind: "nextauth", label: "Яндекс", providerId: "yandex", Icon: FaYandex, bg: "#FC3F1D", fg: "#FFFFFF" }],
};

const VK_BUTTONS: CustomButton[] = [
  { kind: "custom", label: "ВКонтакте",       href: "/api/oauth/vk/start?provider=vkid",    Icon: SiVk,            bg: "#0077FF", fg: "#FFFFFF" },
  { kind: "custom", label: "Мой Мир@mail.ru",  href: "/api/oauth/vk/start?provider=mail_ru", Icon: SiMaildotru,     bg: "#005FF9", fg: "#FFFFFF" },
  { kind: "custom", label: "Одноклассники",    href: "/api/oauth/vk/start?provider=ok_ru",   Icon: SiOdnoklassniki, bg: "#EE8208", fg: "#FFFFFF" },
];

const ROW_CLASS = "flex w-full items-center justify-between rounded-xl px-5 py-3 text-base font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export function ProviderButtons({
  nextAuthProviders,
  vkEnabled,
}: {
  nextAuthProviders: string[];
  vkEnabled: boolean;
}) {
  const buttons: Button[] = [
    ...nextAuthProviders.flatMap((id) => NEXTAUTH_EXPANSION[id] ?? []),
    ...(vkEnabled ? VK_BUTTONS : []),
  ];
  if (buttons.length === 0) return null;

  // Группа провайдеров с общим lock'ом: первый клик блокирует все, кликнутая
  // показывает spinner. NextAuth signIn = XHR+redirect, VK = navigation — оба
  // не моментальные, без feedback'а юзер успевает кликнуть второй раз.
  const lock = useAsyncLock<string>();

  return (
    <div className="flex flex-col gap-3">
      {buttons.map((b, i) => {
        const id = b.kind === "nextauth" ? `na-${b.providerId}` : `vk-${i}`;
        const isPending = lock.isPending(id);
        const Icon = isPending ? Loader2 : b.Icon;
        const iconCls = `h-6 w-6 shrink-0${isPending ? " animate-spin" : ""}`;
        const dim = lock.isLocked && !isPending ? " opacity-50" : "";

        if (b.kind === "custom") {
          return (
            <a
              key={id}
              href={b.href}
              onClick={(e) => {
                if (lock.isLocked) { e.preventDefault(); return; }
                lock.lock(id);
              }}
              aria-disabled={lock.isLocked || undefined}
              style={{ backgroundColor: b.bg, color: b.fg }}
              className={`${ROW_CLASS}${dim}${lock.isLocked ? " cursor-not-allowed" : ""}`}
            >
              <span>{b.label}</span>
              <Icon className={iconCls} aria-hidden="true" />
            </a>
          );
        }
        return (
          <button
            key={id}
            type="button"
            disabled={lock.isLocked}
            onClick={() => { lock.lock(id); signIn(b.providerId, { callbackUrl: "/" }); }}
            style={{ backgroundColor: b.bg, color: b.fg }}
            className={`${ROW_CLASS}${dim} disabled:cursor-not-allowed`}
          >
            <span>{b.label}</span>
            <Icon className={iconCls} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
