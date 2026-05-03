type SearchFocus = "sales" | "stock" | "expired" | "branch" | "mixed";

export type GeminiSearchPlan = {
  focus: SearchFocus;
  keywords: string[];
  branchHints: string[];
  summary: string;
  confidence: number;
};

export type GeminiDataAnswer = {
  answer: string;
  totalResults: number;
  totalSales: number;
  totalProfit: number;
};

function getGeminiKey() {
  const value = process.env.GEMINI_API_KEY?.trim();
  return value ? value : undefined;
}

function extractJsonObject<T>(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const jsonText = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonText) as Partial<T>;
  } catch {
    return null;
  }
}

function normalizeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function getGeminiModels() {
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  return Array.from(new Set([configuredModel, "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean))) as string[];
}

function normalizeArray(values: unknown, limit: number) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeFocus(value: unknown): SearchFocus {
  if (value === "sales" || value === "stock" || value === "expired" || value === "branch" || value === "mixed") {
    return value;
  }

  return "mixed";
}

async function generateGeminiContent(model: string, apiKey: string, prompt: string) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "Return valid JSON only. Do not wrap the JSON in markdown fences or add extra commentary."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    })
  });
}

export async function inferGeminiSearchPlan(query: string): Promise<GeminiSearchPlan | null> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return null;
  }

  const models = getGeminiModels();
  const prompt = [
    "You are a POS search planner.",
    "Analyze the user's query and return ONLY JSON with this shape:",
    '{ "focus": "sales|stock|expired|branch|mixed", "keywords": ["..."], "branchHints": ["..."], "summary": "...", "confidence": 0.0 }',
    "Rules:",
    "- keywords must be short search phrases that help find matching dashboard records.",
    "- branchHints should contain branch names or codes if the query implies a branch.",
    "- summary should be one concise Indonesian sentence.",
    "- confidence must be between 0 and 1.",
    `Query: ${query}`
  ].join("\n");

  let response: Response | null = null;
  for (const model of models) {
    response = await generateGeminiContent(model, apiKey, prompt);
    if (response.ok) {
      break;
    }
  }

  if (!response?.ok) {
    return null;
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim() ?? "";
  if (!text) {
    return null;
  }

  const parsed = extractJsonObject<GeminiSearchPlan>(text);
  if (!parsed) {
    return null;
  }

  return {
    focus: normalizeFocus(parsed.focus),
    keywords: normalizeArray(parsed.keywords, 8),
    branchHints: normalizeArray(parsed.branchHints, 4),
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "Gemini menafsirkan prompt ini sebagai pencarian data POS.",
    confidence: typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5
  };
}

export async function answerGeminiFromData(query: string, dataSnapshot: unknown): Promise<GeminiDataAnswer | null> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return null;
  }

  const prompt = [
    "Kamu adalah asisten AI untuk keuangan dan stok barang minimarket multi cabang.",
    "Tugasmu adalah membaca snapshot data POS yang diberikan, lalu menjawab pertanyaan user secara natural dalam Bahasa Indonesia.",
    "Gunakan hanya angka dan item dari snapshot data. Jangan mengarang data di luar snapshot.",
    "Kalau user bertanya tentang stok, produk, cabang, expired, penjualan, omzet, laba, piutang, atau performa cabang, jawab dari snapshot.",
    "Kalau pertanyaan umum seperti 'siapa kamu?', jawab sebagai asisten AI minimarket tanpa menampilkan data snapshot.",
    "Kalau user meminta total atau ringkasan, jawab ringkas tanpa daftar item.",
    "Kalau user meminta daftar atau pencarian produk, tampilkan item yang paling relevan saja.",
    "Return ONLY JSON with this shape:",
    '{ "answer": "jawaban natural tanpa heading template", "totalResults": 0, "totalSales": 0, "totalProfit": 0 }',
    `Pertanyaan user: ${query}`,
    `Snapshot data POS JSON: ${JSON.stringify(dataSnapshot)}`
  ].join("\n");

  let response: Response | null = null;
  for (const model of getGeminiModels()) {
    response = await generateGeminiContent(model, apiKey, prompt);
    if (response.ok) {
      break;
    }
  }

  if (!response?.ok) {
    return null;
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim() ?? "";
  if (!text) {
    return null;
  }

  const parsed = extractJsonObject<GeminiDataAnswer>(text);
  const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) {
    return null;
  }

  return {
    answer,
    totalResults: normalizeNumber(parsed?.totalResults),
    totalSales: normalizeNumber(parsed?.totalSales),
    totalProfit: normalizeNumber(parsed?.totalProfit)
  };
}

export function buildFallbackSearchPlan(query: string): GeminiSearchPlan {
  const normalizedQuery = query.toLowerCase();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 8);
  const focus: SearchFocus = /jual|penjualan|transaksi|faktur|omzet|pendapatan|laba|pelanggan/.test(normalizedQuery)
    ? "sales"
    : /stok|stock|barang|produk|item|limit|kosong/.test(normalizedQuery)
      ? "stock"
      : /expire|expired|kadaluarsa|kedaluwarsa|fefo/.test(normalizedQuery)
        ? "expired"
        : /cabang|toko|bintang|pekanbaru|dhamasraya|payakumbuh|tanjung|solok/.test(normalizedQuery)
          ? "branch"
          : "mixed";

  return {
    focus,
    keywords: terms,
    branchHints: terms.filter((term) => /c\d{2}/i.test(term) || /pekanbaru|dhamasraya|payakumbuh|tanjung|solok/i.test(term)),
    summary: "Pencarian lokal fallback dipakai untuk membaca prompt ini.",
    confidence: 0.2
  };
}
