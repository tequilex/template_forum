"use client";
import { signIn } from "next-auth/react";
import type { IconType } from "react-icons";
import { SiVk, SiOdnoklassniki, SiGoogle, SiGithub, SiMaildotru } from "react-icons/si";
import { FaYandex } from "react-icons/fa6";

// VK ID — единый шлюз для VK / Mail.ru / Одноклассники: общий next-auth provider "vk",
// один callback, одна запись в accounts; разный ?provider=<...> на id.vk.com/authorize
// просто открывает соответствующий экран входа.
type UiButton = {
  label: string;
  providerId: string;
  Icon: IconType;
  bg: string;
  fg: string;
  authParams?: Record<string, string>;
};

const EXPANSION: Record<string, UiButton[]> = {
  vk: [
    { label: "ВКонтакте",            providerId: "vk", Icon: SiVk,            bg: "#0077FF", fg: "#FFFFFF" },
    { label: "Мой Мир@mail.ru",       providerId: "vk", Icon: SiMaildotru,     bg: "#005FF9", fg: "#FFFFFF",
      authParams: { provider: "mail_ru" } },
    { label: "Одноклассники", providerId: "vk", Icon: SiOdnoklassniki, bg: "#EE8208", fg: "#FFFFFF",
      authParams: { provider: "ok_ru" } },
  ],
  yandex: [{ label: "Яндекс", providerId: "yandex", Icon: FaYandex, bg: "#FC3F1D", fg: "#FFFFFF" }],
  google: [{ label: "Google", providerId: "google", Icon: SiGoogle, bg: "#000000", fg: "#FFFFFF" }],
  github: [{ label: "GitHub", providerId: "github", Icon: SiGithub, bg: "#24292E", fg: "#FFFFFF" }],
};

export function ProviderButtons({ providers }: { providers: { id: string }[] }) {
  if (providers.length === 0) return null;
  const buttons = providers.flatMap(p => EXPANSION[p.id] ?? []);
  return (
    <div className="flex flex-col gap-3">
      {buttons.map((b, i) => (
        <button
          key={`${b.providerId}-${b.authParams?.provider ?? "_"}-${i}`}
          type="button"
          onClick={() => signIn(b.providerId, { callbackUrl: "/" }, b.authParams)}
          style={{ backgroundColor: b.bg, color: b.fg }}
          className="flex w-full items-center justify-between rounded-xl px-5 py-3 text-base font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <span>{b.label}</span>
          <b.Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
