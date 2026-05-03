export const CATEGORY_OPTIONS = [
  "Semua Kategori",
  "Minyak & Obat",
  "Fashion",
  "Elektronik",
  "Rumah Tangga",
  "Makanan",
  "Lainnya"
];

export function getProductCategory(name: string) {
  const value = name.toLowerCase();

  if (value.includes("minyak") || value.includes("gosok") || value.includes("tawon")) return "Minyak & Obat";
  if (value.includes("kaos") || value.includes("kaki") || value.includes("student")) return "Fashion";
  if (value.includes("alkaline") || value.includes("baterai") || value.includes("battery")) return "Elektronik";
  if (value.includes("tempat") || value.includes("air minum")) return "Rumah Tangga";
  if (value.includes("bakpuder") || value.includes("susu") || value.includes("anlene")) return "Makanan";

  return "Lainnya";
}

export function matchesTextSearch(query: string, values: Array<string | number | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
}

export function matchesCategory(category: string, productName: string) {
  if (!category || category === "Semua Kategori") return true;
  return getProductCategory(productName) === category;
}
