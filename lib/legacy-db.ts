type BranchStatus = "online" | "syncing" | "warning";

export type BranchInfo = {
  code: string;
  name: string;
  host: string;
  database: string;
  port: number;
  lastSyncAt?: string;
  status?: BranchStatus;
};

export type DashboardData = {
  branches: BranchInfo[];
  connected: boolean;
  generatedAt: string;
  error?: string;
  summary: {
    products: number;
    stockStore: number;
    stockWarehouse: number;
    stockLimit: number;
    todaySales: number;
    monthSales: number;
    grossProfit: number;
    receivables: number;
    payables: number;
    purchases: number;
  };
  branchSummaries: Array<{
    code: string;
    name: string;
    status: BranchStatus;
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
  }>;
  recentSales: Array<{
    code: string;
    branchCode: string;
    branchName: string;
    date: string | null;
    customer: string;
    cashier: string;
    itemName: string;
    category: string;
    quantity: number;
    paymentMethod: string;
    status: "normal" | "retur" | "batal" | "koreksi";
    profit: number;
    total: number;
  }>;
  lowStockProducts: Array<{
    code: string;
    branchName: string;
    name: string;
    stock: number;
    minimum: number;
    price: number;
  }>;
  topStockProducts: Array<{
    code: string;
    branchName: string;
    name: string;
    stock: number;
    price: number;
  }>;
  topSellingProducts: Array<{
    code: string;
    name: string;
    quantity: number;
    total: number;
  }>;
  expiringProducts: Array<{
    code: string;
    branchName: string;
    name: string;
    expiredAt: string | null;
    stock: number;
    status: "expired" | "soon";
  }>;
};

export type BranchDetailData = {
  selectedBranch: BranchInfo;
  branches: BranchInfo[];
  connected: boolean;
  generatedAt: string;
  error?: string;
  summary: DashboardData["branchSummaries"][number];
  recentSales: DashboardData["recentSales"];
  lowStockProducts: DashboardData["lowStockProducts"];
  topStockProducts: DashboardData["topStockProducts"];
  expiringProducts: DashboardData["expiringProducts"];
};

