type SearchFocus = "sales" | "stock" | "expired" | "branch" | "mixed";

export type GeminiSearchPlan = {
  focus: SearchFocus;
  keywords: string[];
  branchHints: string[];
  summary: string;
  confidence: number;
};

function getGeminiKey() {
  const value = process.env.GEMINI_API_KEY?.trim();
  return value ? value : undefined;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const jsonText = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonText) as Partial<GeminiSearchPlan>;
  } catch {
    return null;
  }
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

export async function inferGeminiSearchPlan(query: string): Promise<GeminiSearchPlan | null> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const prompt = [
    "You are a POS search planner.",
    "Analyze the user's query and return ONLY JSON with this shape:",
    '{ "focus": "sales|stock|expired|branch|mixed", "keywords": ["..."], "branchHints": ["..."], "summary": "...", "confidence": 0.0 }',
    "Rules:",
    "- keywords must be short search phrases that help find matching dashboard records.",
    "- branchHints should contain branch names or codes if the query implies a branch.",
    "- summary should be one concise sentence.",
    "- confidence must be between 0 and 1.",
    `Query: ${query}`
  ].join("\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim() ?? "";
  if (!text) {
    return null;
  }

  const parsed = extractJsonObject(text);
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
