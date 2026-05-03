import {
  AlertTriangle,
  Bot,
  Boxes,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Database,
  Download,
  RefreshCcw,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards
} from "lucide-react";
import Link from "next/link";
import { BRANCH_COLORS } from "@/lib/branch-colors";
import { DashboardRevenueClient } from "@/app/components/DashboardRevenueClient";
import { getDashboardData } from "@/lib/legacy-db";
import { formatCurrency, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type DashboardTimeframe = "mingguan" | "bulanan" | "tahunan" | "rentang";

type PageProps = {
  searchParams?: Promise<{
    ranking?: string;
    timeframe?: string;
    start?: string;
    end?: string;
  }>;
};

function MetricCard({
  label,
  value,
  sublabel,
  icon,
  tone = "default"
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{sublabel}</span>
      </div>
    </article>
  );
}

function Sidebar({ connected, branchCount }: { connected: boolean; branchCount: number }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">
          <Building2 size={22} />
        </div>
        <div>
          <strong>POS Pusat</strong>
          <span>Dashboard Multi Cabang</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Menu utama">
        <Link className="nav-list__item nav-list__item--active" href="/">
          <TrendingUp size={18} />
          Dashboard
        </Link>
        <Link className="nav-list__item" href="/cabang">
          <Building2 size={18} />
          Cabang
        </Link>
        <Link className="nav-list__item" href="/penjualan">
          <ReceiptText size={18} />
          Penjualan
        </Link>
        <Link className="nav-list__item" href="/stok">
          <Boxes size={18} />
          Stok
        </Link>
        <Link className="nav-list__item" href="/pencarian-ai">
          <Bot size={18} />
          Pencarian AI
        </Link>
        <a className="nav-list__item" href="#monitor">
          <Database size={18} />
          Status Sinkron
        </a>
      </nav>

      <section className="branch-panel" id="monitor">
        <span>Simulasi Cabang</span>
        <strong>{branchCount} cabang aktif</strong>
        <p>Semua cabang memakai data dummy internal.</p>
        <div className={connected ? "status status--online" : "status status--offline"}>
          <span />
          {connected ? "Mode dummy aktif" : "Mode dummy gagal"}
        </div>
      </section>
    </aside>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const rankingMode = params?.ranking === "item" ? "item" : "pendapatan";
  const requestedTimeframe = params?.timeframe ?? "";
  const timeframe: DashboardTimeframe = ["mingguan", "bulanan", "tahunan", "rentang"].includes(requestedTimeframe)
    ? (requestedTimeframe as DashboardTimeframe)
    : "bulanan";
  const startDate = params?.start ?? "";
  const endDate = params?.end ?? "";
  const data = await getDashboardData();
  const branchColors = BRANCH_COLORS;
  const generatedAt = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta"
  }).format(new Date(data.generatedAt));
  const latestSyncAt = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta"
  }).format(
    new Date(
      Math.max(...(data.branchSummaries.length ? data.branchSummaries.map((branch) => new Date(branch.lastSyncAt).getTime()) : [new Date(data.generatedAt).getTime()]))
    )
  );

  const stockResume = data.branchSummaries.reduce(
    (total, branch) => ({
      totalItems: total.totalItems + branch.stockResume.totalItems,
      safeItems: total.safeItems + branch.stockResume.safeItems,
      lowItems: total.lowItems + branch.stockResume.lowItems,
      emptyItems: total.emptyItems + branch.stockResume.emptyItems,
      expiredItems: total.expiredItems + branch.stockResume.expiredItems
    }),
    { totalItems: 0, safeItems: 0, lowItems: 0, emptyItems: 0, expiredItems: 0 }
  );

  return (
    <main className="shell">
      <Sidebar connected={data.connected} branchCount={data.branches.length} />

      <section className="content">
        <header className="topbar hero-dashboard">
          <div>
            <span className="eyebrow">Ringkasan global 10 cabang</span>
            <h1>Dashboard Pusat</h1>
            <p>Resume transaksi, pendapatan, stok warning, dan ranking performa cabang.</p>
          </div>
          <div className="actions">
            <Link className="icon-button" href="/" title="Refresh manual">
              <RefreshCcw size={18} />
              Refresh
            </Link>
            <button className="icon-button" type="button" title="Export laporan belum diaktifkan">
              <Download size={18} />
              Export
            </button>
          </div>
        </header>

        {data.error ? (
          <section className="notice notice--danger">
            <AlertTriangle size={20} />
            <div>
              <strong>Mode dummy belum bisa dibuat.</strong>
              <p>{data.error}</p>
            </div>
          </section>
        ) : null}

        <section className="sync-strip">
          <div>
            <Clock3 size={18} />
            <span>Terakhir dibaca: {generatedAt} WIB</span>
          </div>
          <div>
            <RefreshCcw size={18} />
            <span>Terakhir sinkronisasi data: {latestSyncAt} WIB</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>Mode simulasi: ringkasan global dari 10 cabang dummy</span>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Ringkasan dashboard">
          <MetricCard
            label="Omzet Hari Ini"
            value={formatCurrency(data.summary.todaySales)}
            sublabel={`Gabungan ${data.branches.length} cabang`}
            icon={<CircleDollarSign size={22} />}
            tone="success"
          />
          <MetricCard
            label="Omzet Bulan Ini"
            value={formatCurrency(data.summary.monthSales)}
            sublabel="Periode berjalan"
            icon={<Sparkles size={22} />}
          />
          <MetricCard
            label="Total Transaksi"
            value={formatNumber(data.branchSummaries.reduce((sum, branch) => sum + branch.transactions, 0))}
            sublabel="Simulasi transaksi cabang"
            icon={<ReceiptText size={22} />}
          />
          <MetricCard
            label="Warning Expired"
            value={formatNumber(stockResume.expiredItems)}
            sublabel={`${formatNumber(stockResume.lowItems)} stok limit`}
            icon={<AlertTriangle size={22} />}
            tone="warning"
          />
          <MetricCard
            label="Piutang"
            value={formatCurrency(data.summary.receivables)}
            sublabel="Gabungan cabang"
            icon={<WalletCards size={22} />}
          />
          <MetricCard
            label="Hutang Supplier"
            value={formatCurrency(data.summary.payables)}
            sublabel="Gabungan cabang"
            icon={<CalendarDays size={22} />}
          />
        </section>

        <DashboardRevenueClient
          branchColors={branchColors}
          branchSummaries={data.branchSummaries}
          expiringProducts={data.expiringProducts}
          initialEndDate={endDate}
          initialRankingMode={rankingMode}
          initialStartDate={startDate}
          initialTimeframe={timeframe}
          lowStockProducts={data.lowStockProducts}
          stockResume={stockResume}
          topStockProducts={data.topStockProducts}
          todaySales={data.summary.todaySales}
        />
      </section>
    </main>
  );
}
