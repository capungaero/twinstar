import { NextResponse } from "next/server";
import { buildAiSearchResponse } from "@/lib/ai-search";
import { getProductCategory } from "@/lib/filters";

type ExportFormat = "csv" | "xlsx";
type CellValue = string | number;
type ExportRow = Record<string, CellValue>;

const COLUMNS = ["Jenis", "Kode", "Nama", "Cabang", "Tanggal", "Pelanggan/Status", "Qty/Stok", "Nilai", "Detail"];

function makeFilename(query: string, format: ExportFormat) {
  const cleanQuery = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "pencarian-ai";

  return `${cleanQuery}.${format}`;
}

function buildRows(query: string, result: Awaited<ReturnType<typeof buildAiSearchResponse>>) {
  const rows: ExportRow[] = [
    {
      Jenis: "Ringkasan",
      Kode: "",
      Nama: query,
      Cabang: "",
      Tanggal: "",
      "Pelanggan/Status": result.answerText,
      "Qty/Stok": result.totalResults,
      Nilai: result.totalSales,
      Detail: `Estimasi laba: ${result.totalProfit}`
    }
  ];

  for (const sale of result.visibleSales) {
    rows.push({
      Jenis: "Transaksi",
      Kode: sale.code,
      Nama: sale.itemName,
      Cabang: sale.branchName,
      Tanggal: sale.date ?? "",
      "Pelanggan/Status": sale.customer,
      "Qty/Stok": sale.quantity,
      Nilai: sale.total,
      Detail: `${sale.paymentMethod} | ${sale.status} | laba ${sale.profit}`
    });
  }

  for (const branch of result.visibleBranches) {
    rows.push({
      Jenis: "Cabang",
      Kode: branch.code,
      Nama: branch.name,
      Cabang: branch.name,
      Tanggal: "",
      "Pelanggan/Status": branch.status,
      "Qty/Stok": branch.stockLimit,
      Nilai: branch.monthSales,
      Detail: `${branch.transactions} transaksi | produk teratas: ${branch.topProduct}`
    });
  }

  for (const product of result.visibleStock) {
    rows.push({
      Jenis: "Stok",
      Kode: product.code,
      Nama: product.name,
      Cabang: product.branchName,
      Tanggal: "",
      "Pelanggan/Status": getProductCategory(product.name),
      "Qty/Stok": product.stock,
      Nilai: product.price,
      Detail: ""
    });
  }

  for (const product of result.visibleExpired) {
    rows.push({
      Jenis: "Expired",
      Kode: product.code,
      Nama: product.name,
      Cabang: product.branchName,
      Tanggal: product.expiredAt ?? "",
      "Pelanggan/Status": product.status === "expired" ? "Expired" : "Mendekati expired",
      "Qty/Stok": product.stock,
      Nilai: 0,
      Detail: ""
    });
  }

  return rows;
}

function csvEscape(value: CellValue) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(rows: ExportRow[]) {
  const lines = [COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => csvEscape(row[column] ?? "")).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

function xmlEscape(value: CellValue) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function worksheetXml(rows: ExportRow[]) {
  const allRows = [Object.fromEntries(COLUMNS.map((column) => [column, column])) as ExportRow, ...rows];
  const sheetRows = allRows
    .map((row, rowIndex) => {
      const cells = COLUMNS.map((column, columnIndex) => {
        const value = row[column] ?? "";
        const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
        if (typeof value === "number") {
          return `<c r="${ref}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
      }).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function buildZip(files: Array<{ name: string; content: string }>) {
  const { dosTime, dosDate } = dosDateTime();
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const content = Buffer.from(file.content, "utf8");
    const crc = crc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function buildXlsx(rows: ExportRow[]) {
  return buildZip([
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    },
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hasil AI" sheetId="1" r:id="rId1"/></sheets></workbook>'
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml(rows)
    }
  ]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (!query) {
    return NextResponse.json({ error: "Query pencarian wajib diisi." }, { status: 400 });
  }

  const result = await buildAiSearchResponse(query);
  const rows = buildRows(query, result);
  const filename = makeFilename(query, format);

  if (format === "xlsx") {
    return new Response(buildXlsx(rows), {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    });
  }

  return new Response(buildCsv(rows), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}
