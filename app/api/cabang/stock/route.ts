import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { upsertDummyStockProduct } from "@/lib/dummy-stock-store";

function formNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function redirectBack(request: Request, branchCode: string, status: string) {
  const url = new URL("/cabang", request.url);
  url.searchParams.set("kode", branchCode);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const branchCode = String(formData.get("branchCode") ?? "C01").trim().toUpperCase();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const reason = String(formData.get("reason") ?? "koreksi").trim();
  const stock = formNumber(formData, "stock");
  const minimum = formNumber(formData, "minimum");
  const price = formNumber(formData, "price");

  if (!code || !name) {
    return redirectBack(request, branchCode, "stock-invalid");
  }

  await upsertDummyStockProduct(
    branchCode,
    {
      code,
      name,
      stock,
      minimum,
      price
    },
    `Koreksi ${code}: ${reason}, stok menjadi ${stock}`
  );
  revalidatePath("/cabang");

  return redirectBack(request, branchCode, "stock-saved");
}
