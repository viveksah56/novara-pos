import { productFormSchema } from "@/features/menu/schemas/menuSchemas";

export type ImportedProduct = {
  name: string;
  sku: string | null;
  price: number;
  categoryId: string | null;
  description: string | null;
  isAvailable: boolean;
};

export type ProductImportRow = {
  row: number;
  product?: ImportedProduct;
  error?: string;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function excelColumnIndex(reference: string): number {
  let result = 0;
  for (const char of reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A") {
    result = result * 26 + char.charCodeAt(0) - 64;
  }
  return result - 1;
}

type ZipEntry = { offset: number; compressedSize: number; uncompressedSize: number; method: number };

async function readZipEntry(file: File, entries: Map<string, ZipEntry>, name: string): Promise<string | undefined> {
  const entry = entries.get(name);
  if (!entry) return undefined;
  if (entry.uncompressedSize > 5 * 1024 * 1024) throw new Error("An Excel sheet exceeds the 5 MB import limit.");
  const bytes = new Uint8Array(await file.slice(entry.offset, entry.offset + entry.compressedSize).arrayBuffer());
  const expanded = entry.method === 0
    ? bytes
    : entry.method === 8
      ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer())
      : null;
  if (!expanded) throw new Error("This Excel workbook uses an unsupported compression method.");
  return new TextDecoder().decode(expanded);
}

async function parseXlsx(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("The selected file is not a valid .xlsx workbook.");
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("The Excel workbook is damaged.");
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    entries.set(name, { offset: localOffset + 30 + localNameLength + localExtraLength, compressedSize, uncompressedSize, method });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const worksheet = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!worksheet) throw new Error("The workbook has no worksheet to import.");
  const [sheetXml, sharedXml] = await Promise.all([
    readZipEntry(file, entries, worksheet),
    readZipEntry(file, entries, "xl/sharedStrings.xml"),
  ]);
  if (!sheetXml) throw new Error("Could not read the first worksheet.");
  const parser = new DOMParser();
  const shared = sharedXml ? [...parser.parseFromString(sharedXml, "application/xml").querySelectorAll("si")].map((item) => [...item.querySelectorAll("t")].map((text) => text.textContent ?? "").join("")) : [];
  const document = parser.parseFromString(sheetXml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The Excel worksheet XML is invalid.");
  return [...document.querySelectorAll("sheetData row")].map((xmlRow) => {
    const result: string[] = [];
    for (const cell of [...xmlRow.querySelectorAll(":scope > c")]) {
      const index = excelColumnIndex(cell.getAttribute("r") ?? "A");
      const value = cell.querySelector("v")?.textContent ?? cell.querySelector("is t")?.textContent ?? "";
      result[index] = cell.getAttribute("t") === "s" ? shared[Number(value)] ?? "" : value;
    }
    return result.map((value) => value ?? "");
  }).filter((row) => row.some(Boolean));
}

function toRecordRows(rows: string[][], categories: { id: string; name: string }[]): ProductImportRow[] {
  if (rows.length < 2) throw new Error("Add a header row and at least one product row.");
  if (rows.length > 5001) throw new Error("Import up to 5,000 products at a time.");
  const header = rows[0].map((value) => value.trim().toLowerCase().replace(/[ _-]+/g, ""));
  const index = (key: string) => header.indexOf(key);
  if (index("name") < 0 || index("price") < 0) throw new Error("The file needs at least `name` and `price` columns.");
  const categoryMap = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category.id]));
  return rows.slice(1).map((values, offset) => {
    const read = (key: string) => index(key) < 0 ? "" : String(values[index(key)] ?? "").trim();
    const category = read("category") || read("categoryid");
    const rawAvailable = read("isavailable").toLowerCase();
    const payload = {
      name: read("name"),
      sku: read("sku") || null,
      price: Number(read("price")),
      categoryId: category ? categoryMap.get(category.toLowerCase()) ?? (categories.some((item) => item.id === category) ? category : null) : null,
      description: read("description") || null,
      isAvailable: !["false", "0", "no", "inactive"].includes(rawAvailable),
    };
    const parsed = productFormSchema.safeParse(payload);
    if (!parsed.success) return { row: offset + 2, error: parsed.error.issues[0]?.message ?? "Invalid product row." };
    if (category && !parsed.data.categoryId) return { row: offset + 2, error: `Unknown category “${category}”.` };
    return {
      row: offset + 2,
      product: {
        ...parsed.data,
        sku: parsed.data.sku ?? null,
        description: parsed.data.description ?? null,
        categoryId: parsed.data.categoryId ?? null,
      },
    };
  });
}

export async function parseProductImportFile(file: File, categories: { id: string; name: string }[]): Promise<ProductImportRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a file smaller than 5 MB.");
  if (extension === "json") {
    const value: unknown = JSON.parse(await file.text());
    if (!Array.isArray(value)) throw new Error("JSON imports must be an array of product objects.");
    const header = ["name", "sku", "price", "category", "description", "isAvailable"];
    const rows = [header, ...value.map((item) => {
      if (!item || typeof item !== "object") return [];
      const product = item as Record<string, unknown>;
      return [product.name, product.sku, product.price, product.category ?? product.categoryName ?? product.categoryId, product.description, product.isAvailable].map((entry) => entry == null ? "" : String(entry));
    })];
    return toRecordRows(rows, categories);
  }
  return toRecordRows(await parseTabularImportFile(file), categories);
}

export async function parseTabularImportFile(file: File): Promise<string[][]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a file smaller than 5 MB.");
  if (extension === "csv") return parseCsv(await file.text());
  if (extension === "xlsx") return parseXlsx(file);
  throw new Error("Choose a JSON, CSV, or .xlsx file.");
}
