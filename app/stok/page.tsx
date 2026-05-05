import { AlertTriangle, Bot, Boxes, Building2, Clock3, Database, Filter, Layers3, PackageCheck, PackageMinus, ReceiptText, RefreshCcw, Search, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";
import { getBranchColor } from "@/lib/branch-colors";
import { getDashboardData } from "@/lib/legacy-db";
import { CATEGORY_OPTIONS, getProductCategory, matchesCategory, matchesTextSearch } from "@/lib/filters";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    cabang?: string;
    status?: string;
    view?: string;
    q?: string;
    kategori?: string;
    page?: string;
  }>;
};

function Sidebar() {
  const items = [
    { href: "/", label: "Dashboard", icon: <TrendingUp size={18} /> },
    { href: "/cabang", label: "Cabang", icon: <Building2 size={18} /> },
    { href: "/penjualan", label: "Penjualan", icon: <ReceiptText size={18} /> },
    { href: "/stok", label: "Stok", icon: <Boxes size={18} />, active: true },
    { href: "/pencarian-ai", label: "Pencarian AI", icon: <Bot size={18} /> },
    { href: "/#monitor", label: "Status Sinkron", icon: <Database size={18} /> }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">
          <Boxes size={22} />
        </div>
        <div>
          <strong>POS Pusat</strong>
          <span>Stock Barang</span>
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
        <span>Filter Stok</span>
        <strong>Item, cabang, status</strong>
        <p>Lihat stok berdasarkan barang, cabang, atau status expired.</p>
      </section>
    </aside>
  );
}

