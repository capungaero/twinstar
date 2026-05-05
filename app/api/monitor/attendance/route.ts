import { NextResponse } from "next/server";
import { supabaseInsert, supabaseSelect } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AttendanceEntry = {
  name: string;
  phone: string;
  status: "hadir" | "absen" | "izin" | "sakit" | "terlambat";
  note: string;
  time?: string;
};

export type AttendanceReport = {
  id?: number;
  analyzed_at: string;
  date_label: string;
  total_messages: number;
  summary: string;
  hadir: number;
  absen: number;
  izin: number;
  sakit: number;
  terlambat: number;
  entries: AttendanceEntry[];
};

function getGeminiKey() {
  return process.env.GEMINI_API_KEY?.trim() || "";
}

function getGeminiModels() {
  const cfg = process.env.GEMINI_MODEL?.trim();
  return Array.from(new Set([cfg, "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean))) as string[];
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = getGeminiKey();
  if (!apiKey) return null;

  for (const model of getGeminiModels()) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: "Return valid JSON only. Do not wrap in markdown fences." }]
            },
            contents: [{ role: "user", parts: [{ text: prompt }] }]
          })
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ ok: false, error: "messages array required" }, { status: 400 });
  }

  const messages: Array<{ id: string; sender: string; senderName?: string; text: string; timestamp: string }> = body.messages;
  const dateLabel: string = body.dateLabel || new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });

  // Format pesan untuk prompt
  const pesanText = messages
    .map((m, i) => {
      const waktu = new Date(m.timestamp).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
      const nama = m.senderName || m.sender;
      return `${i + 1}. [${waktu}] ${nama} (${m.sender}): "${m.text}"`;
    })
    .join("\n");

  const prompt = `Kamu adalah asisten HR. Analisa pesan-pesan WhatsApp/Telegram berikut dan identifikasi laporan kehadiran karyawan.

Tanggal: ${dateLabel}
Pesan masuk:
${pesanText}

Tugas:
1. Baca setiap pesan dan tentukan apakah berisi laporan absensi (hadir, absen, izin, sakit, atau terlambat)
2. Abaikan pesan yang tidak berkaitan dengan absensi
3. Jika seseorang melaporkan terlambat, statusnya "terlambat" bukan "hadir"
4. Jika seseorang melaporkan sakit, statusnya "sakit" bukan "absen"
5. Jika seseorang minta izin tidak masuk, statusnya "izin"

Kembalikan JSON dengan format:
{
  "summary": "Ringkasan singkat dalam 1-2 kalimat dalam Bahasa Indonesia",
  "entries": [
    {
      "name": "nama pengirim",
      "phone": "nomor hp",
      "status": "hadir|absen|izin|sakit|terlambat",
      "note": "catatan singkat dari isi pesan",
      "time": "jam laporan jika disebutkan, kosong jika tidak ada"
    }
  ]
}

Hanya sertakan orang yang pesannya jelas berkaitan dengan absensi.`;

  const rawResponse = await callGemini(prompt);
  if (!rawResponse) {
    return NextResponse.json({ ok: false, error: "Gemini API tidak merespons" }, { status: 503 });
  }

  const parsed = extractJson(rawResponse);
  if (!parsed || !Array.isArray(parsed.entries)) {
    return NextResponse.json({ ok: false, error: "Gagal parse respons Gemini", raw: rawResponse }, { status: 500 });
  }

  const entries: AttendanceEntry[] = (parsed.entries as AttendanceEntry[]).filter(
    (e) => e.name && ["hadir", "absen", "izin", "sakit", "terlambat"].includes(e.status)
  );

  const count = (status: string) => entries.filter((e) => e.status === status).length;

  const report: AttendanceReport = {
    analyzed_at: new Date().toISOString(),
    date_label: dateLabel,
    total_messages: messages.length,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    hadir: count("hadir"),
    absen: count("absen"),
    izin: count("izin"),
    sakit: count("sakit"),
    terlambat: count("terlambat"),
    entries
  };

  // Simpan ke Supabase
  try {
    await supabaseInsert("attendance_reports", {
      ...report,
      source_message_ids: messages.map((m) => m.id),
      entries: entries,
      raw_prompt: prompt,
      raw_response: rawResponse
    });
  } catch (err) {
    console.error("Failed to save attendance report:", err);
  }

  return NextResponse.json({ ok: true, report });
}

export async function GET() {
  const rows = await supabaseSelect<AttendanceReport>("attendance_reports", {
    order: "analyzed_at.desc",
    limit: "20"
  });
  return NextResponse.json({ ok: true, reports: rows });
}
