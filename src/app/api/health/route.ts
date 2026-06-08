import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkHealth } from "./check";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth(db);
  const status = result.status === "ok" ? 200 : 503;
  return NextResponse.json(result, { status });
}
