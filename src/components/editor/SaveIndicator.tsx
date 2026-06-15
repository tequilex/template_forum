"use client";

type State = "idle" | "saving" | "saved" | "error";
type Props = { state: State; at?: Date };

export function SaveIndicator({ state, at }: Props) {
  if (state === "idle") return <span className="text-xs text-muted-foreground">—</span>;
  if (state === "saving") return <span className="text-xs text-muted-foreground">Сохранение…</span>;
  if (state === "saved" && at) {
    const time = at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return <span className="text-xs text-muted-foreground">Сохранено {time}</span>;
  }
  if (state === "error") return <span className="text-xs text-destructive">Ошибка сохранения</span>;
  return null;
}
