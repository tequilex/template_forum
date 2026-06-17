"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TagPicker } from "@/components/ui/TagPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SaveIndicator } from "./SaveIndicator";
import {
  saveDraft, publishPost, republishPost,
  archivePost, unarchivePost, softDeletePost,
} from "@/server/posts";
import "./editor.css";

type Tag = { id: string; slug: string; name: string };
type Status = "draft" | "published" | "archived";

type Props = {
  initialPostId: string | null;
  initialTitle: string;
  initialContent: any;
  initialTagIds: string[];
  status: Status;
  availableTags: Tag[];
};

const DEBOUNCE_MS = 2000;

export function EditorClient(props: Props) {
  const router = useRouter();
  const editorRef = useRef<any>(null);
  const holderId = "editorjs-holder";
  const [postId, setPostId] = useState<string | null>(props.initialPostId);
  const [title, setTitle] = useState(props.initialTitle);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(props.initialTagIds);
  const [saveState, setSaveState] = useState<{ state: "idle" | "saving" | "saved" | "error"; at?: Date }>({
    state: "idle",
  });
  const [, startTransition] = useTransition();
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const [EditorJS, Header, List, Quote, Delimiter, { buildImageToolConfig }] = await Promise.all([
        import("@editorjs/editorjs").then(m => m.default),
        import("@editorjs/header").then(m => m.default),
        import("@editorjs/list").then(m => m.default),
        import("@editorjs/quote").then(m => m.default),
        import("@editorjs/delimiter").then(m => m.default),
        import("@/lib/editor/image-tool"),
      ]);

      if (disposed) return;

      editorRef.current = new EditorJS({
        holder: holderId,
        data: props.initialContent,
        tools: {
          header: { class: Header as any, config: { levels: [2, 3, 4], defaultLevel: 2 } },
          list: { class: List as any, inlineToolbar: true },
          quote: { class: Quote as any, inlineToolbar: true },
          delimiter: Delimiter as any,
          image: buildImageToolConfig() as any,
        },
        onChange: scheduleSave,
        placeholder: "Начни писать…",
      });
    })();

    return () => {
      disposed = true;
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        flushSave();
      }
      editorRef.current?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(flushSave, DEBOUNCE_MS);
  };

  const flushSave = async () => {
    if (!editorRef.current) return;
    try {
      const content = await editorRef.current.save();
      setSaveState({ state: "saving" });
      startTransition(async () => {
        try {
          const out = await saveDraft(postId, title, content);
          if (out.postId !== postId && postId === null) {
            setPostId(out.postId);
            window.history.replaceState({}, "", `/edit/${out.postId}`);
          }
          setSaveState({ state: "saved", at: new Date(out.updatedAt) });
        } catch (e) {
          setSaveState({ state: "error" });
          console.error("[saveDraft]", e);
        }
      });
    } catch (e) {
      console.error("[editor.save]", e);
    }
  };

  const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleSave();
  };

  const onPublish = async () => {
    if (pendingTimer.current) { clearTimeout(pendingTimer.current); await flushSave(); }
    const id = postId;
    if (!id) { alert("Подожди — пост ещё сохраняется."); return; }
    if (selectedTagIds.length === 0) { alert("Выбери минимум 1 тэг."); return; }
    if (title.trim().length === 0) { alert("Заголовок не может быть пустым."); return; }
    try {
      const out = await publishPost(id, selectedTagIds);
      router.push(`/p/${out.slug}` as never);
    } catch (e: any) {
      alert(`Ошибка публикации: ${e?.message ?? e}`);
    }
  };

  const onRepublish = async () => {
    if (pendingTimer.current) { clearTimeout(pendingTimer.current); await flushSave(); }
    if (!postId) return;
    try {
      await republishPost(postId);
      setSaveState({ state: "saved", at: new Date() });
    } catch (e: any) {
      alert(`Ошибка: ${e?.message ?? e}`);
    }
  };

  const onUnarchive = async () => {
    if (!postId) return;
    await unarchivePost(postId);
    router.refresh();
  };

  const onArchive = async () => { if (postId) { await archivePost(postId); router.push({ pathname: "/drafts", query: { tab: "archived" } } as never); } };
  const onDelete = async  () => { if (postId) { await softDeletePost(postId); router.push("/drafts"); } };

  const primaryButton = (() => {
    if (props.status === "draft") {
      return <Button onClick={onPublish}>Опубликовать</Button>;
    }
    if (props.status === "published") {
      return <Button onClick={onRepublish}>Сохранить изменения</Button>;
    }
    if (props.status === "archived") {
      return <Button onClick={onUnarchive} variant="outline">Разархивировать</Button>;
    }
    return null;
  })();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 pb-12">
      <input
        type="text"
        value={title}
        onChange={onTitleChange}
        placeholder="Заголовок"
        className="w-full font-display text-2xl md:text-4xl bg-transparent border-b border-border focus:outline-none focus:border-foreground py-3 mb-6"
      />

      <TagPicker
        availableTags={props.availableTags}
        value={selectedTagIds}
        onChange={setSelectedTagIds}
        readonly={props.status !== "draft"}
      />

      <div id={holderId} className="codex-editor min-h-[400px]" />

      {/* Action-bar — одинаков на мобиле и десктопе. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-4 border-t border-border">
        <SaveIndicator state={saveState.state} at={saveState.at} />
        <div className="flex flex-wrap gap-2">
          {props.status === "published" && postId && (
            <ConfirmDialog
              trigger={<Button variant="outline">Архивировать</Button>}
              title="Архивировать пост?"
              description="Пост станет скрыт от других читателей, но останется в твоём архиве."
              confirmLabel="Архивировать"
              onConfirm={onArchive}
            />
          )}
          {postId && (
            <ConfirmDialog
              trigger={<Button variant="destructive">Удалить</Button>}
              title="Удалить пост?"
              description="Восстановление возможно только через админа. Введи «удалить» для подтверждения."
              typedConfirm="удалить"
              destructive
              confirmLabel="Удалить навсегда"
              onConfirm={onDelete}
            />
          )}
          {primaryButton}
        </div>
      </div>
    </main>
  );
}
