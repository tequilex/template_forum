"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Тонкий клиентский wrapper: useFormStatus можно вызывать только внутри потомка
// <form>, поэтому отделяем submit-кнопку от server-component'а WelcomePage.
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" pending={pending}>{children}</Button>;
}
