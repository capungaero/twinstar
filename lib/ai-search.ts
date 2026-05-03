import { answerGeminiFromData, buildFallbackSearchPlan, inferGeminiSearchPlan, type GeminiSearchPlan } from "@/lib/gemini";
import { getProductCategory } from "@/lib/filters";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getDashboardData } from "@/lib/legacy-db";
import { getVectorSearchResults } from "@/lib/vector-search";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type StockItem = DashboardData["lowStockProducts"][number] | DashboardData["topStockProducts"][number];

export type AiSearchResponse = {
  query: string;
  data: DashboardData;
  searchPlan: GeminiSearchPlan | null;
  effectiveQuery: string;
  summaryOnly: boolean;
  conversational: boolean;
  answerText: string;
  visibleSales: DashboardData["recentSales"];
  visibleStock: StockItem[];
  visibleExpired: DashboardData["expiringProducts"];
  visibleBranches: DashboardData["branchSummaries"];
  totalResults: number;
  totalSales: number;
  totalProfit: number;
  replyText: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\bsctock\b/g, "stock").replace(/\s+/g, " ").trim();
}

const SEARCH_STOP_WORDS = new Set([
  "ai",
  "ambil",
  "barang",
  "bintang",
  "cabang",
  "cair",
  "cari",
  "cek",
  "data",
  "dan",
  "di",
  "item",
  "kembar",
  "keuntungan",
  "laba",
  "limit",
  "lihat",
  "omzet",
  "pendapatan",
  "penjualan",
  "produk",
  "profit",
  "saja",
  "sja",
  "stock",
  "stok",
  "tahun",
  "tampilkan",
  "terakhir",
  "total",
  "yang"
]);

function extractSearchTerms(query: string, searchPlan: GeminiSearchPlan | null) {
  const source = [query, ...(searchPlan?.keywords ?? [])].join(" ");
  return Array.from(
    new Set(
      normalize(source)
        .split(/[^a-z0-9]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3)
        .filter((term) => !/^\d+$/.test(term))
        .filter((term) => !SEARCH_STOP_WORDS.has(term))
    )
  ).slice(0, 8);
}

function getBranchCodeFilter(query: string) {
  const normalized = normalize(query);
  const match = normalized.match(/\bc(?:abang)?\s*0?(\d{1,2})\b/) ?? normalized.match(/\bc(0?\d{1,2})\b/);
  if (!match) return null;

  return `C${match[1].padStart(2, "0")}`;
}

function isLowStockQuery(query: string) {
  return /stok\s+limit|stock\s+limit|limit\s+stok|limit\s+stock|stok\s+kosong|stock\s+kosong/i.test(normalize(query));
}

function matchesBranch(branchCode: string | undefined, branchName: string | undefined, branchFilter: string | null) {
  if (!branchFilter) return true;

  const normalizedName = normalize(branchName ?? "");
  const branchNumber = String(Number(branchFilter.slice(1)));
  return branchCode === branchFilter || normalizedName.includes(`cabang ${branchNumber}`) || normalizedName.includes(`cabang ${branchFilter.slice(1)}`);
}

function scoreValues(terms: string[], values: Array<string | number | null | undefined>) {
  if (!terms.length) return 0;

  const text = normalize(values.map((value) => String(value ?? "")).join(" "));
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function wantsSummaryOnly(query: string) {
  return /total(?:nya)?\s+saja|total\s+nya\s+saja|tidak\s+usah\s+(?:tampilkan|pakai)\s+(?:list|daftar)|jangan\s+tampilkan\s+(?:list|daftar)|tanpa\s+(?:list|daftar|rincian)|ringkas\s+saja|jawab\s+saja/i.test(query);
}

function wantsSalesAggregate(query: string) {
  return /total|jumlah|berapa|hitung|omzet|penjualan|pendapatan|laba/i.test(query);
}

function wantsProfitAggregate(query: string) {
  return /keuntungan|profit|laba/i.test(query);
}

function isConversationalQuery(query: string) {
  const normalized = normalize(query);
  return /^(siapa|apa)\s+(kamu|anda)|^(kamu|anda)\s+siapa|^help$|^bantuan$|^halo$|^hai$|^test$|^tes$/i.test(normalized);
}

function buildConversationalAnswer(query: string) {
  const normalized = normalize(query);
  if (/siapa|kamu|anda/.test(normalized)) {
    return "Saya Admin AI untuk dashboard POS. Kirim pertanyaan tentang penjualan, stok, cabang, produk expired, atau laba, nanti saya carikan dari database.";
  }

  return "Saya siap membantu pencarian data POS. Contoh: stok betadine cabang 10, total penjualan bulan ini, atau barang expired minggu ini.";
}

function getSalesWindowDays(query: string) {
  if (/\b2\s*bulan|dua\s+bulan/i.test(query)) return 60;
  if (/\b3\s*bulan|tiga\s+bulan/i.test(query)) return 90;
  if (/\b1\s*bulan|satu\s+bulan|bulan\s+terakhir/i.test(query)) return 30;
  if (/\b7\s*hari|seminggu|minggu\s+terakhir/i.test(query)) return 7;
  return null;
}

function isWithinLastDays(dateValue: string | null, days: number) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return date >= start;
}

