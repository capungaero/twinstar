import { Bot, Boxes, Building2, Database, ReceiptText, Search, Sparkles, TrendingUp } from "lucide-react";
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

export default async function PencarianAiPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const searchResult = query ? await buildAiSearchResponse(query) : null;
  const hasQuery = Boolean(searchResult);
  const searchPlan = searchResult?.searchPlan ?? null;
  const visibleSales = searchResult?.visibleSales ?? [];
  const visibleStock = searchResult?.visibleStock ?? [];
  const visibleExpired = searchResult?.visibleExpired ?? [];
  const visibleBranches = searchResult?.visibleBranches ?? [];
  const totalResults = searchResult?.totalResults ?? 0;
  const totalSales = searchResult?.totalSales ?? 0;
  const totalProfit = searchResult?.totalProfit ?? 0;
  const summaryOnly = searchResult?.summaryOnly ?? false;
  const hasResults = totalResults > 0 && !summaryOnly;

  return (
    <main className="shell">
      <Sidebar />
      <section className="content ai-page">
        <section className="ai-hero">
          <span className="eyebrow">Pencarian AI Database POS</span>
          <h1>Cari data seperti bertanya ke asisten</h1>
          <p>Masukkan prompt bebas untuk mencari transaksi, cabang, stok, produk expired, pelanggan, atau kategori dari data dummy internal. Gemini membantu menerjemahkan prompt ke kata kunci pencarian.</p>
        </section>

        <section className="ai-search-panel">
          <form className="ai-search-form" action="/pencarian-ai">
            <Search size={22} />
            <input
              aria-label="Prompt pencarian AI"
              className="ai-search-input"
              defaultValue={query}
              name="q"
              placeholder="Contoh: tampilkan barang expired C07, penjualan minyak pekanbaru, stok limit elektronik..."
              type="search"
            />
            <button className="ai-search-button" type="submit">
              <Sparkles size={18} />
              Cari AI
            </button>
          </form>
          <div className="ai-suggestions">
            {["penjualan C04", "barang expired minggu ini", "stok limit elektronik", "produk terlaris minyak"].map((sample) => (
              <Link href={`/pencarian-ai?q=${encodeURIComponent(sample)}`} key={sample}>
                {sample}
              </Link>
            ))}
          </div>
        </section>

        <article className="panel ai-results-panel">
          <div className="ai-answer">
            <div className="ai-answer__icon">
              <Bot size={24} />
            </div>
            <div>
              <span>Hasil Pencarian AI</span>
              <strong>
                {hasQuery ? (summaryOnly ? `Jawaban ringkas untuk "${query}"` : `${totalResults} hasil ditemukan untuk "${query}"`) : "Masukkan prompt untuk mulai mencari data POS"}
              </strong>
              <p>
                {hasQuery
                  ? `${searchResult?.searchPlan?.summary ?? "Pencarian lokal membantu memahami prompt ini."} ${searchResult?.answerText ?? `Total penjualan terkait: ${formatCurrency(totalSales)}, estimasi laba: ${formatCurrency(totalProfit)}.`}`
                  : "Data tidak ditampilkan sebelum ada prompt. Ketik pertanyaan seperti pencarian Google untuk melihat hasil dari dummy data internal."}
              </p>
              {hasQuery && searchPlan ? <p>Kata kunci AI: {searchPlan.keywords.join(", ") || "-"}.</p> : null}
            </div>
          </div>

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
              <Search size={32} />
              <strong>{hasQuery ? "Belum ada hasil yang cocok" : "Belum ada pencarian"}</strong>
              <span>
                {hasQuery
                  ? "Coba gunakan kata lain seperti nama cabang, kategori produk, faktur, stok, atau expired."
                  : "Data hanya akan muncul dalam bentuk hasil pencarian AI setelah user memasukkan prompt."}
              </span>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
