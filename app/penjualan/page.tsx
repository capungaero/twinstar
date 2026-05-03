import { AlertTriangle, Bot, Boxes, Building2, Database, Filter, PackageSearch, ReceiptText, Search, TrendingUp } from "lucide-react";
import Link from "next/link";
import { getBranchColor } from "@/lib/branch-colors";
import { getBranchDetailData, getDashboardData } from "@/lib/legacy-db";
import { CATEGORY_OPTIONS, matchesCategory, matchesTextSearch } from "@/lib/filters";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    kode?: string;
    q?: string;
    kategori?: string;
    page?: string;
  }>;
};

function Sidebar() {
  const items = [
    { href: "/", label: "Dashboard", icon: <TrendingUp size={18} /> },
    { href: "/cabang", label: "Cabang", icon: <Building2 size={18} /> },
    { href: "/penjualan", label: "Penjualan", icon: <ReceiptText size={18} />, active: true },
    { href: "/stok", label: "Stok", icon: <Boxes size={18} /> },
    { href: "/pencarian-ai", label: "Pencarian AI", icon: <Bot size={18} /> },
    { href: "/#monitor", label: "Status Sinkron", icon: <Database size={18} /> }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">
          <ReceiptText size={22} />
        </div>
        <div>
          <strong>POS Pusat</strong>
          <span>Resume Penjualan</span>
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
        <span>Analitik</span>
        <strong>Penjualan cabang</strong>
        <p>Bisa pilih cabang dan melihat produk laku, tidak laku, serta expired.</p>
      </section>
    </aside>
  );
}

