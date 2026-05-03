"use client";

import { AlertTriangle, Boxes, CheckCircle2, Crown, PackageCheck, PackageX } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/format";

type Timeframe = "mingguan" | "bulanan" | "tahunan" | "rentang";
type RankingMode = "pendapatan" | "item";
type TrendRange = "minggu" | "bulan" | "tahun";

type BranchSummary = {
  code: string;
  name: string;
  status: string;
  lastSyncAt: string;
  todaySales: number;
  monthSales: number;
  grossProfit: number;
  stockStore: number;
  stockLimit: number;
  receivables: number;
  payables: number;
  transactions: number;
  topProduct: string;
  topProductQty: number;
  stockResume: {
    totalItems: number;
    safeItems: number;
    lowItems: number;
    emptyItems: number;
    expiredItems: number;
  };
};

type StockProduct = {
  code: string;
  branchName: string;
  name: string;
  stock: number;
  minimum?: number;
  price: number;
};

type ExpiringProduct = {
  code: string;
  branchName: string;
  name: string;
  expiredAt: string | null;
  stock: number;
  status: "expired" | "soon";
};

type StockModalType = "safe" | "limit" | "empty" | "expired";

type StockModalState = {
  branchCode?: string;
  branchName?: string;
  title: string;
  type: StockModalType;
};

type ChartBranch = BranchSummary & {
  chartSales: number;
  chartTodaySales: number;
  chartTransactions: number;
};

type Props = {
  branchColors: string[];
  branchSummaries: BranchSummary[];
  expiringProducts: ExpiringProduct[];
  initialEndDate: string;
  initialRankingMode: RankingMode;
  initialStartDate: string;
  initialTimeframe: Timeframe;
  lowStockProducts: StockProduct[];
  stockResume: BranchSummary["stockResume"];
  topStockProducts: StockProduct[];
  todaySales: number;
};

function seededRatio(seed: string, min: number, max: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const normalized = (hash >>> 0) / 4294967295;
  return min + normalized * (max - min);
}

function getTimeframeScale(timeframe: Timeframe, startDate: string, endDate: string) {
  if (timeframe === "mingguan") return 0.28;
  if (timeframe === "tahunan") return 11.8;
  if (timeframe === "rentang") {
    const start = startDate ? new Date(startDate).getTime() : Number.NaN;
    const end = endDate ? new Date(endDate).getTime() : Number.NaN;
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const days = Math.max(1, Math.ceil((end - start) / 86_400_000) + 1);
      return Math.max(0.12, days / 30);
    }
  }

  return 1;
}

function getTimeframeLabel(timeframe: Timeframe, startDate: string, endDate: string) {
  if (timeframe === "mingguan") return "Mingguan";
  if (timeframe === "tahunan") return "Tahunan";
  if (timeframe === "rentang") return startDate && endDate ? `${startDate} sampai ${endDate}` : "Rentang tanggal";
  return "Bulanan";
}

