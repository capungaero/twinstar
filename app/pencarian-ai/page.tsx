import { Bot, Boxes, Building2, Database, Download, ReceiptText, Search, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { buildAiSearchResponse } from "@/lib/ai-search";
import { getProductCategory } from "@/lib/filters";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function Sidebar() {
  const items = [
    { href: "/", label: "Dashboard", icon: <TrendingUp size={18} /> },
    { href: "/cabang", label: "Cabang", icon: <Building2 size={18} /> },
    { href: "/penjualan", label: "Penjualan", icon: <ReceiptText size={18} /> },
    { href: "/stok", label: "Stok", icon: <Boxes size={18} /> },
    { href: "/pencarian-ai", label: "Pencarian AI", icon: <Bot size={18} />, active: true },
    { href: "/#monitor", label: "Status Sinkron", icon: <Database size={18} /> }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">
          <Bot size={22} />
        </div>
        <div>
          <strong>POS Pusat</strong>
          <span>Pencarian AI</span>
        </div>
      </div>
      <nav className="nav-list" aria-label="Menu utama">
        {items.map((item) => (
          <Link className={`nav-list__item ${item.active ? "nav-list__item--active" : ""}`} href={item.href} key={item.label}>
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      <section className="branch-panel">
        <span>Asisten Data</span>
        <strong>Cari pakai bahasa bebas</strong>
        <p>Mode awal masih simulasi lokal dari dummy data internal.</p>
      </section>
    </aside>
  );
}

function formatAiAnswerLines(answer: string) {
  return answer
    .replace(/\s+(Ringkasan|Penjualan|Transaksi|Stok Barang|Stok|Expired|Produk Kedaluwarsa\/Mendekati Kedaluwarsa|Cabang|Total):/gi, "\n$1:")
    .replace(/\s+-\s+/g, "\n- ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 18);
}

export default async function PencarianAiPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const searchResult = query ? await buildAiSearchResponse(query) : null;
  const hasQuery = Boolean(searchResult);
  const visibleSales = searchResult?.visibleSales ?? [];
  const visibleStock = searchResult?.visibleStock ?? [];
  const visibleExpired = searchResult?.visibleExpired ?? [];
  const visibleBranches = searchResult?.visibleBranches ?? [];
  const totalResults = searchResult?.totalResults ?? 0;
  const totalSales = searchResult?.totalSales ?? 0;
  const totalProfit = searchResult?.totalProfit ?? 0;
  const summaryOnly = searchResult?.summaryOnly ?? false;
  const hasResults = totalResults > 0 && !summaryOnly;
  const exportQuery = encodeURIComponent(query);
  const answerText = searchResult?.answerText ?? `Total penjualan terkait: ${formatCurrency(totalSales)}, estimasi laba: ${formatCurrency(totalProfit)}.`;
  const answerLines = formatAiAnswerLines(answerText);

  return (
    <main className="shell">
      <Sidebar />
      <section className="content ai-page">
        <div className="ai-search-shell">
          <form className="ai-search-form" action="/pencarian-ai">
            <Search size={22} />
            <input
              aria-label="Prompt pencarian AI"
              className="ai-search-input"
              defaultValue={query}
              name="q"
              placeholder="Tanyakan data penjualan, stok, cabang, atau barang expired..."
              type="search"
            />
            <button className="ai-search-button" type="submit">
              <Sparkles size={18} />
              Cari AI
            </button>
          </form>

          <section className="ai-results-panel">
            {hasQuery ? (
              <div className="ai-answer">
                <div className="ai-answer__icon">
                  <Bot size={22} />
                </div>
                <div>
                  <strong>{summaryOnly ? `Jawaban untuk "${query}"` : `${totalResults} hasil untuk "${query}"`}</strong>
                  <div className="ai-answer__text">
                    {answerLines.map((line, index) => {
                      const isBullet = line.startsWith("- ");
                      const isHeading = /:$/.test(line) && !isBullet;

                      return (
                        <p className={`${isBullet ? "ai-answer__bullet" : ""} ${isHeading ? "ai-answer__heading" : ""}`} key={`${line}-${index}`}>
                          {isBullet ? line.slice(2) : line}
                        </p>
                      );
                    })}
                  </div>
                  {hasResults ? (
                    <div className="ai-export-actions" aria-label="Export hasil pencarian">
                      <Link className="ai-export-button" href={`/api/ai-search/export?q=${exportQuery}&format=xlsx`}>
                        <Download size={15} />
                        XLSX
                      </Link>
                      <Link className="ai-export-button" href={`/api/ai-search/export?q=${exportQuery}&format=csv`}>
                        <Download size={15} />
                        CSV
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {summaryOnly && hasQuery ? null : hasResults ? (
              <div className="ai-result-list ai-result-list--single">
                {visibleSales.map((sale) => (
                  <div className="ai-result-row" key={`sale-${sale.branchCode}-${sale.code}-${sale.itemName}`}>
                    <div>
                      <span className="ai-result-badge">Transaksi</span>
                      <strong>{sale.itemName}</strong>
                      <span className="ai-result-meta">
                        {sale.code} - {sale.branchName} - {formatDate(sale.date)} - {sale.customer}
                      </span>
                    </div>
                    <div className="right">
                      <strong>{formatCurrency(sale.total)}</strong>
                      <span>{sale.quantity} item - {sale.paymentMethod} - {sale.status}</span>
                    </div>
                  </div>
                ))}

                {visibleBranches.map((branch) => (
                  <Link className="ai-result-row" href={`/cabang?kode=${branch.code}`} key={`branch-${branch.code}`}>
                    <div>
                      <span className="ai-result-badge ai-result-badge--branch">Cabang</span>
                      <strong>{branch.name}</strong>
                      <span className="ai-result-meta">
                        {branch.code} - {branch.transactions} transaksi - produk teratas: {branch.topProduct}
                      </span>
                    </div>
                    <div className="right">
                      <strong>{formatCurrency(branch.monthSales)}</strong>
                      <span>{branch.status} - stok limit {formatNumber(branch.stockLimit)}</span>
                    </div>
                  </Link>
                ))}

                {visibleStock.map((product) => (
                  <div className="ai-result-row" key={`stock-${product.branchName}-${product.code}-${product.name}`}>
                    <div>
                      <span className="ai-result-badge ai-result-badge--stock">Stok</span>
                      <strong>{product.name}</strong>
                      <span className="ai-result-meta">
                        {product.code} - {product.branchName} - {getProductCategory(product.name)}
                      </span>
                    </div>
                    <div className="right">
                      <strong>{formatNumber(product.stock)} stok</strong>
                      <span>{formatCurrency(product.price)}</span>
                    </div>
                  </div>
                ))}

                {visibleExpired.map((product) => (
                  <div className="ai-result-row" key={`expired-${product.branchName}-${product.code}-${product.expiredAt}-${product.name}`}>
                    <div>
                      <span className="ai-result-badge ai-result-badge--expired">Expired</span>
                      <strong>{product.name}</strong>
                      <span className="ai-result-meta">
                        {product.branchName} - exp {formatDate(product.expiredAt)}
                      </span>
                    </div>
                    <div className="right">
                      <strong>{formatNumber(product.stock)} stok</strong>
                      <span>{product.status === "expired" ? "Expired" : "Mendekati expired"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--search ai-empty">
                <Search size={30} />
                <strong>{hasQuery ? "Belum ada hasil yang cocok" : "Belum ada pencarian"}</strong>
                <span>
                  {hasQuery
                    ? "Coba gunakan kata lain seperti nama cabang, kategori produk, faktur, stok, atau expired."
                    : "Ketik pertanyaan untuk mencari data POS dengan AI."}
                </span>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
