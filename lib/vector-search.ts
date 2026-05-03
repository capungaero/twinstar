import fs from "node:fs";
import path from "node:path";
import { getProductCategory } from "@/lib/filters";
import { getDashboardData } from "@/lib/legacy-db";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

type VectorRecord =
  | { type: "sales"; text: string; item: DashboardData["recentSales"][number] }
  | { type: "stock"; text: string; item: DashboardData["lowStockProducts"][number] | DashboardData["topStockProducts"][number] }
  | { type: "expired"; text: string; item: DashboardData["expiringProducts"][number] }
  | { type: "branch"; text: string; item: DashboardData["branchSummaries"][number] };

type EmbeddedRecord = VectorRecord & {
  vector: Map<number, number>;
};

type StoredEmbeddedRecord = VectorRecord & {
  vector: Array<[number, number]>;
};

type VectorIndex = {
  indexKey: string;
  generatedAt: string;
  records: EmbeddedRecord[];
};

type StoredVectorIndex = {
  indexKey?: string;
  generatedAt: string;
  dimensions: number;
  records: StoredEmbeddedRecord[];
};

const DIMENSIONS = 512;
const VECTOR_DB_DIR = path.join(process.cwd(), ".vector-db");
const VECTOR_DB_FILE = path.join(VECTOR_DB_DIR, "dashboard-index.json");
let cachedIndex: VectorIndex | null = null;

function getDataIndexKey(data: DashboardData) {
  return [data.recentSales.length, data.lowStockProducts.length, data.topStockProducts.length, data.expiringProducts.length, data.branchSummaries.length].join(":");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % DIMENSIONS;
}

function tokenize(text: string) {
  const normalized = normalize(text);
  const words = normalized.split(" ").filter((word) => word.length >= 2);
  const grams: string[] = [];

  for (const word of words) {
    grams.push(word);
    for (let index = 0; index <= word.length - 3; index += 1) {
      grams.push(word.slice(index, index + 3));
    }
  }

  return grams;
}

function embed(text: string) {
  const vector = new Map<number, number>();
  for (const token of tokenize(text)) {
    const key = hashToken(token);
    vector.set(key, (vector.get(key) ?? 0) + 1);
  }
  return vector;
}

function cosineSimilarity(left: Map<number, number>, right: Map<number, number>) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (const value of left.values()) {
    leftNorm += value * value;
  }

  for (const [key, value] of right) {
    rightNorm += value * value;
    dot += (left.get(key) ?? 0) * value;
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function buildRecords(data: DashboardData): VectorRecord[] {
  const stockProducts = [...data.lowStockProducts, ...data.topStockProducts];

  return [
    ...data.recentSales.map((sale) => ({
      type: "sales" as const,
      item: sale,
      text: ["penjualan transaksi omzet laba", sale.code, sale.branchCode, sale.branchName, sale.customer, sale.cashier, sale.itemName, sale.category, sale.paymentMethod, sale.status, sale.total, sale.profit].join(" ")
    })),
    ...stockProducts.map((product) => ({
      type: "stock" as const,
      item: product,
      text: ["stok stock barang produk", product.code, product.branchName, product.name, getProductCategory(product.name), product.stock, product.price].join(" ")
    })),
    ...data.expiringProducts.map((product) => ({
      type: "expired" as const,
      item: product,
      text: ["expired kadaluarsa kedaluwarsa fefo", product.code, product.branchName, product.name, product.status, product.expiredAt, product.stock].join(" ")
    })),
    ...data.branchSummaries.map((branch) => ({
      type: "branch" as const,
      item: branch,
      text: ["cabang toko outlet", branch.code, branch.name, branch.status, branch.topProduct, branch.transactions, branch.monthSales].join(" ")
    }))
  ];
}

function buildVectorIndex(data: DashboardData): VectorIndex {
  return {
    indexKey: getDataIndexKey(data),
    generatedAt: data.generatedAt,
    records: buildRecords(data).map((record) => ({
      ...record,
      vector: embed(record.text)
    }))
  };
}

function toStoredIndex(index: VectorIndex): StoredVectorIndex {
  return {
    indexKey: index.indexKey,
    generatedAt: index.generatedAt,
    dimensions: DIMENSIONS,
    records: index.records.map((record) => ({
      ...record,
      vector: Array.from(record.vector.entries())
    }))
  };
}

function fromStoredIndex(index: StoredVectorIndex, indexKey: string): VectorIndex | null {
  if (index.dimensions !== DIMENSIONS || !Array.isArray(index.records)) return null;

  return {
    indexKey,
    generatedAt: index.generatedAt,
    records: index.records.map((record) => ({
      ...record,
      vector: new Map(record.vector)
    }))
  };
}

function loadStoredVectorIndex(indexKey: string) {
  if (!fs.existsSync(VECTOR_DB_FILE)) return null;

  try {
    const stored = JSON.parse(fs.readFileSync(VECTOR_DB_FILE, "utf8")) as StoredVectorIndex;
    const storedIndexKey = stored.indexKey ?? [
      stored.records.filter((record) => record.type === "sales").length,
      stored.records.filter((record) => record.type === "stock" && "minimum" in record.item).length,
      stored.records.filter((record) => record.type === "stock" && !("minimum" in record.item)).length,
      stored.records.filter((record) => record.type === "expired").length,
      stored.records.filter((record) => record.type === "branch").length
    ].join(":");
    if (storedIndexKey !== indexKey) return null;
    return fromStoredIndex(stored, storedIndexKey);
  } catch {
    return null;
  }
}

export function persistVectorIndex(data: DashboardData) {
  const index = buildVectorIndex(data);
  fs.mkdirSync(VECTOR_DB_DIR, { recursive: true });
  fs.writeFileSync(VECTOR_DB_FILE, JSON.stringify(toStoredIndex(index)), "utf8");
  cachedIndex = index;

  return {
    filePath: VECTOR_DB_FILE,
    indexKey: index.indexKey,
    generatedAt: index.generatedAt,
    records: index.records.length,
    dimensions: DIMENSIONS
  };
}

export function getVectorSearchResults(data: DashboardData, query: string, limit = 160) {
  const indexKey = getDataIndexKey(data);
  if (!cachedIndex || cachedIndex.indexKey !== indexKey) {
    cachedIndex = loadStoredVectorIndex(indexKey) ?? buildVectorIndex(data);
  }

  const queryVector = embed(query);
  if (queryVector.size === 0) {
    return { sales: [], stock: [], expired: [], branches: [] };
  }

  const ranked = cachedIndex.records
    .map((record) => ({ record, score: cosineSimilarity(queryVector, record.vector) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((match) => match.record);

  return {
    sales: ranked.filter((record) => record.type === "sales").map((record) => record.item),
    stock: ranked.filter((record) => record.type === "stock").map((record) => record.item),
    expired: ranked.filter((record) => record.type === "expired").map((record) => record.item),
    branches: ranked.filter((record) => record.type === "branch").map((record) => record.item)
  };
}