function TimeframeControls({
  draftEndDate,
  draftStartDate,
  setDraftEndDate,
  setDraftStartDate,
  setEndDate,
  setStartDate,
  setTimeframe,
  timeframe
}: {
  draftEndDate: string;
  draftStartDate: string;
  setDraftEndDate: (value: string) => void;
  setDraftStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setStartDate: (value: string) => void;
  setTimeframe: (value: Timeframe) => void;
  timeframe: Timeframe;
}) {
  return (
    <div className="timeframe-toolbar">
      <div className="segmented-control" aria-label="Pilih timeframe pendapatan">
        {[
          ["mingguan", "Mingguan"],
          ["bulanan", "Bulanan"],
          ["tahunan", "Tahunan"],
          ["rentang", "Rentang"]
        ].map(([value, label]) => (
          <button
            className={`segmented-control__item ${timeframe === value ? "segmented-control__item--active" : ""}`}
            key={value}
            onClick={() => setTimeframe(value as Timeframe)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="date-range-form"
        onSubmit={(event) => {
          event.preventDefault();
          setStartDate(draftStartDate);
          setEndDate(draftEndDate);
          setTimeframe("rentang");
        }}
      >
        <label>
          <span>Dari</span>
          <input name="start" type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} />
        </label>
        <label>
          <span>Sampai</span>
          <input name="end" type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} />
        </label>
        <button className="icon-button" type="submit">
          Terapkan
        </button>
      </form>
    </div>
  );
}

export function DashboardRevenueClient({
  branchColors,
  branchSummaries,
  expiringProducts,
  initialEndDate,
  initialRankingMode,
  initialStartDate,
  initialTimeframe,
  lowStockProducts,
  stockResume,
  topStockProducts,
  todaySales
}: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [rankingMode, setRankingMode] = useState<RankingMode>(initialRankingMode);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [draftStartDate, setDraftStartDate] = useState(initialStartDate);
  const [draftEndDate, setDraftEndDate] = useState(initialEndDate);
  const [trendRange, setTrendRange] = useState<TrendRange>("minggu");
  const [stockModal, setStockModal] = useState<StockModalState | null>(null);

  const timeframeLabel = getTimeframeLabel(timeframe, startDate, endDate);
  const chartBranches = useMemo<ChartBranch[]>(() => {
    const timeframeScale = getTimeframeScale(timeframe, startDate, endDate);
    const rangeSeed = timeframe === "rentang" ? `${startDate || "awal"}:${endDate || "akhir"}` : timeframe;

    return branchSummaries.map((branch, index) => {
      const baseSeed = `${rangeSeed}:${branch.code}:${index}`;
      const branchFactor =
        timeframe === "mingguan"
          ? seededRatio(baseSeed, 0.58, 1.42)
          : timeframe === "tahunan"
            ? seededRatio(baseSeed, 0.64, 1.56)
            : timeframe === "rentang"
              ? seededRatio(baseSeed, 0.5, 1.62)
              : seededRatio(baseSeed, 0.82, 1.22);
      const transactionFactor = seededRatio(`${rangeSeed}:trx:${branch.code}`, 0.72, 1.28);
      const todayFactor = seededRatio(`${rangeSeed}:today:${branch.code}`, 0.62, 1.38);

      return {
        ...branch,
        chartSales: Math.max(1, Math.round(branch.monthSales * timeframeScale * branchFactor)),
        chartTodaySales: Math.max(1, Math.round(branch.todaySales * timeframeScale * todayFactor)),
        chartTransactions: Math.max(1, Math.round(branch.transactions * timeframeScale * transactionFactor))
      };
    });
  }, [branchSummaries, endDate, startDate, timeframe]);

  const maxMonthSales = Math.max(...chartBranches.map((branch) => branch.chartSales), 1);
  const rankedBranches = [...chartBranches].sort((a, b) => b.chartSales - a.chartSales);
  const rankedByItems = [...branchSummaries].sort((a, b) => b.topProductQty - a.topProductQty);
  const maxItemsSold = Math.max(...branchSummaries.map((branch) => branch.topProductQty), 1);
  const totalMonthSales = chartBranches.reduce((sum, branch) => sum + branch.chartSales, 0) || 1;
  const timeframeControls = (
    <TimeframeControls
      draftEndDate={draftEndDate}
      draftStartDate={draftStartDate}
      setDraftEndDate={setDraftEndDate}
      setDraftStartDate={setDraftStartDate}
      setEndDate={setEndDate}
      setStartDate={setStartDate}
      setTimeframe={setTimeframe}
      timeframe={timeframe}
    />
  );
  let donutCursor = 0;
  const donutGradient = chartBranches
    .map((branch, index) => {
      const start = donutCursor;
      const size = (branch.chartSales / totalMonthSales) * 360;
      donutCursor += size;
      return `${branchColors[index % branchColors.length]} ${start}deg ${donutCursor}deg`;
    })
    .join(", ");
  const trendConfig =
    trendRange === "bulan"
      ? {
          labels: ["M1", "M2", "M3", "M4"],
          base: totalMonthSales / 4,
          factors: [0.82, 1.16, 0.94, 1.28],
          title: "Pendapatan Per Bulan"
        }
      : trendRange === "tahun"
        ? {
            labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
            base: totalMonthSales,
            factors: [0.74, 0.83, 0.96, 0.88, 1.12, 1.22, 1.04, 1.35, 1.18, 1.29, 1.42, 1.55],
            title: "Pendapatan Per Tahun"
          }
        : {
            labels: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
            base: todaySales,
            factors: [0.72, 0.8, 0.88, 0.96, 1.04, 1.12, 1.2],
            title: "Pendapatan Per Minggu"
          };
  const trendRevenue = trendConfig.labels.map((label, index) => ({
    label,
    amount: Math.round(trendConfig.base * trendConfig.factors[index])
  }));
  const maxTrend = Math.max(...trendRevenue.map((item) => item.amount), 1);
  const xStep = trendRevenue.length > 1 ? 540 / (trendRevenue.length - 1) : 90;
  const linePoints = trendRevenue.map((item, index) => {
    const x = 48 + index * xStep;
    const y = 230 - (item.amount / maxTrend) * 170;
    return { ...item, x, y };
  });
  const linePath = linePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${linePoints[linePoints.length - 1]?.x ?? 0} 248 L ${linePoints[0]?.x ?? 0} 248 Z`;
  const branchNameByCode = useMemo(
    () => new Map(branchSummaries.map((branch) => [branch.code, branch.name])),
    [branchSummaries]
  );
  const stockModalItems = useMemo(() => {
    if (!stockModal) return [];

    const branchName = stockModal.branchCode ? branchNameByCode.get(stockModal.branchCode) : undefined;
    const sameBranch = (product: { branchName: string }) => !branchName || product.branchName === branchName;
    const branchLimit = stockModal.branchCode
      ? branchSummaries.find((branch) => branch.code === stockModal.branchCode)?.stockResume
      : undefined;

    if (stockModal.type === "safe") {
      return branchSummaries.flatMap((branch) => {
        if (stockModal.branchCode && branch.code !== stockModal.branchCode) return [];
        return topStockProducts
          .filter((product) => product.branchName === branch.name)
          .slice(0, branch.stockResume.safeItems)
          .map((product) => ({
            code: product.code,
            name: product.name,
            branchName: product.branchName,
            qty: product.stock,
            meta: `Harga ${formatCurrency(product.price)}`
          }));
      });
    }

    if (stockModal.type === "limit") {
      return lowStockProducts.filter(sameBranch).slice(0, branchLimit?.lowItems).map((product) => ({
        code: product.code,
        name: product.name,
        branchName: product.branchName,
        qty: product.stock,
        meta: `Minimum ${formatNumber(product.minimum ?? 0)} | Harga ${formatCurrency(product.price)}`
      }));
    }

    if (stockModal.type === "empty") {
      return lowStockProducts.filter((product) => sameBranch(product) && product.stock === 0).map((product) => ({
        code: product.code,
        name: product.name,
        branchName: product.branchName,
        qty: product.stock,
        meta: `Minimum ${formatNumber(product.minimum ?? 0)} | Harga ${formatCurrency(product.price)}`
      }));
    }

    return expiringProducts.filter((product) => sameBranch(product) && product.status === "expired").slice(0, branchLimit?.expiredItems).map((product) => ({
      code: product.code,
      name: product.name,
      branchName: product.branchName,
      qty: product.stock,
      meta: `${product.status === "expired" ? "Expired" : "Mendekati expired"} | ${product.expiredAt ?? "-"}`
    }));
  }, [branchNameByCode, branchSummaries, expiringProducts, lowStockProducts, stockModal, topStockProducts]);
  const emptyItemPreview = lowStockProducts.filter((product) => product.stock === 0).slice(0, 5);
  const openStockModal = (type: StockModalType, label: string, branch?: BranchSummary) => {
    setStockModal({
      branchCode: branch?.code,
      branchName: branch?.name,
      title: `${label} ${branch ? branch.name.replace("Bintang Kembar ", "") : "semua cabang"}`,
      type
    });
  };

  return (
    <>
      <section className="dashboard-full">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>Pendapatan Per Cabang</h2>
            </div>
            {timeframeControls}
          </div>
          <div className="branch-color-chart revenue-motion">
            {chartBranches.map((branch, index) => (
              <div
                className="branch-color-bar"
                key={branch.code}
                title={`${branch.name} | ${timeframeLabel}: ${formatCurrency(branch.chartSales)} | Hari ini: ${formatCurrency(branch.chartTodaySales)} | ${formatNumber(branch.chartTransactions)} transaksi`}
              >
                <div className="branch-color-bar__bar">
                  <span
                    style={{
                      height: `${Math.max(14, (branch.chartSales / maxMonthSales) * 100)}%`,
                      background: branchColors[index % branchColors.length]
                    }}
                  />
                </div>
                <b>{branch.code}</b>
                <strong>{branch.name.replace("Bintang Kembar ", "")}</strong>
                <small>{formatCurrency(branch.chartSales)}</small>
                <div className="branch-chart-tooltip" role="tooltip">
                  <span>{branch.code}</span>
                  <strong>{branch.name}</strong>
                  <dl>
                    <div>
                      <dt>Pendapatan</dt>
                      <dd>{formatCurrency(branch.chartSales)}</dd>
                    </div>
                    <div>
                      <dt>Omzet hari ini</dt>
                      <dd>{formatCurrency(branch.chartTodaySales)}</dd>
                    </div>
                    <div>
                      <dt>Transaksi</dt>
                      <dd>{formatNumber(branch.chartTransactions)}</dd>
                    </div>
                    <div>
                      <dt>Produk terlaris</dt>
                      <dd>{branch.topProduct}</dd>
                    </div>
                    <div>
                      <dt>Item terjual</dt>
                      <dd>{formatNumber(branch.topProductQty)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-two">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>Komposisi Pendapatan Cabang</h2>
            </div>
          </div>
          <div className="donut-layout">
            <div className="donut-chart" style={{ background: `conic-gradient(${donutGradient})` }}>
              <div>
                <strong>{formatCurrency(totalMonthSales)}</strong>
                <span>Total {timeframeLabel.toLowerCase()}</span>
              </div>
            </div>
            <div className="color-legend">
              {chartBranches.map((branch, index) => (
                <div className="color-legend__item" key={branch.code}>
                  <span style={{ background: branchColors[index % branchColors.length] }} />
                  <b>{branch.code}</b>
                  <em>{branch.name}</em>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{trendConfig.title}</h2>
            </div>
            <div className="segmented-control" aria-label="Pilih rentang grafik pendapatan">
              {[
                ["minggu", "Minggu"],
                ["bulan", "Bulan"],
                ["tahun", "Tahun"]
              ].map(([value, label]) => (
                <button
                  className={`segmented-control__item ${trendRange === value ? "segmented-control__item--active" : ""}`}
                  key={value}
                  onClick={() => setTrendRange(value as TrendRange)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="line-chart-card">
            <svg className="line-chart" viewBox="0 0 640 300" role="img" aria-label="Grafik pendapatan per minggu">
              <defs>
                <linearGradient id="weeklyArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.04" />
                </linearGradient>
                <linearGradient id="weeklyLine" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#16a085" />
                  <stop offset="45%" stopColor="#f97316" />
                  <stop offset="75%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              {[70, 115, 160, 205, 250].map((y) => (
                <line className="chart-grid-line" x1="42" x2="600" y1={y} y2={y} key={y} />
              ))}
              <path className="line-chart__area" d={areaPath} fill="url(#weeklyArea)" />
              <path className="line-chart__line" d={linePath} stroke="url(#weeklyLine)" />
              {linePoints.map((point, index) => (
                <g key={point.label}>
                  <circle className="line-chart__dot" cx={point.x} cy={point.y} r="7" fill={branchColors[index % branchColors.length]} />
                  <text className="line-chart__label" x={point.x} y="278" textAnchor="middle">
                    {point.label}
                  </text>
                  <text className="line-chart__value" x={point.x} y={point.y - 15} textAnchor="middle">
                    {formatCurrency(point.amount).replace(/\s/g, " ")}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </article>

        <article className="panel panel--full-width">
          <div className="panel__header">
            <div>
              <h2>Ranking Cabang</h2>
            </div>
            <div className="ranking-toolbar">
              {timeframeControls}
              <div className="segmented-control" aria-label="Pilih ranking">
                <button
                  className={`segmented-control__item ${rankingMode === "pendapatan" ? "segmented-control__item--active" : ""}`}
                  onClick={() => setRankingMode("pendapatan")}
                  type="button"
                >
                  <Crown size={15} />
                  Pendapatan
                </button>
                <button
                  className={`segmented-control__item ${rankingMode === "item" ? "segmented-control__item--active" : ""}`}
                  onClick={() => setRankingMode("item")}
                  type="button"
                >
                  <PackageCheck size={15} />
                  Item Terjual
                </button>
              </div>
            </div>
          </div>
          <div className="ranking-list">
            {(rankingMode === "pendapatan" ? rankedBranches : rankedByItems).map((branch, index) => {
              const originalIndex = branchSummaries.findIndex((item) => item.code === branch.code);
              const isRevenue = rankingMode === "pendapatan";
              const revenueValue = Number((branch as { chartSales?: number }).chartSales ?? branch.monthSales);
              const rankingValue = isRevenue ? revenueValue : branch.topProductQty;

              return (
                <Link className="ranking-row" href={`${isRevenue ? "/cabang" : "/penjualan"}?kode=${branch.code}`} key={branch.code}>
                  <b style={{ background: branchColors[originalIndex % branchColors.length], color: "#ffffff" }}>{index + 1}</b>
                  <div>
                    <strong>{branch.name}</strong>
                    <span>{isRevenue ? `${formatNumber(branch.transactions)} transaksi` : branch.topProduct}</span>
                  </div>
                  <em>{isRevenue ? formatCurrency(revenueValue) : `${formatNumber(branch.topProductQty)} item`}</em>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${Math.max(8, (rankingValue / (isRevenue ? maxMonthSales : maxItemsSold)) * 100)}%`,
                        background: branchColors[originalIndex % branchColors.length]
                      }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="panel panel--full-width">
          <div className="panel__header">
            <div>
              <h2>Warning Stok dan Expired</h2>
            </div>
          </div>
          <div className="stock-warning-layout">
            <section className="stock-warning-total">
              <div className="stock-warning-total__icon">
                <Boxes size={24} />
              </div>
              <span>Total semua cabang</span>
              <strong>{formatNumber(stockResume.totalItems)}</strong>
              <p>
                Aman {formatNumber(stockResume.safeItems)} item, limit {formatNumber(stockResume.lowItems)}, kosong{" "}
                {formatNumber(stockResume.emptyItems)}, expired/mendekati {formatNumber(stockResume.expiredItems)}.
              </p>
              <div className="stock-warning-total__actions" aria-label="Detail stok semua cabang">
                <button type="button" onClick={() => openStockModal("safe", "Aman")}>Aman {formatNumber(stockResume.safeItems)}</button>
                <button type="button" onClick={() => openStockModal("limit", "Limit")}>Limit {formatNumber(stockResume.lowItems)}</button>
                <button type="button" onClick={() => openStockModal("empty", "Kosong")}>Kosong {formatNumber(stockResume.emptyItems)}</button>
                <button type="button" onClick={() => openStockModal("expired", "Expired")}>Expired {formatNumber(stockResume.expiredItems)}</button>
              </div>
              <div className="stock-empty-preview">
                <strong>Detail item kosong</strong>
                {emptyItemPreview.map((product) => (
                  <button type="button" onClick={() => openStockModal("empty", "Kosong")} key={`${product.branchName}-${product.code}`}>
                    <span>{product.name}</span>
                    <em>{product.branchName}</em>
                  </button>
                ))}
              </div>
            </section>
            <section className="stock-warning-branches">
              {branchSummaries.map((branch, index) => (
                <article className="stock-warning-card" key={branch.code} style={{ "--branch-color": branchColors[index % branchColors.length] } as CSSProperties}>
                  <div className="stock-warning-card__top">
                    <span>
                      <i />
                      {branch.code}
                    </span>
                    <strong>{branch.name.replace("Bintang Kembar ", "")}</strong>
                  </div>
                  <div className="stock-warning-card__grid">
                    <button type="button" onClick={() => openStockModal("safe", "Aman", branch)}>
                      <CheckCircle2 size={16} />
                      <span>Aman</span>
                      <strong>{formatNumber(branch.stockResume.safeItems)}</strong>
                    </button>
                    <button type="button" onClick={() => openStockModal("limit", "Limit", branch)}>
                      <AlertTriangle size={16} />
                      <span>Limit</span>
                      <strong>{formatNumber(branch.stockResume.lowItems)}</strong>
                    </button>
                    <button type="button" onClick={() => openStockModal("empty", "Kosong", branch)}>
                      <PackageX size={16} />
                      <span>Kosong</span>
                      <strong>{formatNumber(branch.stockResume.emptyItems)}</strong>
                    </button>
                    <button type="button" onClick={() => openStockModal("expired", "Expired", branch)}>
                      <AlertTriangle size={16} />
                      <span>Expired</span>
                      <strong>{formatNumber(branch.stockResume.expiredItems)}</strong>
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </div>
        </article>
      </section>
      {stockModal ? (
        <div className="stock-modal-backdrop" role="presentation" onClick={() => setStockModal(null)}>
          <section className="stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="stock-modal__header">
              <div>
                <span>{stockModal.branchName ?? "Semua cabang"}</span>
                <h2 id="stock-modal-title">{stockModal.title}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setStockModal(null)}>
                Tutup
              </button>
            </div>
            <div className="stock-modal__body">
              {stockModalItems.length ? (
                stockModalItems.slice(0, 80).map((item) => (
                  <div className="stock-modal__row" key={`${item.branchName}-${item.code}-${item.name}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.code} | {item.branchName}</span>
                      <small>{item.meta}</small>
                    </div>
                    <b>{formatNumber(item.qty)}</b>
                  </div>
                ))
              ) : (
                <div className="empty-state">Tidak ada item untuk kategori ini.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
