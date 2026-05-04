type SearchFocus = "sales" | "stock" | "expired" | "branch" | "mixed";
type SearchMode = "direct" | "reasoning";

export type GeminiSearchPlan = {
  focus: SearchFocus;
  mode: SearchMode;
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
  resultKeys: {
    sales: string[];
    stock: string[];
    expired: string[];
    branches: string[];
  };
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

function getGeminiTimeoutMs() {
  const configuredTimeout = Number(process.env.GEMINI_TIMEOUT_MS ?? 8000);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 8000;
}

function normalizeArray(values: unknown, limit: number) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeResultKeys(value: unknown): GeminiDataAnswer["resultKeys"] {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    sales: normalizeArray(source.sales, 24),
    stock: normalizeArray(source.stock, 24),
    expired: normalizeArray(source.expired, 16),
    branches: normalizeArray(source.branches, 16)
  };
}

function normalizeFocus(value: unknown): SearchFocus {
  if (value === "sales" || value === "stock" || value === "expired" || value === "branch" || value === "mixed") {
    return value;
  }

  return "mixed";
}

function normalizeMode(value: unknown): SearchMode {
  return value === "reasoning" ? "reasoning" : "direct";
}

async function generateGeminiContent(model: string, apiKey: string, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getGeminiTimeoutMs());

  try {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
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
    '{ "focus": "sales|stock|expired|branch|mixed", "mode": "direct|reasoning", "keywords": ["..."], "branchHints": ["..."], "summary": "...", "confidence": 0.0 }',
    "Rules:",
    "- mode direct means the query clearly asks for existing records or simple totals, for example: data penjualan payakumbuh, stok betadine, total penjualan cabang 10.",
    "- mode reasoning means the query needs analysis before lookup, for example: barang terlaris di payakumbuh, cabang paling ramai, produk paling sering laku, performa terbaik.",
    "- keywords must be short search phrases that help find matching dashboard records.",
    "- branchHints should contain branch names or codes if the query implies a branch.",
    "- summary should explain the interpreted search path in one concise Indonesian sentence.",
    "- confidence must be between 0 and 1.",
    `Query: ${query}`
  ].join("\n");

  let response: Response | null = null;
  for (const model of models) {
    response = await generateGeminiContent(model, apiKey, prompt).catch(() => null);
    if (response?.ok) {
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
    mode: normalizeMode(parsed.mode),
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
    "Tugasmu adalah membaca databaseIndex dari snapshot POS, memilih record paling relevan, lalu menjawab pertanyaan user secara natural dalam Bahasa Indonesia.",
    "Gunakan hanya angka dan item dari snapshot data. Jangan mengarang data di luar snapshot.",
    "Kalau user bertanya tentang stok, produk, cabang, expired, penjualan, omzet, laba, piutang, atau performa cabang, jawab dari snapshot.",
    "Kalau pertanyaan umum seperti 'siapa kamu?', jawab sebagai asisten AI minimarket tanpa menampilkan data snapshot.",
    "Jika snapshot queryContext.searchMode bernilai direct, jawab langsung dari record atau total yang cocok.",
    "Jika snapshot queryContext.searchMode bernilai reasoning, analisis data kandidat dulu lalu beri kesimpulan.",
    "Untuk pertanyaan seperti barang terlaris, hitung dari databaseIndex.sales dan kelompokkan berdasarkan itemName sebelum menjawab.",
    "Untuk pencarian stok natural, pakai makna pertanyaan untuk memilih record dari databaseIndex.stock, terutama field name, category, dan semanticText.",
    "Contoh: 'obat luka' cocok dengan antiseptik/BETADINE/povidone iodine; 'obat batuk' cocok dengan KOMIX/produk batuk; 'masuk angin' cocok dengan balsem atau minyak kayu putih.",
    "Jangan memilih record hanya karena kategorinya sama jika fungsi produknya tidak sesuai pertanyaan user.",
    "Isi resultKeys dengan searchKey dari record databaseIndex yang benar-benar cocok untuk ditampilkan UI. Jika ragu tetapi ada kandidat relevan, tetap pilih kandidat terkuat. Jika tidak ada yang cocok, pakai array kosong.",
    "Kalau user meminta total atau ringkasan, jawab ringkas tanpa daftar item.",
    "Kalau user meminta daftar atau pencarian produk, tampilkan maksimal 6 item paling relevan saja.",
    "Format answer harus rapi untuk tampilan web: gunakan beberapa baris pendek, heading singkat seperti 'Ringkasan:', 'Penjualan:', 'Stok:', atau 'Expired:', lalu bullet dengan awalan '- '.",
    "Jangan tulis semua hasil dalam satu paragraf panjang. Jangan ulangi semua data yang sudah ada di daftar hasil UI.",
    "Return ONLY JSON with this shape:",
    '{ "answer": "jawaban natural tanpa heading template", "totalResults": 0, "totalSales": 0, "totalProfit": 0, "resultKeys": { "sales": ["..."], "stock": ["..."], "expired": ["..."], "branches": ["..."] } }',
    `Pertanyaan user: ${query}`,
    `Snapshot data POS JSON: ${JSON.stringify(dataSnapshot)}`
  ].join("\n");

  let response: Response | null = null;
  for (const model of getGeminiModels()) {
    response = await generateGeminiContent(model, apiKey, prompt).catch(() => null);
    if (response?.ok) {
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
    totalProfit: normalizeNumber(parsed?.totalProfit),
    resultKeys: normalizeResultKeys(parsed?.resultKeys)
  };
}

export function buildFallbackSearchPlan(query: string): GeminiSearchPlan {
  const normalizedQuery = query.toLowerCase();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 8);
  const expiredIntent = /expire|expired|kadaluarsa|kedaluwarsa|fefo|masa\s+berlaku/.test(normalizedQuery);
  const topSellingIntent = /terlaris|paling\s+laku|sering\s+laku|paling\s+sering/.test(normalizedQuery);
  const salesIntent = /jual|penjualan|transaksi|faktur|omzet|pendapatan|laba|pelanggan/.test(normalizedQuery) || topSellingIntent;
  const stockIntent = /stok|stock|barang|produk|item|limit|kosong|habis|tersedia|ready|\bada\b|harga|obat|vitamin|balsem|betadine|luka|batuk|minyak|masker|sabun|lampu|baterai|battery/.test(normalizedQuery);
  const branchIntent = /cabang|toko|bintang|pekanbaru|dhamasraya|payakumbuh|tanjung|solok/.test(normalizedQuery);
  const focus: SearchFocus = expiredIntent
    ? "expired"
    : salesIntent
      ? "sales"
      : stockIntent
        ? "stock"
        : branchIntent
          ? "branch"
          : "mixed";

  const mode: SearchMode = /terlaris|paling|terbaik|terburuk|ramai|sepi|laku|sering|ranking|peringkat|analisa|analisis|banding|performa/.test(normalizedQuery) ? "reasoning" : "direct";

  return {
    focus,
    mode,
    keywords: terms,
    branchHints: terms.filter((term) => /c\d{2}/i.test(term) || /pekanbaru|dhamasraya|payakumbuh|tanjung|solok/i.test(term)),
    summary: "Pencarian lokal fallback dipakai untuk membaca prompt ini.",
    confidence: 0.2
  };
}