const SIMULATED_BRANCHES: BranchInfo[] = [
  { code: "C01", name: "Bintang Kembar Pekanbaru" },
  { code: "C02", name: "Bintang Kembar Dhamasraya" },
  { code: "C03", name: "Bintang Kembar Payakumbuh" },
  { code: "C04", name: "Bintang Kembar Tanjung Pati" },
  { code: "C05", name: "Bintang Kembar Solok Selatan" },
  { code: "C06", name: "Bintang Kembar Cabang 06" },
  { code: "C07", name: "Bintang Kembar Cabang 07" },
  { code: "C08", name: "Bintang Kembar Cabang 08" },
  { code: "C09", name: "Bintang Kembar Cabang 09" },
  { code: "C10", name: "Bintang Kembar Cabang 10" }
].map((branch, index) => ({
  ...branch,
  host: "dummy-source",
  port: 0,
  database: "simulasi_dummy",
  status: index === 2 ? "syncing" : index === 7 ? "warning" : "online"
}));

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function scale(value: unknown, factor: number) {
  return Math.round(toNumber(value) * factor);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

const CATEGORY_CATALOG = [
  {
    category: "Minyak & Obat",
    names: [
      "MINYAK GOSOK TAWON FF",
      "MINYAK KAYU PUTIH CAP LANG",
      "BALSEM GELIGA 20 GR",
      "OBAT BATUK KOMIX JAHE",
      "VITAMIN C TABLET",
      "BETADINE CAIR 15 ML"
    ]
  },
  {
    category: "Fashion",
    names: [
      "KAOS KAKI SEKOLAH PUTIH",
      "KAOS POLOS ANAK",
      "SANDAL RUMAH KARET",
      "HANDUK KECIL MOTIF",
      "JEPIT RAMBUT WARNA",
      "MASKER KAIN ANAK"
    ]
  },
  {
    category: "Elektronik",
    names: [
      "ABC ALKALINE 9 VOLT",
      "BATTERY ABC AA ISI 2",
      "LAMPU LED 9 WATT",
      "KABEL DATA TYPE C",
      "CHARGER USB 2 PORT",
      "STOP KONTAK 3 LUBANG"
    ]
  },
  {
    category: "Rumah Tangga",
    names: [
      "TEMPAT AIR MINUM 2 LITER",
      "SABUN CUCI PIRING",
      "SAPU LIDI GAGANG",
      "PLASTIK SAMPAH HITAM",
      "TISSUE ROLL EKONOMIS",
      "PEWANGI LANTAI LEMON"
    ]
  },
  {
    category: "Makanan",
    names: [
      "BAKPUDER CAP KUPU",
      "ANLENE GOLD VANILA",
      "BISKUIT KELAPA",
      "MIE INSTAN GORENG",
      "SUSU UHT COKLAT",
      "KOPI SACHET GULA AREN"
    ]
  },
  {
    category: "Lainnya",
    names: [
      "BUKU TULIS 38 LBR",
      "PULPEN HITAM 0.5",
      "LEM KERTAS STICK",
      "PAYUNG LIPAT MINI",
      "KOREK API GAS",
      "TALI RAFIA MERAH"
    ]
  }
];

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function seededInt(seed: number, min: number, max: number) {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function catalogItem(globalIndex: number) {
  const catalog = CATEGORY_CATALOG[globalIndex % CATEGORY_CATALOG.length];
  const name = catalog.names[Math.floor(globalIndex / CATEGORY_CATALOG.length) % catalog.names.length];

  return {
    category: catalog.category,
    name
  };
}

function dummyProductCode(branchIndex: number, itemIndex: number, category: string) {
  const categoryCode = category
    .split(" ")
    .map((part) => part[0])
    .join("")
    .replace(/[^A-Z]/gi, "")
    .slice(0, 3)
    .toUpperCase();

  return `${categoryCode}-${String(branchIndex + 1).padStart(2, "0")}-${String(itemIndex + 1).padStart(3, "0")}`;
}

const PAYMENT_METHODS = ["Tunai", "QRIS", "Transfer", "Piutang"];
const SALE_STATUSES = ["normal", "normal", "normal", "normal", "retur", "batal", "koreksi"] as const;

export async function getDashboardData(): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const now = new Date();
  const simulatedRecentSales = SIMULATED_BRANCHES.flatMap((branch, branchIndex) =>
    Array.from({ length: 100 }, (_, rowIndex) => {
      const catalog = catalogItem(branchIndex * 100 + rowIndex);
      const quantity = seededInt(branchIndex * 1000 + rowIndex * 13, 1, 12);
      const unitPrice = seededInt(branchIndex * 2000 + rowIndex * 17, 4, 95) * 1000;
      const dayOffset = seededInt(branchIndex * 3000 + rowIndex * 19, 0, 29);
      const saleDate = addDays(now, -dayOffset);
      const total = quantity * unitPrice;

      return {
        code: `${branch.code}-TRX-${String(rowIndex + 1).padStart(4, "0")}`,
        branchCode: branch.code,
        branchName: branch.name,
        date: saleDate,
        customer: `Pelanggan ${branch.code}-${String(rowIndex + 1).padStart(3, "0")}`,
        cashier: `Kasir ${branch.code}`,
        itemName: `${catalog.name} ${String((rowIndex % 12) + 1).padStart(2, "0")}`,
        category: catalog.category,
        quantity,
        paymentMethod: PAYMENT_METHODS[seededInt(branchIndex * 4100 + rowIndex * 23, 0, PAYMENT_METHODS.length - 1)],
        status: SALE_STATUSES[seededInt(branchIndex * 5100 + rowIndex * 29, 0, SALE_STATUSES.length - 1)],
        profit: Math.round(total * (0.12 + seededInt(branchIndex * 6100 + rowIndex * 31, 4, 16) / 100)),
        total
      };
    })
  ).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.total - a.total);
  const simulatedLowStock = SIMULATED_BRANCHES.flatMap((branch, branchIndex) =>
    Array.from({ length: 20 }, (_, itemIndex) => {
      const catalog = catalogItem(branchIndex * 100 + itemIndex);
      const minimum = seededInt(branchIndex * 500 + itemIndex * 7, 8, 25);
      const stock = itemIndex % 9 === 0 ? 0 : seededInt(branchIndex * 600 + itemIndex * 11, 1, Math.max(1, minimum - 1));

      return {
        code: dummyProductCode(branchIndex, itemIndex, catalog.category),
        branchName: branch.name,
        name: `${catalog.name} ${catalog.category} ${String(itemIndex + 1).padStart(2, "0")}`,
        stock,
        minimum,
        price: seededInt(branchIndex * 700 + itemIndex * 13, 5, 120) * 1000
      };
    })
  );
  const simulatedTopStock = SIMULATED_BRANCHES.flatMap((branch, branchIndex) =>
    Array.from({ length: 80 }, (_, itemIndex) => {
      const catalog = catalogItem(branchIndex * 100 + itemIndex + 20);
      const stock = seededInt(branchIndex * 800 + itemIndex * 17, 24, 260);

      return {
        code: dummyProductCode(branchIndex, itemIndex + 20, catalog.category),
        branchName: branch.name,
        name: `${catalog.name} ${catalog.category} ${String(itemIndex + 21).padStart(2, "0")}`,
        stock,
        price: seededInt(branchIndex * 900 + itemIndex * 19, 5, 150) * 1000
      };
    })
  );
  const simulatedTopSelling = CATEGORY_CATALOG.flatMap((catalog, catalogIndex) =>
    catalog.names.slice(0, 2).map((name, itemIndex) => {
      const index = catalogIndex * 2 + itemIndex;

      return {
        code: dummyProductCode(index, itemIndex, catalog.category),
        name: `${name} ${catalog.category}`,
        quantity: 860 - index * 41,
        total: (860 - index * 41) * (seededInt(index * 25, 8, 75) * 1000)
      };
    })
  ).sort((a, b) => b.quantity - a.quantity);
  const simulatedExpiringProducts = SIMULATED_BRANCHES.flatMap((branch, branchIndex) =>
    Array.from({ length: 15 }, (_, rowIndex) => {
      const catalog = catalogItem(branchIndex * 100 + rowIndex + 55);
      const daysOffset = rowIndex % 5 === 0 ? -2 - rowIndex : 5 + branchIndex * 2 + rowIndex * 4;

      return {
        code: dummyProductCode(branchIndex, rowIndex + 55, catalog.category),
        branchName: branch.name,
        name: `${catalog.name} ${catalog.category} EXP ${String(rowIndex + 1).padStart(2, "0")}`,
        expiredAt: addDays(now, daysOffset),
        stock: Math.max(1, Math.round(3 + branchIndex * 1.7 + rowIndex * 2)),
        status: (daysOffset < 0 ? "expired" : "soon") as "expired" | "soon"
      };
    })
  );
  const branchSummaries = SIMULATED_BRANCHES.map((branch, index) => {
      const branchSales = simulatedRecentSales.filter((sale) => sale.branchCode === branch.code);
      const branchLowStock = simulatedLowStock.filter((product) => product.branchName === branch.name);
      const branchStock = simulatedTopStock.filter((product) => product.branchName === branch.name);
      const branchExpired = simulatedExpiringProducts.filter((product) => product.branchName === branch.name);
      const productRanking = Array.from(
        branchSales
          .reduce((ranking, sale) => {
            const current = ranking.get(sale.itemName) ?? { name: sale.itemName, quantity: 0, total: 0 };
            current.quantity += sale.quantity;
            current.total += sale.total;
            ranking.set(sale.itemName, current);
            return ranking;
          }, new Map<string, { name: string; quantity: number; total: number }>())
          .values()
      ).sort((a, b) => b.quantity - a.quantity || b.total - a.total);
      const todaySales = branchSales.filter((sale) => sale.date === today).reduce((sum, sale) => sum + sale.total, 0);
      const monthSales = branchSales.filter((sale) => (sale.date ?? "") >= monthStart).reduce((sum, sale) => sum + sale.total, 0);
      const totalItems = branchLowStock.length + branchStock.length;
      const emptyItems = branchLowStock.filter((product) => product.stock === 0).length;
      const expiredItems = branchExpired.filter((product) => product.status === "expired").length;
      const receivableFactor = index % 3 === 0 ? 1.22 : 0.64 + index * 0.045;

      return {
        code: branch.code,
        name: branch.name,
        status: branch.status ?? "online",
        lastSyncAt: addMinutes(now, -8 - index * 6),
        todaySales,
        monthSales,
        grossProfit: Math.round(monthSales * 0.21),
        stockStore: [...branchLowStock, ...branchStock].reduce((sum, product) => sum + product.stock, 0),
        stockLimit: branchLowStock.length,
        receivables: scale(1_250_000, receivableFactor),
        payables: scale(2_400_000, 0.72 + index * 0.06),
        transactions: branchSales.length,
        topProduct: productRanking[0]?.name ?? "Belum ada penjualan",
        topProductQty: productRanking[0]?.quantity ?? 0,
        stockResume: {
          totalItems,
          safeItems: Math.max(0, totalItems - branchLowStock.length - emptyItems - expiredItems),
          lowItems: branchLowStock.length,
          emptyItems,
          expiredItems
        }
      };
  });

  const totalSummary = branchSummaries.reduce(
      (total, branch) => ({
        products: total.products + branch.stockResume.totalItems,
        stockStore: total.stockStore + branch.stockStore,
        stockWarehouse: total.stockWarehouse + Math.round(branch.stockStore * 0.42),
        stockLimit: total.stockLimit + branch.stockLimit,
        todaySales: total.todaySales + branch.todaySales,
        monthSales: total.monthSales + branch.monthSales,
        grossProfit: total.grossProfit + branch.grossProfit,
        receivables: total.receivables + branch.receivables,
        payables: total.payables + branch.payables,
        purchases: total.purchases + scale(2_700_000, 0.78)
      }),
      {
        products: 0,
        stockStore: 0,
        stockWarehouse: 0,
        stockLimit: 0,
        todaySales: 0,
        monthSales: 0,
        grossProfit: 0,
        receivables: 0,
        payables: 0,
        purchases: 0
      }
  );

  return {
    branches: SIMULATED_BRANCHES.map((branch, index) => ({
      ...branch,
      lastSyncAt: branchSummaries[index]?.lastSyncAt
    })),
    connected: true,
    generatedAt: new Date().toISOString(),
    summary: totalSummary,
    branchSummaries,
    recentSales: simulatedRecentSales,
    lowStockProducts: simulatedLowStock,
    topStockProducts: simulatedTopStock,
    topSellingProducts: simulatedTopSelling,
    expiringProducts: simulatedExpiringProducts
  };
}

