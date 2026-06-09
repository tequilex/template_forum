import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { checkHealth } from "./check";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth(getDb());
  const status = result.status === "ok" ? 200 : 503;
  return NextResponse.json(result, { status });
}