function formatAnswerText(result: Pick<AiSearchResponse, "query" | "summaryOnly" | "visibleSales" | "visibleStock" | "visibleExpired" | "visibleBranches" | "totalResults" | "totalSales" | "totalProfit">) {
  if (result.summaryOnly && wantsProfitAggregate(result.query)) {
    return `Total laba yang cocok dengan pencarian ini adalah ${formatCurrency(result.totalProfit)} dari ${formatNumber(result.totalResults)} transaksi. Total penjualan terkait: ${formatCurrency(result.totalSales)}.`;
  }

  if (result.summaryOnly && wantsSalesAggregate(result.query)) {
    return `Total penjualan yang cocok dengan pencarian ini adalah ${formatCurrency(result.totalSales)} dari ${formatNumber(result.totalResults)} transaksi. Estimasi laba: ${formatCurrency(result.totalProfit)}.`;
  }

  if (result.visibleStock.length > 0 && result.visibleSales.length === 0 && result.visibleExpired.length === 0 && result.visibleBranches.length === 0) {
    return `Ditemukan ${formatNumber(result.totalResults)} data stok yang cocok. ${formatNumber(result.visibleStock.length)} data teratas ditampilkan di bawah.`;
  }

  if (result.visibleSales.length > 0 && result.visibleStock.length === 0 && result.visibleExpired.length === 0 && result.visibleBranches.length === 0) {
    return `Ditemukan ${formatNumber(result.totalResults)} transaksi yang cocok. Total penjualan: ${formatCurrency(result.totalSales)}. Estimasi laba: ${formatCurrency(result.totalProfit)}.`;
  }

  if (result.visibleExpired.length > 0 && result.visibleSales.length === 0 && result.visibleStock.length === 0 && result.visibleBranches.length === 0) {
    return `Ditemukan ${formatNumber(result.totalResults)} barang expired atau mendekati expired yang cocok.`;
  }

  if (result.visibleBranches.length > 0 && result.visibleSales.length === 0 && result.visibleStock.length === 0 && result.visibleExpired.length === 0) {
    return `Ditemukan ${formatNumber(result.totalResults)} cabang yang cocok dengan pencarian.`;
  }

  return `Ditemukan ${formatNumber(result.totalResults)} hasil terkait: ${result.visibleSales.length} transaksi, ${result.visibleStock.length} data stok, ${result.visibleExpired.length} barang expired, dan ${result.visibleBranches.length} cabang. Total penjualan: ${formatCurrency(result.totalSales)}.`;
}

