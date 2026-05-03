import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { transferDummyStockProduct } from "@/lib/dummy-stock-store";
import { findBranchProduct } from "@/lib/legacy-db";

function redirectBack(request: Request, branchCode: string, status: string) {
  const url = new URL("/cabang", request.url);
  url.searchParams.set("kode", branchCode);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const fromBranchCode = String(formData.get("fromBranchCode") ?? "C01").trim().toUpperCase();
  const toBranchCode = String(formData.get("toBranchCode") ?? "").trim().toUpperCase();
  const productCode = String(formData.get("productCode") ?? "").trim().toUpperCase();
  const quantity = Math.max(0, Math.round(Number(formData.get("quantity") ?? 0)));
  const note = String(formData.get("note") ?? "").trim();

  if (!toBranchCode || !productCode || quantity <= 0 || toBranchCode === fromBranchCode) {
    return redirectBack(request, fromBranchCode, "transfer-invalid");
  }

  const product = await findBranchProduct(fromBranchCode, productCode);
  if (!product || product.stock < quantity) {
    return redirectBack(request, fromBranchCode, "transfer-invalid");
  }

  await transferDummyStockProduct({
    fromBranchCode,
    toBranchCode,
    product,
    quantity,
    note: `Transfer ${quantity} ${product.code} dari ${fromBranchCode} ke ${toBranchCode}${note ? `: ${note}` : ""}`
  });
  revalidatePath("/cabang");

  return redirectBack(request, fromBranchCode, "transfer-saved");
}
