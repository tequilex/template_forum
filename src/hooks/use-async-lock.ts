"use client";
import { useState } from "react";

// Для групп кнопок с общим lock'ом: один клик блокирует все, кликнутая показывает
// pending, остальные — dimmed. Типичный сценарий — OAuth-провайдеры на /login
// (NextAuth signIn / VK redirect: пауза до навигации, второй клик нежелателен).
//
// Для одиночных кнопок этот хук не нужен — используй React `useTransition` +
// <Button pending={isPending}>...</Button>.
export function useAsyncLock<Id extends string = string>() {
  const [pendingId, setPendingId] = useState<Id | null>(null);
  return {
    pendingId,
    isLocked: pendingId !== null,
    isPending: (id: Id) => pendingId === id,
    lock: (id: Id) => setPendingId(id),
    reset: () => setPendingId(null),
  };
}