function buildGeminiDataSnapshot(data: DashboardData, query: string) {
  const normalizedQuery = normalize(query);
  const branchFilter = getBranchCodeFilter(query);
  const salesWindowDays = getSalesWindowDays(query);
  const queryTokens = extractSearchTerms(query, buildFallbackSearchPlan(query));
  const stockSource = [...data.lowStockProducts, ...data.topStockProducts];

  const scoreText = (values: Array<string | number | null | undefined>) => scoreValues(queryTokens, values);
  const filterBranch = (branchName?: string, branchCode?: string) => matchesBranch(branchCode, branchName, branchFilter);
  const stripScore = <T extends { _score: number }>(item: T) => {
    const { _score: _removed, ...rest } = item;
    void _removed;
    return rest;
  };

  const candidateSales = data.recentSales
    .filter((sale) => (salesWindowDays ? isWithinLastDays(sale.date, salesWindowDays) : true))
    .filter((sale) => filterBranch(sale.branchName, sale.branchCode))
    .map((sale) => ({
      ...sale,
      _score: scoreText([sale.code, sale.branchCode, sale.branchName, sale.customer, sale.cashier, sale.itemName, sale.category, sale.paymentMethod, sale.status])
    }))
    .filter((sale) => queryTokens.length === 0 || sale._score > 0 || /penjualan|omzet|laba|keuntungan|profit|transaksi|tahun|bulan|total/i.test(normalizedQuery))
    .sort((a, b) => b._score - a._score || b.total - a.total)
    .slice(0, 80)
    .map(stripScore);

  const candidateStock = stockSource
    .filter((product) => filterBranch(product.branchName))
    .map((product) => ({
      ...product,
      category: getProductCategory(product.name),
      _score: scoreText([product.code, product.branchName, product.name, getProductCategory(product.name), product.stock, product.price])
    }))
    .filter((product) => queryTokens.length === 0 || product._score > 0 || /stok|stock|barang|produk|item/i.test(normalizedQuery))
    .sort((a, b) => b._score - a._score || a.stock - b.stock)
    .slice(0, 80)
    .map(stripScore);

  const candidateExpired = data.expiringProducts
    .filter((product) => filterBranch(product.branchName))
    .map((product) => ({
      ...product,
      _score: scoreText([product.code, product.branchName, product.name, product.status, product.expiredAt, product.stock])
    }))
    .filter((product) => queryTokens.length === 0 || product._score > 0 || /expired|expire|kedaluwarsa|kadaluarsa/i.test(normalizedQuery))
    .sort((a, b) => b._score - a._score || a.stock - b.stock)
    .slice(0, 50)
    .map(stripScore);

  return {
    generatedAt: data.generatedAt,
    summary: data.summary,
    branchSummaries: data.branchSummaries,
    queryContext: {
      normalizedQuery,
      branchFilter,
      salesWindowDays,
      queryTokens
    },
    candidates: {
      sales: candidateSales,
      stock: candidateStock,
      expired: candidateExpired
    }
  };
}