export async function getBranchDetailData(branchCode = "C01"): Promise<BranchDetailData> {
  const dashboard = await getDashboardData();
  const selectedBranch = dashboard.branches.find((branch) => branch.code === branchCode) ?? dashboard.branches[0];
  const summary = dashboard.branchSummaries.find((branch) => branch.code === selectedBranch.code) ?? {
    code: selectedBranch.code,
    name: selectedBranch.name,
    status: selectedBranch.status ?? "online",
    lastSyncAt: selectedBranch.lastSyncAt ?? dashboard.generatedAt,
    todaySales: 0,
    monthSales: 0,
    grossProfit: 0,
    stockStore: 0,
    stockLimit: 0,
    receivables: 0,
    payables: 0,
    transactions: 0,
    topProduct: "Belum ada penjualan",
    topProductQty: 0,
    stockResume: {
      totalItems: 0,
      safeItems: 0,
      lowItems: 0,
      emptyItems: 0,
      expiredItems: 0
    }
  };

  return {
    selectedBranch,
    branches: dashboard.branches,
    connected: dashboard.connected,
    generatedAt: dashboard.generatedAt,
    error: dashboard.error,
    summary,
    recentSales: dashboard.recentSales.filter((sale) => sale.branchCode === selectedBranch.code),
    lowStockProducts: dashboard.lowStockProducts.filter((product) => product.branchName === selectedBranch.name),
    topStockProducts: dashboard.topStockProducts.filter((product) => product.branchName === selectedBranch.name),
    expiringProducts: dashboard.expiringProducts.filter((product) => product.branchName === selectedBranch.name)
  };
}
