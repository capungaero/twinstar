import {
  ArrowLeftRight,
  AlertTriangle,
  Bot,
  Boxes,
  Building2,
  ClipboardCheck,
  Database,
  Filter,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  Save,
  Search,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { getBranchColor } from "@/lib/branch-colors";
import { getBranchDetailData } from "@/lib/legacy-db";
import { CATEGORY_OPTIONS, getProductCategory, matchesCategory, matchesTextSearch } from "@/lib/filters";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    kode?: string;
    q?: string;
    kategori?: string;
  }>;
};

function Sidebar({ active = "cabang" }: { active?: string }) {
  const items = [
    { href: "/", label: "Dashboard", icon: <TrendingUp size={18} />, key: "dashboard" },
    { href: "/cabang", label: "Cabang", icon: <Building2 size={18} />, key: "cabang" },
    { href: "/penjualan", label: "Penjualan", icon: <ReceiptText size={18} />, key: "penjualan" },
    { href: "/stok", label: "Stok", icon: <Boxes size={18} />, key: "stok" },
    { href: "/pencarian-ai", label: "Pencarian AI", icon: <Bot size={18} />, key: "ai" },
    { href: "/#monitor", label: "Status Sinkron", icon: <Database size={18} />, key: "sinkron" }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">
          <Building2 size={22} />
        </div>
        <div>
          <strong>POS Pusat</strong>
          <span>Kelola Cabang</span>
        </div>
      </div>
      <nav className="nav-list" aria-label="Menu utama">
        {items.map((item) => (
          <Link className={`nav-list__item ${active === item.key ? "nav-list__item--active" : ""}`} href={item.href} key={item.key}>
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      <section className="branch-panel">
        <span>Mode Kelola</span>
        <strong>Cabang, stok, transfer</strong>
        <p>Form masih simulasi UI. Integrasi tulis ke database legacy dibuat setelah mapping final.</p>
      </section>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default async function CabangPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getBranchDetailData(params?.kode);
  const selectedBranchIndex = Math.max(0, data.branches.findIndex((branch) => branch.code === data.selectedBranch.code));
  const selectedBranchColor = getBranchColor(selectedBranchIndex);
  const searchQuery = params?.q ?? "";
  const selectedCategory = params?.kategori ?? "Semua Kategori";
  const branchQuery = `kode=${data.selectedBranch.code}`;
  const stockRows = [...data.lowStockProducts, ...data.topStockProducts].filter(
    (product) =>
      matchesTextSearch(searchQuery, [product.code, product.name]) &&
      matchesCategory(selectedCategory, product.name)
  );
  const expiredRows = data.expiringProducts.filter(
    (product) =>
      matchesTextSearch(searchQuery, [product.code, product.name]) &&
      matchesCategory(selectedCategory, product.name)
  );
  const primaryProduct = stockRows[0] ?? data.topStockProducts[0] ?? data.lowStockProducts[0];

  return (
    <main className="shell">
      <Sidebar />
      <section className="content">
        <header className="topbar branch-hero" style={{ "--branch-color": selectedBranchColor } as React.CSSProperties}>
          <div>
            <span className="eyebrow">Kelola Cabang</span>
            <h1>{data.selectedBranch.name}</h1>
            <p>Pilih cabang untuk melihat stok, menyiapkan koreksi stok, dan membuat transfer barang.</p>
          </div>
          <div className="actions">
            <button className="icon-button" type="button">
              <Save size={18} />
              Simpan Draft
            </button>
          </div>
        </header>

        <section className="branch-selector panel branch-selector--colorful">
          <div className="panel__header">
            <div>
              <span>Pilih Cabang</span>
              <h2>Daftar Cabang</h2>
            </div>
          </div>
          <div className="branch-tabs">
            {data.branches.map((branch) => (
              <Link
                className={`branch-tab ${branch.code === data.selectedBranch.code ? "branch-tab--active" : ""}`}
                href={`/cabang?kode=${branch.code}`}
                key={branch.code}
                style={{ "--branch-color": getBranchColor(data.branches.findIndex((item) => item.code === branch.code)) } as React.CSSProperties}
              >
                <span className="branch-tab__code">
                  <i />
                  {branch.code}
                </span>
                <strong>{branch.name}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="metrics-grid detail-metrics">
          <article className="metric-card">
            <div className="metric-card__icon branch-icon" style={{ "--branch-color": selectedBranchColor } as React.CSSProperties}>
              <Boxes size={22} />
            </div>
            <div>
              <p>Stok Toko</p>
              <strong>{formatNumber(data.summary.stockStore)}</strong>
              <span>{formatNumber(data.summary.stockLimit)} stok limit</span>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-card__icon branch-icon branch-icon--warning" style={{ "--branch-color": selectedBranchColor } as React.CSSProperties}>
              <PackagePlus size={22} />
            </div>
            <div>
              <p>Stok Kosong</p>
              <strong>{formatNumber(data.summary.stockResume.emptyItems)}</strong>
              <span>{formatNumber(data.summary.stockResume.expiredItems)} expired</span>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-card__icon branch-icon" style={{ "--branch-color": selectedBranchColor } as React.CSSProperties}>
              <ReceiptText size={22} />
            </div>
            <div>
              <p>Omzet Bulan Ini</p>
              <strong>{formatCurrency(data.summary.monthSales)}</strong>
              <span>{formatNumber(data.summary.transactions)} transaksi</span>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-card__icon branch-icon" style={{ "--branch-color": selectedBranchColor } as React.CSSProperties}>
              <ClipboardCheck size={22} />
            </div>
            <div>
              <p>Status Sync</p>
              <strong>{data.summary.status === "warning" ? "Perlu Cek" : "Aktif"}</strong>
              <span>{data.selectedBranch.database}</span>
            </div>
          </article>
        </section>

        <section className="management-grid">
          <article className="panel">
            <div className="panel__header">
              <div>
                <span>Stok</span>
                <h2><PackagePlus size={19} /> Tambah / Edit Stock</h2>
              </div>
            </div>
            <form className="form-grid">
              <Field label="Kode barang">
                <input defaultValue={primaryProduct?.code ?? ""} />
              </Field>
              <Field label="Nama barang">
                <input defaultValue={primaryProduct?.name ?? ""} />
              </Field>
              <Field label="Stok sistem">
                <input defaultValue={primaryProduct?.stock ?? 0} type="number" />
              </Field>
              <Field label="Stok baru">
                <input placeholder="Masukkan stok fisik" type="number" />
              </Field>
              <Field label="Alasan">
                <select defaultValue="stok-opname">
                  <option value="stok-opname">Stok opname</option>
                  <option value="rusak">Barang rusak</option>
                  <option value="expired">Barang expired</option>
                  <option value="koreksi">Koreksi administrasi</option>
                </select>
              </Field>
              <button className="icon-button form-button" type="button">
                <Save size={17} />
                Buat Draft Koreksi
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="panel__header">
              <div>
                <span>Transfer</span>
                <h2><ArrowLeftRight size={19} /> Transfer Barang</h2>
              </div>
            </div>
            <form className="form-grid">
              <Field label="Dari cabang">
                <input defaultValue={data.selectedBranch.name} />
              </Field>
              <Field label="Ke cabang">
                <select defaultValue="C01">
                  {data.branches
                    .filter((branch) => branch.code !== data.selectedBranch.code)
                    .map((branch) => (
                      <option value={branch.code} key={branch.code}>
                        {branch.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Barang">
                <input defaultValue={primaryProduct?.name ?? ""} />
              </Field>
              <Field label="Jumlah transfer">
                <input placeholder="0" type="number" />
              </Field>
              <Field label="Catatan">
                <input placeholder="Keterangan transfer" />
              </Field>
              <button className="icon-button form-button" type="button">
                <ArrowLeftRight size={17} />
                Buat Draft Transfer
              </button>
            </form>
          </article>
        </section>

        <section className="panel search-panel">
          <div className="panel__header">
            <div>
              <span>Pencarian</span>
              <h2><Search size={19} /> Filter Barang Cabang</h2>
            </div>
          </div>
          <form className="search-form" action="/cabang">
            <input name="kode" type="hidden" value={data.selectedBranch.code} />
            <Field label="Nama / kode barang">
              <input name="q" placeholder="Cari nama atau kode barang" defaultValue={searchQuery} />
            </Field>
            <Field label="Kategori">
              <select name="kategori" defaultValue={selectedCategory}>
                {CATEGORY_OPTIONS.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <button className="icon-button form-button" type="submit"><Filter size={17} /> Terapkan Filter</button>
            <Link className="icon-button form-button" href={`/cabang?${branchQuery}`}>Reset</Link>
          </form>
        </section>

        <section className="dashboard-grid">
          <article className="panel panel--wide">
            <div className="panel__header">
              <div>
                <span>Stok</span>
                <h2><PackageCheck size={19} /> Stock Barang Cabang</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Barang</th>
                    <th className="right">Stok</th>
                    <th className="right">Minimum</th>
                    <th className="right">Harga</th>
                    <th>Kategori</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((product, index) => {
                    const isLimit = "minimum" in product;
                    const minimum = isLimit ? (product as { minimum: number }).minimum : undefined;
                    const rowType = isLimit ? "limit" : "safe";

                    return (
                      <tr key={`${rowType}-${product.code}-${product.name}-${index}`}>
                        <td>{product.code}</td>
                        <td>{product.name}</td>
                        <td className="right">{formatNumber(product.stock)}</td>
                        <td className="right">{minimum === undefined ? "-" : formatNumber(minimum)}</td>
                        <td className="right">{formatCurrency(product.price)}</td>
                        <td>{getProductCategory(product.name)}</td>
                        <td>
                          <span
                            className={`badge branch-status-badge ${isLimit ? "branch-status-badge--warning" : "branch-status-badge--safe"}`}
                            style={{ "--branch-color": selectedBranchColor } as React.CSSProperties}
                          >
                            {isLimit ? <AlertTriangle size={13} /> : <PackageCheck size={13} />}
                            {isLimit ? "Limit" : "Aman"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel">
            <div className="panel__header">
              <div>
                <span>Expired</span>
                <h2><AlertTriangle size={19} /> Barang Expired</h2>
              </div>
            </div>
            <ul className="compact-list">
              {expiredRows.map((product) => (
                <li key={`${product.code}-${product.expiredAt}`}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatDate(product.expiredAt)}</span>
                  </div>
                  <b className={product.status === "expired" ? "danger-text" : undefined}>
                    {formatNumber(product.stock)}
                  </b>
                </li>
              ))}
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}