export async function buildAiSearchResponse(query: string): Promise<AiSearchResponse> {
  const data = await getDashboardData();
  const normalizedQuery = normalize(query);
  const hasQuery = normalizedQuery.length > 0;
  const conversational = hasQuery && isConversationalQuery(query);
  const searchPlan = hasQuery ? (await inferGeminiSearchPlan(normalizedQuery)) ?? buildFallbackSearchPlan(normalizedQuery) : null;
  const searchTerms = hasQuery ? extractSearchTerms(query, searchPlan) : [];
  const effectiveQuery = searchTerms.join(" ");
  const summaryOnly = wantsSummaryOnly(query) || wantsProfitAggregate(query);
  const salesWindowDays = getSalesWindowDays(query);
  const branchFilter = getBranchCodeFilter(query);
  const lowStockOnly = isLowStockQuery(query);
  const vectorResults = hasQuery && !conversational ? getVectorSearchResults(data, effectiveQuery || query) : null;
  const salesSource = vectorResults?.sales.length ? vectorResults.sales : data.recentSales;
  const stockSourceBase = vectorResults?.stock.length ? vectorResults.stock : [...data.lowStockProducts, ...data.topStockProducts];
  const expiredSource = vectorResults?.expired.length ? vectorResults.expired : data.expiringProducts;
  const branchSource = vectorResults?.branches.length ? vectorResults.branches : data.branchSummaries;
  const wantsSales = hasQuery && (searchPlan?.focus === "sales" || searchPlan?.focus === "mixed");
  const wantsStock = hasQuery && (searchPlan?.focus === "stock" || searchPlan?.focus === "mixed");
  const wantsExpired = hasQuery && (searchPlan?.focus === "expired" || searchPlan?.focus === "mixed");
  const wantsBranch = hasQuery && (searchPlan?.focus === "branch" || searchPlan?.focus === "mixed");
  const broadSearch = hasQuery && searchPlan?.focus === "mixed";

  const matchedSales = hasQuery && !conversational
    ? salesSource
        .filter((sale) => (salesWindowDays ? isWithinLastDays(sale.date, salesWindowDays) : true))
        .filter((sale) => matchesBranch(sale.branchCode, sale.branchName, branchFilter))
        .map((sale) => ({
          item: sale,
          score: scoreValues(searchTerms, [
            sale.code,
            sale.branchCode,
            sale.branchName,
            sale.customer,
            sale.cashier,
            sale.itemName,
            sale.category,
            sale.paymentMethod,
            sale.status,
            sale.total,
            sale.profit
          ])
        }))
        .filter((match) => searchTerms.length === 0 || match.score > 0)
        .sort((a, b) => b.score - a.score || b.item.total - a.item.total)
        .map((match) => match.item)
    : [];

  const stockSource = lowStockOnly ? stockSourceBase.filter((product) => "minimum" in product) : stockSourceBase;
  const matchedStock = hasQuery && !conversational
    ? stockSource
        .filter((product) => matchesBranch(undefined, product.branchName, branchFilter))
        .map((product) => ({
          item: product,
          score: scoreValues(searchTerms, [product.code, product.branchName, product.name, getProductCategory(product.name), product.stock, product.price])
        }))
        .filter((match) => searchTerms.length === 0 || match.score > 0)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .map((match) => match.item)
    : [];

  const matchedExpired = hasQuery && !conversational
    ? expiredSource
        .filter((product) => matchesBranch(undefined, product.branchName, branchFilter))
        .map((product) => ({
          item: product,
          score: scoreValues(searchTerms, [product.code, product.branchName, product.name, product.status, product.expiredAt, product.stock])
        }))
        .filter((match) => searchTerms.length === 0 || match.score > 0)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .map((match) => match.item)
    : [];

  const matchedBranches = hasQuery && !conversational
    ? branchSource
        .filter((branch) => matchesBranch(branch.code, branch.name, branchFilter))
        .map((branch) => ({
          item: branch,
          score: scoreValues(searchTerms, [branch.code, branch.name, branch.status, branch.topProduct, branch.transactions, branch.monthSales])
        }))
        .filter((match) => searchTerms.length === 0 || match.score > 0 || wantsBranch)
        .sort((a, b) => b.score - a.score || b.item.monthSales - a.item.monthSales)
        .map((match) => match.item)
    : [];

  const allSales = wantsSales || broadSearch ? matchedSales : [];
  const allStock = wantsStock || broadSearch ? matchedStock : [];
  const allExpired = wantsExpired || broadSearch ? matchedExpired : [];
  const allBranches = wantsBranch || broadSearch ? matchedBranches : [];
  const filteredSales = summaryOnly ? [] : allSales.slice(0, 12);
  const filteredStock = summaryOnly ? [] : allStock.slice(0, 12);
  const filteredExpired = summaryOnly ? [] : allExpired.slice(0, 10);
  const filteredBranches = summaryOnly ? [] : allBranches.slice(0, 10);
  const totalResults = allSales.length + allStock.length + allExpired.length + allBranches.length;
  const totalSales = allSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalProfit = allSales.reduce((sum, sale) => sum + sale.profit, 0);
  const fallbackAnswerText = conversational
    ? buildConversationalAnswer(query)
    : hasQuery
      ? formatAnswerText({
        query,
        summaryOnly,
        visibleSales: filteredSales,
        visibleStock: filteredStock,
        visibleExpired: filteredExpired,
        visibleBranches: filteredBranches,
        totalResults,
        totalSales,
        totalProfit
      })
      : "Kirim pertanyaan pencarian untuk mulai menelusuri data POS.";
  const geminiAnswer = hasQuery ? await answerGeminiFromData(query, buildGeminiDataSnapshot(data, query)) : null;
  const answerText = geminiAnswer?.answer ?? fallbackAnswerText;
  const finalTotalResults = geminiAnswer?.totalResults || totalResults;
  const finalTotalSales = geminiAnswer?.totalSales || totalSales;
  const finalTotalProfit = geminiAnswer?.totalProfit || totalProfit;

  const response: AiSearchResponse = {
    query,
    data,
    searchPlan,
    effectiveQuery,
    summaryOnly,
    conversational,
    answerText,
    visibleSales: filteredSales,
    visibleStock: filteredStock,
    visibleExpired: filteredExpired,
    visibleBranches: filteredBranches,
    totalResults: finalTotalResults,
    totalSales: finalTotalSales,
    totalProfit: finalTotalProfit,
    replyText: answerText
  };

  return response;
}
