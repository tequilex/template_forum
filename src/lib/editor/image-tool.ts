import ImageTool from "@editorjs/image";

// Config-фабрика для Editor.js image-tool.
// Plan-04 (Posts + Editor) кладёт результат в new EditorJS({ tools: { image: buildImageToolConfig() } }).
// Контракт ответа /api/upload — { success: 1, file: { url, width, height } } — совпадает с
// тем, что @editorjs/image >=2.10 ожидает по default'у. Если в plan-04 окажется, что свежая
// версия требует другую форму, корректируем формат ответа в src/app/api/upload/route.ts.
export function buildImageToolConfig(): {
  class: typeof ImageTool;
  config: { endpoints: { byFile: string } };
} {
  return {
    class: ImageTool,
    config: { endpoints: { byFile: "/api/upload" } },
  };
}
