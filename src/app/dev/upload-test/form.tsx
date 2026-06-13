"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Ok = { success: 1; file: { url: string; width: number; height: number }; uploadId: string };
type Err = { success: 0; error: string };
type Result = Ok | Err;

export function UploadTestForm() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);
    setHttpStatus(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      setHttpStatus(res.status);
      const body = (await res.json()) as Result;
      setResult(body);
    } catch (err) {
      setResult({ success: 0, error: `network: ${String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button type="submit" disabled={!file || busy}>
          {busy ? "Загружаю…" : "Загрузить"}
        </Button>
      </form>

      {result && (
        <div className="rounded-md border border-border p-4 text-sm">
          <p className="mb-2">
            HTTP <code>{httpStatus}</code>
          </p>
          {result.success === 1 ? (
            <div className="flex flex-col gap-3">
              <p>
                <span className="text-muted-foreground">uploadId:</span>{" "}
                <code>{result.uploadId}</code>
              </p>
              <p>
                <span className="text-muted-foreground">url:</span>{" "}
                <a
                  href={result.file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline break-all"
                >
                  {result.file.url}
                </a>
              </p>
              <p>
                <span className="text-muted-foreground">{result.file.width}×{result.file.height}</span>
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.file.url}
                alt="uploaded"
                className="max-w-full rounded-md border border-border"
              />
            </div>
          ) : (
            <p className="text-destructive">
              error: <code>{result.error}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
