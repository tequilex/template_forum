"use client";

import { cn } from "@/lib/utils";

type Tag = { id: string; slug: string; name: string };
type Props = {
  availableTags: Tag[];
  value: string[];
  onChange: (ids: string[]) => void;
  readonly?: boolean;
};

export function TagPicker({ availableTags, value, onChange, readonly = false }: Props) {
  const toggle = (id: string) => {
    if (readonly) return;
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  return (
    <>
      {/* Mobile: collapsible details */}
      <details className="md:hidden border border-border rounded-md p-3 mb-3" open={value.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">
          Тэги {value.length > 0 && <span className="text-muted-foreground">({value.length})</span>}
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          {availableTags.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.includes(t.id)}
                onChange={() => toggle(t.id)}
                disabled={readonly}
              />
              {t.name}
            </label>
          ))}
        </div>
      </details>

      {/* Desktop: chips */}
      <div className="hidden md:flex flex-wrap gap-2 mb-3">
        {availableTags.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            disabled={readonly}
            className={cn(
              "rounded-full px-3 py-1 text-sm border transition",
              value.includes(t.id)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-accent",
              readonly && "opacity-60 cursor-not-allowed",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
    </>
  );
}