export default async function StokPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getDashboardData();
  const selectedBranch = params?.cabang || "ALL";
  const selectedStatus = params?.status || "all";
  const selectedView = params?.view || "item";
  const selectedBranchIndex = Math.max(0, data.branches.findIndex((branch) => branch.code === selectedBranch));
  const selectedColor = selectedBranch === "ALL" ? "#0f766e" : getBranchColor(selectedBranchIndex);
  const searchQuery = params?.q ?? "";
  const selectedCategory = params?.kategori ?? "Semua Kategori";
  const currentPage = Math.max(1, Number(params?.page ?? 1) || 1);
  const pageSize = 50;
  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    selectedCategory !== "Semua Kategori" ||
    selectedBranch !== "ALL" ||
    selectedStatus !== "all";
  const selectedBranchName = data.branches.find((branch) => branch.code === selectedBranch)?.name;
  const branchMatches = (branchName: string) => selectedBranch === "ALL" || branchName === selectedBranchName;
  const productMatches = (product: { code: string; name: string; branchName: string }) =>
    branchMatches(product.branchName) &&
    matchesTextSearch(searchQuery, [product.code, product.name, product.branchName]) &&
    matchesCategory(selectedCategory, product.name);
  const lowStock = data.lowStockProducts.filter(productMatches);
  const safeStock = data.topStockProducts.filter(productMatches);
  const expiredStock = data.expiringProducts.filter(productMatches);
  const filteredRows = selectedStatus === "expired" ? expiredStock : selectedStatus === "limit" ? lowStock : [...lowStock, ...safeStock];
  const rows = hasActiveFilter ? filteredRows : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageRows = rows.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const paginationHref = (page: number) => {
    const query = new URLSearchParams();
    query.set("cabang", selectedBranch);
    query.set("status", selectedStatus);
    query.set("view", selectedView);
    if (searchQuery) query.set("q", searchQuery);
    if (selectedCategory !== "Semua Kategori") query.set("kategori", selectedCategory);
    query.set("page", String(page));

    return `/stok?${query.toString()}`;
  };
  const statusTiles = [
    { label: "Aman", value: hasActiveFilter ? safeStock.length : 0, tone: "safe", icon: <PackageCheck size={22} /> },
    { label: "Stok Limit", value: hasActiveFilter ? lowStock.length : 0, tone: "warning", icon: <PackageMinus size={22} /> },
    { label: "Expired", value: hasActiveFilter ? expiredStock.filter((item) => item.status === "expired").length : 0, tone: "danger", icon: <AlertTriangle size={22} /> },
    { label: "Mendekati Exp", value: hasActiveFilter ? expiredStock.filter((item) => item.status === "soon").length : 0, tone: "warning", icon: <Clock3 size={22} /> }
  ];

  return (
    <main className="shell">
      <Sidebar />
      <section className="content stok-content">
        <header className="topbar hero-dashboard">
          <div>
            <span className="eyebrow">Manajemen Stok · {data.branches.length} Cabang</span>
            <h1>Stok Barang</h1>
            <p>Lihat stok berdasarkan item, cabang, dan status termasuk mendekati expired.</p>
          </div>
          <div className="actions">
            <Link className="icon-button" href="/stok" title="Reset semua filter">
              <RefreshCcw size={18} />
              Reset
            </Link>
          </div>
        </header>

        <section className="sync-strip">
          <div>
            <Boxes size={18} />
            <span>Tampilan: {selectedView === "item" ? "Per item" : "Per cabang"}</span>
          </div>
          <div>
            <Building2 size={18} />
            <span>Cabang: {selectedBranch === "ALL" ? "Semua cabang" : (selectedBranchName ?? selectedBranch)}</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>Data simulasi dummy aktif</span>
          </div>
        </section>

        <section className="branch-selector panel stock-toolbar">
          <div className="panel__header">
            <div>
              <span>Filter</span>
              <h2><Filter size={19} /> Cabang dan Status</h2>
            </div>
          </div>
          <div className="stock-toolbar__body">
            <div className="stock-filter-group">
              <span>Cabang</span>
              <div className="branch-tabs branch-tabs--compact">
                <Link
                  className={`branch-tab ${selectedBranch === "ALL" ? "branch-tab--active" : ""}`}
                  href={`/stok?status=${selectedStatus}&view=${selectedView}&q=${encodeURIComponent(searchQuery)}&kategori=${encodeURIComponent(selectedCategory)}`}
                  style={{ "--branch-color": "#0f766e" } as React.CSSProperties}
                >
                  <span>ALL</span>
                  <strong>Semua Cabang</strong>
                </Link>
                {data.branches.map((branch) => (
                  <Link
                    className={`branch-tab ${selectedBranch === branch.code ? "branch-tab--active" : ""}`}
                    href={`/stok?cabang=${branch.code}&status=${selectedStatus}&view=${selectedView}&q=${encodeURIComponent(searchQuery)}&kategori=${encodeURIComponent(selectedCategory)}`}
                    key={branch.code}
                    style={{ "--branch-color": getBranchColor(data.branches.findIndex((item) => item.code === branch.code)) } as React.CSSProperties}
                  >
                    <span className="branch-tab__code"><i />{branch.code}</span>
                    <strong>{branch.name}</strong>
                  </Link>
                ))}
              </div>
            </div>
            <div className="stock-filter-group">
              <span>Status</span>
              <div className="filter-row">
                {[
                  ["all", "Semua"],
                  ["limit", "Stok Limit"],
                  ["expired", "Expired"]
                ].map(([value, label]) => (
                  <Link className={`filter-chip ${selectedStatus === value ? "filter-chip--active" : ""}`} href={`/stok?cabang=${selectedBranch}&status=${value}&view=${selectedView}&q=${encodeURIComponent(searchQuery)}&kategori=${encodeURIComponent(selectedCategory)}`} key={value}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="stock-filter-group">
              <span>Tampilan</span>
              <div className="filter-row">
                {[
                  ["item", "Item"],
                  ["cabang", "Cabang"]
                ].map(([value, label]) => (
                  <Link className={`filter-chip ${selectedView === value ? "filter-chip--active" : ""}`} href={`/stok?cabang=${selectedBranch}&status=${selectedStatus}&view=${value}&q=${encodeURIComponent(searchQuery)}&kategori=${encodeURIComponent(selectedCategory)}`} key={value}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <form className="stock-search-form" action="/stok">
              <input name="cabang" type="hidden" value={selectedBranch} />
              <input name="status" type="hidden" value={selectedStatus} />
              <input name="view" type="hidden" value={selectedView} />
              <label className="field">
                <span>Nama / kode barang</span>
                <input name="q" placeholder="Cari nama atau kode barang" defaultValue={searchQuery} />
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
              <button className="icon-button form-button" type="submit"><Search size={17} /> Cari</button>
              <Link className="icon-button form-button" href={`/stok?cabang=${selectedBranch}&status=${selectedStatus}&view=${selectedView}`}>Reset</Link>
            </form>
            <div className="stock-search-hint">
              <Search size={16} />
              <span>Daftar stok hanya ditampilkan setelah memakai filter cabang, status, kategori, atau kata pencarian.</span>
            </div>
          </div>
        </section>

        <section className="stock-status-strip">
          {statusTiles.map((tile) => (
            <article className={`stock-status-card stock-status-card--${tile.tone}`} key={tile.label}>
              <div className="stock-status-card__icon">{tile.icon}</div>
              <div>
                <span>{tile.label}</span>
                <strong>{formatNumber(tile.value)}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className="metrics-grid detail-metrics">
          <article className="metric-card">
            <div className="metric-card__icon branch-icon" style={{ "--branch-color": selectedColor } as React.CSSProperties}><Boxes size={22} /></div>
            <div><p>Total Baris</p><strong>{formatNumber(rows.length)}</strong><span>Hasil filter aktif</span></div>
          </article>
          <article className="metric-card metric-card--warning">
            <div className="metric-card__icon branch-icon branch-icon--warning" style={{ "--branch-color": selectedColor } as React.CSSProperties}><AlertTriangle size={22} /></div>
            <div><p>Stok Limit</p><strong>{formatNumber(lowStock.length)}</strong><span>Butuh restock</span></div>
          </article>
          <article className="metric-card metric-card--warning">
            <div className="metric-card__icon branch-icon branch-icon--warning" style={{ "--branch-color": selectedColor } as React.CSSProperties}><AlertTriangle size={22} /></div>
            <div><p>Expired</p><strong>{formatNumber(expiredStock.length)}</strong><span>Mendekati/sudah expired</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-card__icon branch-icon" style={{ "--branch-color": selectedColor } as React.CSSProperties}><Building2 size={22} /></div>
            <div><p>Mode Lihat</p><strong>{selectedView === "item" ? "Item" : "Cabang"}</strong><span>{selectedBranch === "ALL" ? "Semua cabang" : selectedBranch}</span></div>
          </article>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span>Daftar</span>
              <h2><Layers3 size={19} /> {selectedView === "item" ? "Stok Berdasarkan Item" : "Stok Berdasarkan Cabang"}</h2>
            </div>
            <div className="panel-actions">
              <span>{hasActiveFilter ? `${formatNumber(rows.length)} hasil` : "Belum ada pencarian"}</span>
              <strong>50 / halaman</strong>
            </div>
          </div>
          <div className="table-wrap stock-table-wrap">
            {hasActiveFilter ? (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Cabang</th>
                    <th>Kode</th>
                    <th>Nama Barang</th>
                    <th className="right">Stok</th>
                    <th>Status</th>
                    <th>Kategori</th>
                    <th>Expired</th>
                    <th className="right">Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((product, index) => {
                    const isExpiredRow = "expiredAt" in product;
                    const rowType = isExpiredRow ? `expired-${product.expiredAt}` : "stock";

                    return (
                      <tr key={`${product.branchName}-${product.code}-${rowType}-${safeCurrentPage}-${index}`}>
                        <td>{product.branchName}</td>
                        <td>{product.code}</td>
                        <td>{product.name}</td>
                        <td className="right">{formatNumber(product.stock)}</td>
                        <td>
                          <span
                            className={`badge branch-status-badge ${isExpiredRow ? product.status === "expired" ? "branch-status-badge--danger" : "branch-status-badge--warning" : "minimum" in product ? "branch-status-badge--warning" : "branch-status-badge--safe"}`}
                            style={{ "--branch-color": selectedColor } as React.CSSProperties}
                          >
                            {isExpiredRow || "minimum" in product ? <AlertTriangle size={13} /> : <PackageCheck size={13} />}
                            {isExpiredRow ? product.status === "expired" ? "Expired" : "Mendekati" : "minimum" in product ? "Limit" : "Aman"}
                          </span>
                        </td>
                        <td>{getProductCategory(product.name)}</td>
                        <td>{isExpiredRow ? formatDate(product.expiredAt) : "-"}</td>
                        <td className="right">{"price" in product ? formatCurrency(product.price) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state empty-state--search">
                <Search size={30} />
                <strong>Gunakan filter untuk menampilkan data stok</strong>
                <span>Pilih cabang, status, kategori, atau ketik nama/kode barang terlebih dahulu.</span>
              </div>
            )}
          </div>
          {hasActiveFilter ? (
            <div className="pagination-bar">
              <span>
                Halaman {formatNumber(safeCurrentPage)} dari {formatNumber(totalPages)} - menampilkan {formatNumber(pageRows.length)} dari {formatNumber(rows.length)} data
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
        </section>
      </section>
    </main>
  );
}
