import { buildFallbackSearchPlan, inferGeminiSearchPlan, type GeminiSearchPlan } from "@/lib/gemini";
import { getProductCategory } from "@/lib/filters";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getDashboardData } from "@/lib/legacy-db";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type StockItem = DashboardData["lowStockProducts"][number] | DashboardData["topStockProducts"][number];

export type AiSearchResponse = {
  query: string;
  data: DashboardData;
  searchPlan: GeminiSearchPlan | null;
  effectiveQuery: string;
  summaryOnly: boolean;
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
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreValues(query: string, values: Array<string | number | null | undefined>) {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return 0;

  const text = normalize(values.map((value) => String(value ?? "")).join(" "));
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function compactItems(items: string[], limit: number) {
  return items.filter(Boolean).slice(0, limit);
}

function wantsSummaryOnly(query: string) {
  return /total(?:nya)?\s+saja|total\s+nya\s+saja|tidak\s+usah\s+(?:tampilkan|pakai)\s+(?:list|daftar)|jangan\s+tampilkan\s+(?:list|daftar)|tanpa\s+(?:list|daftar|rincian)|ringkas\s+saja|jawab\s+saja/i.test(query);
}

function wantsSalesAggregate(query: string) {
  return /total|jumlah|berapa|hitung|omzet|penjualan|pendapatan|laba/i.test(query);
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
  if (result.summaryOnly && wantsSalesAggregate(result.query)) {
    return `Total penjualan yang cocok dengan pencarian ini adalah ${formatCurrency(result.totalSales)} dari ${formatNumber(result.totalResults)} transaksi. Estimasi laba: ${formatCurrency(result.totalProfit)}.`;
  }

  return `AI menemukan ${result.visibleSales.length} transaksi, ${result.visibleStock.length} data stok, ${result.visibleExpired.length} barang expired, dan ${result.visibleBranches.length} cabang. Total penjualan terkait: ${formatCurrency(result.totalSales)}, estimasi laba: ${formatCurrency(result.totalProfit)}.`;
}

function formatResultLines(result: AiSearchResponse) {
  const lines = [
    `Pencarian AI: ${result.query}`,
    result.searchPlan?.summary ? `Ringkasan: ${result.searchPlan.summary}` : "Ringkasan: pencarian lokal dipakai.",
    `Hasil: ${result.totalResults} | Penjualan: ${formatCurrency(result.totalSales)} | Laba: ${formatCurrency(result.totalProfit)}`,
    result.answerText
  ];

  if (result.summaryOnly) {
    return lines.join("\n");
  }

  const salesLines = compactItems(
    result.visibleSales.map((sale) => `- ${sale.itemName} | ${sale.branchName} | ${formatCurrency(sale.total)} | ${sale.paymentMethod}`),
    3
  );
  if (salesLines.length) {
    lines.push("", "Transaksi:", ...salesLines);
  }

  const stockLines = compactItems(
    result.visibleStock.map((product) => `- ${product.name} | ${product.branchName} | stok ${formatNumber(product.stock)} | ${formatCurrency(product.price)}`),
    3
  );
  if (stockLines.length) {
    lines.push("", "Stok:", ...stockLines);
  }

  const expiredLines = compactItems(
    result.visibleExpired.map((product) => `- ${product.name} | ${product.branchName} | exp ${formatDate(product.expiredAt)} | stok ${formatNumber(product.stock)}`),
    3
  );
  if (expiredLines.length) {
    lines.push("", "Expired:", ...expiredLines);
  }

  const branchLines = compactItems(
    result.visibleBranches.map((branch) => `- ${branch.name} | ${branch.code} | ${formatCurrency(branch.monthSales)} | ${branch.status}`),
    3
  );
  if (branchLines.length) {
    lines.push("", "Cabang:", ...branchLines);
  }

  return lines.join("\n");
}

export async function buildAiSearchResponse(query: string): Promise<AiSearchResponse> {
  const data = await getDashboardData();
  const normalizedQuery = normalize(query);
  const hasQuery = normalizedQuery.length > 0;
  const searchPlan = hasQuery ? (await inferGeminiSearchPlan(query)) ?? buildFallbackSearchPlan(query) : null;
  const effectiveQuery = hasQuery ? [query, ...(searchPlan?.keywords ?? []), ...(searchPlan?.branchHints ?? [])].join(" ") : "";
  const summaryOnly = wantsSummaryOnly(query);
  const salesWindowDays = getSalesWindowDays(query);
  const wantsSales = hasQuery && (searchPlan?.focus === "sales" || searchPlan?.focus === "mixed");
  const wantsStock = hasQuery && (searchPlan?.focus === "stock" || searchPlan?.focus === "mixed");
  const wantsExpired = hasQuery && (searchPlan?.focus === "expired" || searchPlan?.focus === "mixed");
  const wantsBranch = hasQuery && (searchPlan?.focus === "branch" || searchPlan?.focus === "mixed");
  const broadSearch = hasQuery && searchPlan?.focus === "mixed";

  const matchedSales = hasQuery
    ? data.recentSales
        .filter((sale) => (salesWindowDays ? isWithinLastDays(sale.date, salesWindowDays) : true))
        .map((sale) => ({
          item: sale,
          score: scoreValues(effectiveQuery, [
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
        .filter((match) => match.score > 0 || wantsSales)
        .sort((a, b) => b.score - a.score || b.item.total - a.item.total)
        .map((match) => match.item)
    : [];

  const stockSource = [...data.lowStockProducts, ...data.topStockProducts];
  const matchedStock = hasQuery
    ? stockSource
        .map((product) => ({
          item: product,
          score: scoreValues(effectiveQuery, [product.code, product.branchName, product.name, getProductCategory(product.name), product.stock, product.price])
        }))
        .filter((match) => match.score > 0 || wantsStock)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .map((match) => match.item)
    : [];

  const matchedExpired = hasQuery
    ? data.expiringProducts
        .map((product) => ({
          item: product,
          score: scoreValues(effectiveQuery, [product.code, product.branchName, product.name, product.status, product.expiredAt, product.stock])
        }))
        .filter((match) => match.score > 0 || wantsExpired)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .map((match) => match.item)
    : [];

  const matchedBranches = hasQuery
    ? data.branchSummaries
        .map((branch) => ({
          item: branch,
          score: scoreValues(effectiveQuery, [branch.code, branch.name, branch.status, branch.topProduct, branch.transactions, branch.monthSales])
        }))
        .filter((match) => match.score > 0 || wantsBranch)
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
  const answerText = hasQuery
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

  const response: AiSearchResponse = {
    query,
    data,
    searchPlan,
    effectiveQuery,
    summaryOnly,
    answerText,
    visibleSales: filteredSales,
    visibleStock: filteredStock,
    visibleExpired: filteredExpired,
    visibleBranches: filteredBranches,
    totalResults,
    totalSales,
    totalProfit,
    replyText: hasQuery
      ? formatResultLines({
          query,
          data,
          searchPlan,
          effectiveQuery,
          summaryOnly,
          answerText,
          visibleSales: filteredSales,
          visibleStock: filteredStock,
          visibleExpired: filteredExpired,
          visibleBranches: filteredBranches,
          totalResults,
          totalSales,
          totalProfit,
          replyText: ""
        })
      : "Kirim pertanyaan pencarian untuk mulai menelusuri data POS."
  };

  return response;
}
