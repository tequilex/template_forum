// TODO(plan-04): удалить этот dev-роут — он нужен только чтобы вручную
// проверить /api/upload до того, как появится Editor.js image-tool.

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UploadTestForm } from "./form";

export const dynamic = "force-dynamic";

export default async function UploadTestPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="container mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl mb-2">Upload test (plan-03)</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Одноразовая dev-страница для проверки <code>/api/upload</code>.
        Удалю в plan-04, когда подключу Editor.js.
      </p>
      <UploadTestForm />
    </main>
  );
}
