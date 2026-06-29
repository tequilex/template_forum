import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { detectMime } from "@/lib/images/validate";
import { normalizeToWebp, type NormalizedImage } from "@/lib/images/normalize";
import { buildKey, buildPublicUrl, putObject } from "@/lib/storage/upload";
import { newId } from "@/lib/auth/id";
import { uploads } from "@db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

function errJson(status: number, error: string) {
  return NextResponse.json({ success: 0, error }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  if (!env.STORAGE_ENDPOINT) return errJson(503, "storage_not_configured");

  const session = await auth();
  if (!session?.user?.id) return errJson(401, "unauthorized");

  const cl = Number(req.headers.get("content-length") ?? 0);
  if (cl > MAX_BYTES) return errJson(413, "too_large");

  let form: FormData;
  try { form = await req.formData(); }
  catch { return errJson(400, "bad_form"); }

  const file = form.get("image");
  if (!(file instanceof Blob)) return errJson(400, "no_image");
  if (file.size > MAX_BYTES) return errJson(413, "too_large");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = await detectMime(buf);
  if (!mime) return errJson(415, "bad_mime");

  let normalized: NormalizedImage;
  try { normalized = await normalizeToWebp(buf); }
  catch (e) {
    console.error("[upload] sharp failed:", e);
    return errJson(500, "normalize_failed");
  }

  const id = newId();
  const key = buildKey(session.user.id, id);
  const publicUrl = buildPublicUrl(key);

  try {
    await putObject({ key, body: normalized.buffer, contentType: "image/webp" });
  } catch (e) {
    console.error("[upload] r2 put failed:", e);
    return errJson(500, "r2_failed");
  }

  try {
    await getDb().insert(uploads).values({
      id,
      userId: session.user.id,
      postId: null,
      key,
      publicUrl,
      mime: "image/webp",
      size: normalized.size,
      width: normalized.width,
      height: normalized.height,
    });
  } catch (e) {
    console.error("[upload] db insert failed:", e);
    return errJson(500, "db_failed");
  }

  return NextResponse.json({
    success: 1,
    file: { url: publicUrl, width: normalized.width, height: normalized.height },
    uploadId: id,
  });
}
