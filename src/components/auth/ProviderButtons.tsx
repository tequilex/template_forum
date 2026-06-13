"use client";
import { signIn } from "next-auth/react";
import type { IconType } from "react-icons";
import { SiMaildotru, SiOdnoklassniki, SiVk } from "react-icons/si";
import { FaYandex } from "react-icons/fa6";

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

  return (
    <div className="flex flex-col gap-3">
      {buttons.map((b, i) => {
        if (b.kind === "custom") {
          return (
            <a
              key={`vk-${i}`}
              href={b.href}
              style={{ backgroundColor: b.bg, color: b.fg }}
              className={ROW_CLASS}
            >
              <span>{b.label}</span>
              <b.Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
            </a>
          );
        }
        return (
          <button
            key={`na-${b.providerId}-${i}`}
            type="button"
            onClick={() => signIn(b.providerId, { callbackUrl: "/" })}
            style={{ backgroundColor: b.bg, color: b.fg }}
            className={ROW_CLASS}
          >
            <span>{b.label}</span>
            <b.Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
