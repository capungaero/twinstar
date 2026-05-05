import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simpan last 20 payload mentah di memory (hilang saat restart, cukup untuk debug)
const debugLog: Array<{ receivedAt: string; headers: Record<string, string>; body: unknown }> = [];

export async function GET() {
  return NextResponse.json({
    ok: true,
    count: debugLog.length,
    entries: debugLog.slice(-20).reverse()
  });
}

export async function POST(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const body = await request.json().catch(() => null);

  debugLog.push({
    receivedAt: new Date().toISOString(),
    headers,
    body
  });

  if (debugLog.length > 20) {
    debugLog.splice(0, debugLog.length - 20);
  }

  return NextResponse.json({ ok: true, received: true });
}
