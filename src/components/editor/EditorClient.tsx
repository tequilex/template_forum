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

  // Refs хранят актуальные значения для автосейва — закрывают проблему
  // stale-замыкания (debounce-таймер и in-flight save видят свежие данные).
  const titleRef = useRef(props.initialTitle);
  const postIdRef = useRef(props.initialPostId);
  const tagIdsRef = useRef<string[]>(props.initialTagIds);
  // Сериализация saves: пока inFlight, новые scheduleSave только взводят pending.
  // Это убирает гонку, при которой два параллельных saveDraft(null, ...) создают
  // два разных черновика на одну сессию редактирования.
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;
    // Локальная переменная нужна, чтобы корректно teardown'ить инстанс, даже
    // если cleanup сработал до того, как `editor.isReady` зарезолвился
    // (актуально в dev-StrictMode с двойным запуском эффектов).
    let editorInstance: any = null;

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

      editorInstance = new EditorJS({
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

      // Методы вроде .save() доступны только после isReady. До этого момента
      // не выставляем editorRef.current — flushSave увидит null и выйдет рано.
      try {
        await editorInstance.isReady;
      } catch (e) {
        console.error("[editor.isReady]", e);
        return;
      }

      if (disposed) {
        editorInstance.destroy?.();
        return;
      }

      editorRef.current = editorInstance;
    })();

    return () => {
      disposed = true;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      // Уничтожаем тот инстанс, что был создан в этом эффекте, не глобальный ref.
      editorInstance?.destroy?.();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(flushSave, DEBOUNCE_MS);
  };

  const flushSave = async () => {
    if (!editorRef.current) return;
    // Если save уже в полёте — взводим pending, чтобы выполнить ещё один save
    // после возврата (с уже актуальным postIdRef для апдейта того же поста).
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      const content = await editorRef.current.save();
      setSaveState({ state: "saving" });
      const out = await saveDraft(postIdRef.current, titleRef.current, content, tagIdsRef.current);
      // Первый save для /new — обновляем ref сразу (до setState), чтобы
      // следующий save (если pending) увидел уже созданный postId.
      // URL меняем в пределах того же route-сегмента (/new?id={id}), а не на
      // /edit/{id}. Иначе App Router после server action рефрешит RSC по
      // новому сегменту, пересоздаёт инстанс редактора и теряет ввод.
      // С query-параметром сегмент тот же → новые пропсы летят в EditorClient,
      // но useEffect([]) не перезапускается, editor instance живёт.
      if (postIdRef.current === null && out.postId) {
        postIdRef.current = out.postId;
        setPostId(out.postId);
        window.history.replaceState({}, "", `/new?id=${out.postId}`);
      }
      setSaveState({ state: "saved", at: new Date(out.updatedAt) });
    } catch (e) {
      setSaveState({ state: "error" });
      console.error("[saveDraft]", e);
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        flushSave();
      }
    }
  };

  const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Обновляем ref сразу — иначе flushSave прочитает старое значение,
    // потому что setTitle асинхронен и замыкание debounce-таймера успело бы
    // захватить устаревший title.
    titleRef.current = e.target.value;
    setTitle(e.target.value);
    scheduleSave();
  };

  const onTagsChange = (next: string[]) => {
    // Та же синхронная синхронизация, что и для title: ref → state → debounce.
    tagIdsRef.current = next;
    setSelectedTagIds(next);
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

  const onArchive = async () => { if (postId) { await archivePost(postId); router.push("/drafts?tab=archived" as never); } };
  const onDelete = async  () => { if (postId) { await softDeletePost(postId); router.push("/drafts"); } };

  // useTransition: pending до завершения server-action + router.push/refresh.
  // Один transition на все 3 primary-кнопки — они взаимоисключающие по статусу.
  const [isPrimaryPending, startPrimary] = useTransition();
  const primaryButton = (() => {
    if (props.status === "draft") {
      return <Button pending={isPrimaryPending} onClick={() => startPrimary(() => onPublish())}>Опубликовать</Button>;
    }
    if (props.status === "published") {
      return <Button pending={isPrimaryPending} onClick={() => startPrimary(() => onRepublish())}>Сохранить изменения</Button>;
    }
    if (props.status === "archived") {
      return <Button pending={isPrimaryPending} onClick={() => startPrimary(() => onUnarchive())} variant="outline">Разархивировать</Button>;
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
        onChange={onTagsChange}
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
