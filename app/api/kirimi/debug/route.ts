import { NextResponse } from "next/server";
import { supabaseInsert, supabaseSelect } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await supabaseSelect("kirimi_debug_log", { limit: "20" });
    return NextResponse.json({ ok: true, count: rows.length, entries: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "kirimi_debug_log table not yet created" });
  }
}

export async function POST(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const body = await request.json().catch(() => null);

  console.log("[kirimi-debug] RAW PAYLOAD:", JSON.stringify(body, null, 2));

  try {
    await supabaseInsert("kirimi_debug_log", {
      received_at: new Date().toISOString(),
      headers: headers,
      body: body
    });
  } catch (err) {
    console.error("[kirimi-debug] Failed to save:", err);
  }

  return NextResponse.json({ ok: true, received: true });
}