export default async function PenjualanPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dashboard = await getDashboardData();
  const selectedCode = params?.kode || "ALL";
  const selectedBranchIndex = Math.max(0, dashboard.branches.findIndex((branch) => branch.code === selectedCode));
  const selectedColor = selectedCode === "ALL" ? "#0f766e" : getBranchColor(selectedBranchIndex);
  const searchQuery = params?.q ?? "";
  const selectedCategory = params?.kategori ?? "Semua Kategori";
  const currentPage = Math.max(1, Number(params?.page ?? 1) || 1);
  const pageSize = 25;
  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    selectedCategory !== "Semua Kategori" ||
    selectedCode !== "ALL";
  const selectedBranch = selectedCode === "ALL" ? undefined : await getBranchDetailData(selectedCode);
  const selectedBranchSummary = selectedCode === "ALL" ? undefined : dashboard.branchSummaries.find((branch) => branch.code === selectedCode);
  const rawSales = selectedBranch ? selectedBranch.recentSales : dashboard.recentSales;
  const rawExpired = selectedBranch ? selectedBranch.expiringProducts : dashboard.expiringProducts;
  const rawSlowMoving = selectedBranch ? selectedBranch.topStockProducts : dashboard.topStockProducts.slice(0, 12);
  const filteredSales = rawSales.filter(
    (sale) =>
      matchesTextSearch(searchQuery, [sale.code, sale.branchName, sale.customer, sale.cashier, sale.itemName, sale.category]) &&
      (selectedCategory === "Semua Kategori" || sale.category === selectedCategory)
  );
  const filteredExpired = rawExpired.filter(
    (product) =>
      matchesTextSearch(searchQuery, [product.code, product.name, product.branchName]) &&
      matchesCategory(selectedCategory, product.name)
  );
  const filteredSlowMoving = rawSlowMoving.filter(
    (product) =>
      matchesTextSearch(searchQuery, [product.code, product.name, product.branchName]) &&
      matchesCategory(selectedCategory, product.name)
  );
  const filteredTopProducts = Array.from(
    filteredSales
      .reduce((ranking, sale) => {
        const current = ranking.get(sale.itemName) ?? { name: sale.itemName, quantity: 0, total: 0 };
        current.quantity += sale.quantity;
        current.total += sale.total;
        ranking.set(sale.itemName, current);
        return ranking;
      }, new Map<string, { name: string; quantity: number; total: number }>())
      .values()
  ).sort((a, b) => b.quantity - a.quantity || b.total - a.total);
  const sales = hasActiveFilter ? filteredSales : [];
  const expired = hasActiveFilter ? filteredExpired : [];
  const slowMoving = hasActiveFilter ? filteredSlowMoving : [];
  const topProducts = hasActiveFilter ? filteredTopProducts : [];
  const totalPages = Math.max(1, Math.ceil(sales.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageSales = sales.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const paginationHref = (page: number) => {
    const query = new URLSearchParams();
    if (selectedCode !== "ALL") query.set("kode", selectedCode);
    if (searchQuery) query.set("q", searchQuery);
    if (selectedCategory !== "Semua Kategori") query.set("kategori", selectedCategory);
    query.set("page", String(page));

    return `/penjualan?${query.toString()}`;
  };
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const maxProductQty = Math.max(...topProducts.map((product) => product.quantity), 1);
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  const categorySummary = CATEGORY_OPTIONS.filter((category) => category !== "Semua Kategori").map((category) => ({
    category,
    total: sales.filter((sale) => sale.category === category).reduce((sum, sale) => sum + sale.total, 0),
    count: sales.filter((sale) => sale.category === category).length
  }));
  const maxCategoryTotal = Math.max(...categorySummary.map((item) => item.total), 1);
  const paymentSummary = ["Tunai", "QRIS", "Transfer", "Piutang"].map((method) => ({
    method,
    count: sales.filter((sale) => sale.paymentMethod === method).length
  }));
  const statusSummary = ["normal", "retur", "batal", "koreksi"].map((status) => ({
    status,
    count: sales.filter((sale) => sale.status === status).length
  }));
  const paymentTotal = Math.max(paymentSummary.reduce((sum, item) => sum + item.count, 0), 1);
  let paymentCursor = 0;
  const paymentColors = ["#2f80d9", "#22c55e", "#ff7a45", "#ef4444"];
  const salesDonut = `conic-gradient(${paymentSummary
    .map((item, index) => {
      const start = paymentCursor;
      paymentCursor += (item.count / paymentTotal) * 360;
      return `${paymentColors[index]} ${start}deg ${paymentCursor}deg`;
    })
    .join(", ")})`;

  return (
    <main className="shell">
      <Sidebar />
      <section className="content sales-dashboard">
        <header className="sales-hero" style={{ "--branch-color": selectedColor } as React.CSSProperties}>
          <div>
            <span>Resume data penjualan</span>
            <h1>Dashboard Penjualan</h1>
            <p>Analitik transaksi, produk terlaris, kategori, barang tidak laku, dan barang expired.</p>
          </div>
        </header>

        <section className="sales-filter-summary">
          <article className="panel sales-filter-panel">
            <div className="panel__header">
              <div>
                <h2><Filter size={19} /> Filter Penjualan</h2>
              </div>
            </div>
            <div className="sales-filter-body">
              <form className="sales-branch-select" action="/penjualan">
                {searchQuery ? <input name="q" type="hidden" value={searchQuery} /> : null}
                {selectedCategory !== "Semua Kategori" ? <input name="kategori" type="hidden" value={selectedCategory} /> : null}
                <label className="field">
                  <span>Cabang</span>
                  <select name="kode" defaultValue={selectedCode}>
                    <option value="ALL">Semua Cabang</option>
                    {dashboard.branches.map((branch) => (
                      <option value={branch.code} key={branch.code}>
                        {branch.code} - {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="icon-button form-button" type="submit">Pilih</button>
              </form>
              <div className="sales-branch-chip-row">
                <Link className={`filter-chip ${selectedCode === "ALL" ? "filter-chip--active" : ""}`} href="/penjualan">
                  Semua
                </Link>
                {dashboard.branches.map((branch) => (
                  <Link
                    className={`filter-chip filter-chip--branch ${selectedCode === branch.code ? "filter-chip--active" : ""}`}
                    href={`/penjualan?kode=${branch.code}`}
                    key={branch.code}
                    style={{ "--branch-color": getBranchColor(dashboard.branches.findIndex((item) => item.code === branch.code)) } as React.CSSProperties}
                    title={branch.name}
                  >
                    <i />
                    {branch.code}
                  </Link>
                ))}
              </div>
              <div className="sales-branch-summary">
                <div>
                  <span>Cabang aktif</span>
                  <strong>{selectedCode === "ALL" ? "Semua Cabang" : selectedBranchSummary?.name}</strong>
                </div>
                <div>
                  <span>Sinkron terakhir</span>
                  <strong>{selectedBranchSummary ? formatDate(selectedBranchSummary.lastSyncAt) : "Mode dummy aktif"}</strong>
                </div>
                <div>
                  <span>Omzet hari ini</span>
                  <strong>{formatCurrency(selectedBranchSummary?.todaySales ?? dashboard.summary.todaySales)}</strong>
                </div>
                <div>
                  <span>Omzet bulan ini</span>
                  <strong>{formatCurrency(selectedBranchSummary?.monthSales ?? dashboard.summary.monthSales)}</strong>
                </div>
              </div>
            </div>
          </article>

          <article className="panel sales-result-panel">
            <div className="panel__header">
              <div>
                <h2><Search size={19} /> Hasil Pencarian</h2>
              </div>
              <div className="sales-result-actions">
                <button className={`icon-button ${!hasActiveFilter ? "icon-button--disabled" : ""}`} type="button">Export</button>
                <button className={`icon-button ${!hasActiveFilter ? "icon-button--disabled" : ""}`} type="button">Cetak</button>
              </div>
            </div>
            <form className="sales-filter-form sales-filter-form--result" action="/penjualan">
              {selectedCode !== "ALL" ? <input name="kode" type="hidden" value={selectedCode} /> : null}
              <label className="field">
                <span>Nama barang / faktur / pelanggan</span>
                <input name="q" placeholder="Cari produk, faktur, pelanggan, atau cabang" defaultValue={searchQuery} />
              </label>
              <label className="field">
                <span>Kategori</span>
                <select name="kategori" defaultValue={selectedCategory}>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option value={category} key={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sales-filter-actions">
                <button className="icon-button form-button" type="submit"><Filter size={17} /> Terapkan</button>
                <Link className="icon-button form-button" href="/penjualan">Reset</Link>
              </div>
            </form>
            <div className="sales-quick-filters">
              <span>Preset cepat</span>
              <Link href={selectedCode === "ALL" ? "/penjualan?kategori=Minyak%20%26%20Obat" : `/penjualan?kode=${selectedCode}&kategori=Minyak%20%26%20Obat`}>Minyak & Obat</Link>
              <Link href={selectedCode === "ALL" ? "/penjualan?kategori=Makanan" : `/penjualan?kode=${selectedCode}&kategori=Makanan`}>Makanan</Link>
              <Link href={selectedCode === "ALL" ? "/penjualan?kategori=Elektronik" : `/penjualan?kode=${selectedCode}&kategori=Elektronik`}>Elektronik</Link>
            </div>
            <div className="sales-result-body">
              <div>
                <span>Cabang</span>
                <strong>{selectedCode === "ALL" ? "Semua Cabang" : selectedBranch?.selectedBranch.name}</strong>
              </div>
              <div>
                <span>Kategori</span>
                <strong>{selectedCategory}</strong>
              </div>
              <div>
                <span>Kata pencarian</span>
                <strong>{searchQuery || "-"}</strong>
              </div>
              <div>
                <span>Total transaksi</span>
                <strong>{formatNumber(sales.length)}</strong>
              </div>
              <div>
                <span>Total penjualan</span>
                <strong>{formatCurrency(totalSales)}</strong>
              </div>
              <div>
                <span>Estimasi laba</span>
                <strong>{formatCurrency(totalProfit)}</strong>
              </div>
            </div>
            <div className="sales-status-mini">
              {statusSummary.map((item) => (
                <span key={item.status}>
                  {item.status}: <b>{formatNumber(item.count)}</b>
                </span>
              ))}
            </div>
            <div className="stock-search-hint sales-search-hint">
              <Search size={16} />
              <span>Data penjualan hanya ditampilkan setelah memilih cabang, kategori, atau mengetik kata pencarian.</span>
            </div>
          </article>
        </section>

        <section className="sales-kpi-grid">
          <article className="sales-kpi sales-kpi--blue">
            <div>
              <p>Total Penjualan</p>
              <strong>{formatCurrency(totalSales)}</strong>
              <span>{hasActiveFilter ? "Sesuai filter aktif" : "Pilih filter untuk melihat data"}</span>
            </div>
          </article>
          <article className="sales-kpi sales-kpi--purple">
            <div>
              <p>Produk Terlaris</p>
              <strong>{formatNumber(topProducts[0]?.quantity ?? 0)}</strong>
              <span>{topProducts[0]?.name ?? "Sesuai filter aktif"}</span>
            </div>
          </article>
          <article className="sales-kpi sales-kpi--cyan">
            <div>
              <p>Barang Tidak Laku</p>
              <strong>{formatNumber(slowMoving.length)}</strong>
              <span>{hasActiveFilter ? "Stok tinggi dan lambat bergerak" : "Pilih filter untuk melihat data"}</span>
            </div>
          </article>
          <article className="sales-kpi sales-kpi--orange">
            <div>
              <p>Barang Expired</p>
              <strong>{formatNumber(expired.length)}</strong>
              <span>{hasActiveFilter ? "Expired dan mendekati expired" : "Pilih filter untuk melihat data"}</span>
            </div>
          </article>
        </section>

        <section className="sales-chart-grid">
          <article className="panel sales-chart-card">
            <div className="panel__header">
            <div>
              <h2><TrendingUp size={19} /> Penjualan Barang Terlaris</h2>
            </div>
          </div>
            {hasActiveFilter ? (
            <div className="bar-chart">
              {topProducts.slice(0, 5).map((product, index) => (
                <div className="bar-row" key={`${product.name}-${index}`}>
                  <div className="bar-row__label">
                    <strong>{product.name}</strong>
                    <span>{formatCurrency(product.total)}</span>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${Math.max(8, (product.quantity / maxProductQty) * 100)}%`, background: selectedColor }} />
                  </div>
                  <b>{formatNumber(product.quantity)}</b>
                </div>
              ))}
            </div>
            ) : (
              <div className="empty-state empty-state--search">
                <Search size={30} />
                <strong>Gunakan filter untuk melihat grafik</strong>
                <span>Pilih cabang, kategori, atau kata pencarian.</span>
              </div>
            )}
          </article>

          <article className="panel sales-chart-card">
            <div className="panel__header">
              <div>
                <h2><PackageSearch size={19} /> Barang Tidak Laku</h2>
            </div>
          </div>
            {hasActiveFilter ? (
            <ul className="compact-list">
              {slowMoving.slice(0, 5).map((product) => (
                <li key={`${product.branchName}-${product.code}`}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.branchName}</span>
                  </div>
                  <b>{formatNumber(product.stock)}</b>
                </li>
              ))}
            </ul>
            ) : (
              <div className="empty-state empty-state--search">
                <Search size={30} />
                <strong>Belum ada hasil filter</strong>
                <span>Warning barang tidak laku akan tampil sesuai filter.</span>
              </div>
            )}
          </article>

          <article className="panel sales-chart-card">
            <div className="panel__header">
              <div>
                <h2>Penjualan Per Kategori</h2>
              </div>
            </div>
            {hasActiveFilter ? (
              <div className="sales-category-bars">
                {categorySummary.map((item, index) => (
                  <div className="sales-category-row" key={item.category}>
                    <span>{item.category}</span>
                    <div>
                      <i style={{ width: `${Math.max(5, (item.total / maxCategoryTotal) * 100)}%`, background: ["#6478d3", "#61bd6d", "#2f80d9", "#ffaf4d", "#8577e8", "#34b6c8"][index] }} />
                    </div>
                    <b>{formatNumber(item.count)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--search">
                <Search size={30} />
                <strong>Belum ada kategori</strong>
                <span>Ringkasan kategori tampil setelah filter dipakai.</span>
              </div>
            )}
          </article>

          <article className="panel sales-chart-card">
            <div className="panel__header">
              <div>
                <h2>Metode Pembayaran</h2>
              </div>
            </div>
            {hasActiveFilter ? (
              <div className="sales-donut-layout">
                <div className="sales-donut" style={{ background: salesDonut }}>
                  <div>{formatNumber(sales.length)}</div>
                </div>
                <div className="sales-donut-legend">
                  {paymentSummary.map((item, index) => (
                    <span key={item.method}><i style={{ background: paymentColors[index] }} /> {item.method}: {formatNumber(item.count)}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state empty-state--search">
                <Search size={30} />
                <strong>Belum ada metode bayar</strong>
                <span>Metode bayar tampil sesuai hasil filter.</span>
              </div>
            )}
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel panel--wide sales-table-card">
            <div className="panel__header">
              <div>
                <span>Transaksi</span>
                <h2><ReceiptText size={19} /> Resume Data Penjualan</h2>
              </div>
              <div className="panel-actions">
                <span>{hasActiveFilter ? `${formatNumber(sales.length)} transaksi` : "Belum ada pencarian"}</span>
                <strong>25 / halaman</strong>
              </div>
            </div>
            <div className="table-wrap">
              {hasActiveFilter ? (
              <table>
                <thead>
                  <tr>
                    <th>Faktur</th>
                    <th>Cabang</th>
                    <th>Tanggal</th>
                    <th>Pelanggan</th>
                    <th>Kasir</th>
                    <th>Produk</th>
                    <th>Kategori</th>
                    <th>Bayar</th>
                    <th>Status</th>
                    <th className="right">Qty</th>
                    <th className="right">Jumlah</th>
                    <th className="right">Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSales.map((sale) => (
                    <tr key={sale.code}>
                      <td>{sale.code}</td>
                      <td>{sale.branchName}</td>
                      <td>{formatDate(sale.date)}</td>
                      <td>{sale.customer}</td>
                      <td>{sale.cashier}</td>
                      <td>{sale.itemName}</td>
                      <td>{sale.category}</td>
                      <td>{sale.paymentMethod}</td>
                      <td>{sale.status}</td>
                      <td className="right">{formatNumber(sale.quantity)}</td>
                      <td className="right">{formatCurrency(sale.total)}</td>
                      <td className="right">{formatCurrency(sale.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              ) : (
                <div className="empty-state empty-state--search">
                  <Search size={30} />
                  <strong>Gunakan filter untuk menampilkan data penjualan</strong>
                  <span>Pilih cabang, kategori, atau ketik faktur, produk, pelanggan, maupun cabang.</span>
                </div>
              )}
            </div>
            {hasActiveFilter ? (
              <div className="pagination-bar">
                <span>
                  Halaman {formatNumber(safeCurrentPage)} dari {formatNumber(totalPages)} - menampilkan {formatNumber(pageSales.length)} dari {formatNumber(sales.length)} transaksi
                </span>
                <div>
                  <Link className={`icon-button ${safeCurrentPage <= 1 ? "icon-button--disabled" : ""}`} href={paginationHref(Math.max(1, safeCurrentPage - 1))}>
                    Sebelumnya
                  </Link>
                  <Link className={`icon-button ${safeCurrentPage >= totalPages ? "icon-button--disabled" : ""}`} href={paginationHref(Math.min(totalPages, safeCurrentPage + 1))}>
                    Berikutnya
                  </Link>
                </div>
              </div>
            ) : null}
          </article>

          <article className="panel sales-chart-card">
            <div className="panel__header">
              <div>
                <h2><AlertTriangle size={19} /> Barang Expire</h2>
            </div>
          </div>
            {hasActiveFilter ? (
            <ul className="compact-list">
              {expired.slice(0, 12).map((product) => (
                <li key={`${product.branchName}-${product.code}-${product.expiredAt}`}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.branchName} - {formatDate(product.expiredAt)}</span>
                  </div>
                  <b className={product.status === "expired" ? "danger-text" : undefined}>{formatNumber(product.stock)}</b>
                </li>
              ))}
            </ul>
            ) : (
              <div className="empty-state empty-state--search">
                <Search size={30} />
                <strong>Belum ada hasil filter</strong>
                <span>Barang expire akan tampil sesuai hasil pencarian.</span>
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
