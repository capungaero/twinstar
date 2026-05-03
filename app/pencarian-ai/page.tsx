import { Bot, Boxes, Building2, Database, ReceiptText, Search, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { getProductCategory } from "@/lib/filters";
import { getDashboardData } from "@/lib/legacy-db";
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

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreValues(query: string, values: Array<string | number | null | undefined>) {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return 0;

  const text = normalize(values.map((value) => String(value ?? "")).join(" "));
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

export default async function PencarianAiPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getDashboardData();
  const query = params?.q?.trim() ?? "";
  const normalizedQuery = normalize(query);
  const hasQuery = normalizedQuery.length > 0;
  const wantsSales = /jual|penjualan|transaksi|faktur|omzet|pendapatan|laba|pelanggan/.test(normalizedQuery);
  const wantsStock = /stok|stock|barang|produk|item|limit|kosong/.test(normalizedQuery);
  const wantsExpired = /expire|expired|kadaluarsa|kedaluwarsa|fefo/.test(normalizedQuery);
  const wantsBranch = /cabang|toko|bintang|pekanbaru|dhamasraya|payakumbuh|tanjung|solok/.test(normalizedQuery);
  const broadSearch = !wantsSales && !wantsStock && !wantsExpired && !wantsBranch;

  const salesMatches = hasQuery
    ? data.recentSales
        .map((sale) => ({
          item: sale,
          score: scoreValues(query, [
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
  const stockMatches = hasQuery
    ? stockSource
        .map((product) => ({
          item: product,
          score: scoreValues(query, [product.code, product.branchName, product.name, getProductCategory(product.name), product.stock, product.price])
        }))
        .filter((match) => match.score > 0 || wantsStock)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .slice(0, 12)
        .map((match) => match.item)
    : [];

  const expiredMatches = hasQuery
    ? data.expiringProducts
        .map((product) => ({
          item: product,
          score: scoreValues(query, [product.code, product.branchName, product.name, product.status, product.expiredAt, product.stock])
        }))
        .filter((match) => match.score > 0 || wantsExpired)
        .sort((a, b) => b.score - a.score || a.item.stock - b.item.stock)
        .slice(0, 10)
        .map((match) => match.item)
    : [];

  const branchMatches = hasQuery
    ? data.branchSummaries
        .map((branch) => ({
          item: branch,
          score: scoreValues(query, [branch.code, branch.name, branch.status, branch.topProduct, branch.transactions, branch.monthSales])
        }))
        .filter((match) => match.score > 0 || wantsBranch)
        .sort((a, b) => b.score - a.score || b.item.monthSales - a.item.monthSales)
        .slice(0, 10)
        .map((match) => match.item)
    : [];

  const visibleSales = wantsSales || broadSearch ? salesMatches : [];
  const visibleStock = wantsStock || broadSearch ? stockMatches : [];
  const visibleExpired = wantsExpired || broadSearch ? expiredMatches : [];
  const visibleBranches = wantsBranch || broadSearch ? branchMatches : [];
  const totalResults = visibleSales.length + visibleStock.length + visibleExpired.length + visibleBranches.length;
  const totalSales = visibleSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalProfit = visibleSales.reduce((sum, sale) => sum + sale.profit, 0);
  const hasResults = totalResults > 0;

  return (
    <main className="shell">
      <Sidebar />
      <section className="content ai-page">
        <section className="ai-hero">
          <span className="eyebrow">Pencarian AI Database POS</span>
          <h1>Cari data seperti bertanya ke asisten</h1>
          <p>Masukkan prompt bebas untuk mencari transaksi, cabang, stok, produk expired, pelanggan, atau kategori dari data dummy internal.</p>
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
                {hasQuery
                  ? `${totalResults} hasil ditemukan untuk "${query}"`
                  : "Masukkan prompt untuk mulai mencari data POS"}
              </strong>
              <p>
                {hasQuery
                  ? `AI menemukan ${visibleSales.length} transaksi, ${visibleStock.length} data stok, ${visibleExpired.length} barang expired, dan ${visibleBranches.length} cabang. Total penjualan terkait: ${formatCurrency(totalSales)}, estimasi laba: ${formatCurrency(totalProfit)}.`
                  : "Data tidak ditampilkan sebelum ada prompt. Ketik pertanyaan seperti pencarian Google untuk melihat hasil dari dummy data internal."}
              </p>
            </div>
          </div>

          {hasResults ? (
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
