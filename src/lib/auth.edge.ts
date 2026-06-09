import NextAuth from "next-auth";
import { buildEdgeConfig } from "@/lib/auth/config.edge";

// NB: eager-форма (config-объект, а не функция). lazy-форма `NextAuth(fn)` ломает
// middleware-wrapper `auth((req) => {...})`: коллбэк-ветка завёрнута во внешний async,
// и `auth(handler)` возвращает Promise<fn>, а Next dev-runtime ждёт функцию.
export const { auth } = NextAuth(buildEdgeConfig());
