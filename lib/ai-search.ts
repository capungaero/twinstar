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

function formatResultLines(result: AiSearchResponse) {
  const lines = [
    `Pencarian AI: ${result.query}`,
    result.searchPlan?.summary ? `Ringkasan: ${result.searchPlan.summary}` : "Ringkasan: pencarian lokal dipakai.",
    `Hasil: ${result.totalResults} | Penjualan: ${formatCurrency(result.totalSales)} | Laba: ${formatCurrency(result.totalProfit)}`
  ];

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
  const wantsSales = hasQuery && (searchPlan?.focus === "sales" || searchPlan?.focus === "mixed");
  const wantsStock = hasQuery && (searchPlan?.focus === "stock" || searchPlan?.focus === "mixed");
  const wantsExpired = hasQuery && (searchPlan?.focus === "expired" || searchPlan?.focus === "mixed");
  const wantsBranch = hasQuery && (searchPlan?.focus === "branch" || searchPlan?.focus === "mixed");
  const broadSearch = hasQuery && searchPlan?.focus === "mixed";

  const visibleSales = hasQuery
    ? data.recentSales
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
        .slice(0, 12)
        .map((match) => match.item)
    : [];

  const stockSource = [...data.lowStockProducts, ...data.topStockProducts];
  const visibleStock = hasQuery
    ? stockSource
        .map((product) => ({
          item: product,
          score: scoreValues(effectiveQuery, [product.code, product.branchName, product.name, getProductCategory(product.name), product.stock, product.price])
        }))
        .filter((match) => match.score > 0 || wantsStock)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .slice(0, 12)
        .map((match) => match.item)
    : [];

  const visibleExpired = hasQuery
    ? data.expiringProducts
        .map((product) => ({
          item: product,
          score: scoreValues(effectiveQuery, [product.code, product.branchName, product.name, product.status, product.expiredAt, product.stock])
        }))
        .filter((match) => match.score > 0 || wantsExpired)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .slice(0, 10)
        .map((match) => match.item)
    : [];

  const visibleBranches = hasQuery
    ? data.branchSummaries
        .map((branch) => ({
          item: branch,
          score: scoreValues(effectiveQuery, [branch.code, branch.name, branch.status, branch.topProduct, branch.transactions, branch.monthSales])
        }))
        .filter((match) => match.score > 0 || wantsBranch)
        .sort((a, b) => b.score - a.score || b.item.monthSales - a.item.monthSales)
        .slice(0, 10)
        .map((match) => match.item)
    : [];

  const filteredSales = wantsSales || broadSearch ? visibleSales : [];
  const filteredStock = wantsStock || broadSearch ? visibleStock : [];
  const filteredExpired = wantsExpired || broadSearch ? visibleExpired : [];
  const filteredBranches = wantsBranch || broadSearch ? visibleBranches : [];
  const totalResults = filteredSales.length + filteredStock.length + filteredExpired.length + filteredBranches.length;
  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0);

  const response: AiSearchResponse = {
    query,
    data,
    searchPlan,
    effectiveQuery,
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
