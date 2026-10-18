import { parseTabularImportFile } from "@/features/menu/lib/productImport";

export type InventoryImportPayload = {
  ingredientId: string;
  quantity: number;
  type: "ADJUSTMENT" | "WASTE";
  reorderLevel?: number;
  note?: string;
};

export type InventoryImportRow = {
  row: number;
  payload?: InventoryImportPayload;
  error?: string;
};

function rowsFromObjects(value: unknown): string[][] {
  if (!Array.isArray(value)) throw new Error("JSON imports must be an array of stock movement objects.");
  const header = ["ingredient", "quantity", "type", "reorderLevel", "note"];
  return [header, ...value.map((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return [record.ingredient ?? record.ingredientName ?? record.ingredientId, record.quantity, record.type, record.reorderLevel, record.note]
      .map((entry) => entry == null ? "" : String(entry));
  })];
}

export async function parseInventoryImport(file: File, ingredients: { id: string; name: string }[]): Promise<InventoryImportRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a file smaller than 5 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const rows = extension === "json"
    ? rowsFromObjects(JSON.parse(await file.text()) as unknown)
    : await parseTabularImportFile(file);
  if (rows.length < 2) throw new Error("Add a header row and at least one stock movement.");
  if (rows.length > 1001) throw new Error("Import up to 1,000 stock movements at a time.");

  const headers = rows[0].map((value) => value.trim().toLowerCase().replace(/[ _-]+/g, ""));
  const column = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const ingredientIndex = column("ingredient", "ingredientname", "ingredientid");
  const quantityIndex = column("quantity", "change");
  const typeIndex = column("type", "movement");
  const reorderIndex = column("reorderlevel");
  const noteIndex = column("note", "reason");
  if (ingredientIndex < 0 || quantityIndex < 0) throw new Error("Include `ingredient` and `quantity` columns.");
  const ingredientsByName = new Map(ingredients.map((ingredient) => [ingredient.name.trim().toLowerCase(), ingredient]));
  const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  return rows.slice(1).map((values, offset) => {
    const read = (index: number) => index < 0 ? "" : String(values[index] ?? "").trim();
    const ingredientKey = read(ingredientIndex);
    const ingredient = ingredientsById.get(ingredientKey) ?? ingredientsByName.get(ingredientKey.toLowerCase());
    if (!ingredient) return { row: offset + 2, error: `Unknown ingredient “${ingredientKey}”.` };
    const quantity = Number(read(quantityIndex));
    if (!Number.isFinite(quantity) || quantity === 0) return { row: offset + 2, error: "Quantity must be a non-zero number." };
    const rawType = (read(typeIndex) || "ADJUSTMENT").toUpperCase();
    if (rawType !== "ADJUSTMENT" && rawType !== "WASTE") return { row: offset + 2, error: "Movement must be ADJUSTMENT or WASTE." };
    const type: InventoryImportPayload["type"] = rawType === "WASTE" ? "WASTE" : "ADJUSTMENT";
    const reorderText = read(reorderIndex);
    const reorderLevel = reorderText ? Number(reorderText) : undefined;
    if (reorderText && (!Number.isFinite(reorderLevel) || Number(reorderLevel) < 0)) return { row: offset + 2, error: "Reorder level must be zero or greater." };
    const note = read(noteIndex);
    if (note.length > 500) return { row: offset + 2, error: "Note must be 500 characters or fewer." };
    return {
      row: offset + 2,
      payload: {
        ingredientId: ingredient.id,
        quantity,
        type,
        ...(reorderLevel === undefined ? {} : { reorderLevel }),
        ...(note ? { note } : {}),
      },
    };
  }).filter((row) => row.payload || row.error);
}
