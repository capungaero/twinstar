import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type DummyStockProduct = {
  code: string;
  name: string;
  stock: number;
  minimum?: number;
  price: number;
};

export type DummyStockMutation = {
  id: string;
  type: "stock-update" | "transfer";
  createdAt: string;
  note: string;
};

export type DummyStockStore = {
  products: Record<string, Record<string, DummyStockProduct>>;
  mutations: DummyStockMutation[];
};

const EMPTY_STORE: DummyStockStore = {
  products: {},
  mutations: []
};

const memoryKey = "__twinstarDummyStockStore";

function cloneStore(store: DummyStockStore): DummyStockStore {
  return {
    products: Object.fromEntries(
      Object.entries(store.products).map(([branchCode, products]) => [
        branchCode,
        Object.fromEntries(Object.entries(products).map(([code, product]) => [code, { ...product }]))
      ])
    ),
    mutations: store.mutations.map((mutation) => ({ ...mutation }))
  };
}

function getMemoryStore() {
  const globalStore = globalThis as typeof globalThis & { [memoryKey]?: DummyStockStore };
  if (!globalStore[memoryKey]) {
    globalStore[memoryKey] = cloneStore(EMPTY_STORE);
  }
  return globalStore[memoryKey];
}

function storePath() {
  return process.env.DUMMY_STOCK_DB_PATH ?? path.join(process.cwd(), ".dummy-db", "stock.json");
}

function fallbackStorePath() {
  return path.join(os.tmpdir(), "twinstar-dummy-stock.json");
}

async function readFileStore(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DummyStockStore>;
    return {
      products: parsed.products ?? {},
      mutations: parsed.mutations ?? []
    };
  } catch {
    return null;
  }
}

async function writeFileStore(filePath: string, store: DummyStockStore) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

export async function readDummyStockStore() {
  const fileStore = (await readFileStore(storePath())) ?? (await readFileStore(fallbackStorePath()));
  if (fileStore) {
    const memoryStore = getMemoryStore();
    memoryStore.products = cloneStore(fileStore).products;
    memoryStore.mutations = cloneStore(fileStore).mutations;
    return fileStore;
  }

  return cloneStore(getMemoryStore());
}

export async function saveDummyStockStore(store: DummyStockStore) {
  const cleanStore = cloneStore(store);
  const memoryStore = getMemoryStore();
  memoryStore.products = cleanStore.products;
  memoryStore.mutations = cleanStore.mutations;

  try {
    await writeFileStore(storePath(), cleanStore);
  } catch {
    await writeFileStore(fallbackStorePath(), cleanStore);
  }
}

export function normalizeProduct(product: DummyStockProduct): DummyStockProduct {
  return {
    code: product.code.trim().toUpperCase(),
    name: product.name.trim(),
    stock: Math.max(0, Math.round(Number(product.stock) || 0)),
    minimum: product.minimum === undefined ? undefined : Math.max(0, Math.round(Number(product.minimum) || 0)),
    price: Math.max(0, Math.round(Number(product.price) || 0))
  };
}

export async function upsertDummyStockProduct(branchCode: string, product: DummyStockProduct, note: string) {
  const store = await readDummyStockStore();
  const cleanBranchCode = branchCode.trim().toUpperCase();
  const cleanProduct = normalizeProduct(product);

  store.products[cleanBranchCode] = {
    ...(store.products[cleanBranchCode] ?? {}),
    [cleanProduct.code]: cleanProduct
  };
  store.mutations.unshift({
    id: `${Date.now()}-${cleanBranchCode}-${cleanProduct.code}`,
    type: "stock-update",
    createdAt: new Date().toISOString(),
    note
  });
  store.mutations = store.mutations.slice(0, 100);

  await saveDummyStockStore(store);
  return cleanProduct;
}

export async function transferDummyStockProduct(params: {
  fromBranchCode: string;
  toBranchCode: string;
  product: DummyStockProduct;
  quantity: number;
  note: string;
}) {
  const quantity = Math.max(0, Math.round(Number(params.quantity) || 0));
  const sourceProduct = normalizeProduct({
    ...params.product,
    stock: Math.max(0, params.product.stock - quantity)
  });
  const targetProduct = normalizeProduct({
    ...params.product,
    stock: quantity
  });
  const store = await readDummyStockStore();
  const fromBranchCode = params.fromBranchCode.trim().toUpperCase();
  const toBranchCode = params.toBranchCode.trim().toUpperCase();
  const existingTarget = store.products[toBranchCode]?.[targetProduct.code];

  store.products[fromBranchCode] = {
    ...(store.products[fromBranchCode] ?? {}),
    [sourceProduct.code]: sourceProduct
  };
  store.products[toBranchCode] = {
    ...(store.products[toBranchCode] ?? {}),
    [targetProduct.code]: normalizeProduct({
      ...targetProduct,
      stock: (existingTarget?.stock ?? 0) + quantity
    })
  };
  store.mutations.unshift({
    id: `${Date.now()}-${fromBranchCode}-${toBranchCode}-${sourceProduct.code}`,
    type: "transfer",
    createdAt: new Date().toISOString(),
    note: params.note
  });
  store.mutations = store.mutations.slice(0, 100);

  await saveDummyStockStore(store);
  return { sourceProduct, targetProduct };
}
