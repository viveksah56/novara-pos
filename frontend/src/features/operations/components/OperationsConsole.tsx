"use client";

import { useMemo, useState, type ReactNode } from "react";
import { formatDateTime } from "@/lib/formatDateTime";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  ClipboardList,
  Clock3,
  Coffee,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Package,
  PackagePlus,
  Pencil,
  Search,
  ShoppingBag,
  Settings,
  Truck,
  Users,
  UtensilsCrossed,
  Trash2,
} from "lucide-react";
import type { WorkspaceNavGroup } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceSearch } from "@/components/layout/WorkspaceSearch";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionDialog, type ActionModel } from "@/components/ui/alert-dialog";
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { useMenuCategories, useMenuProducts } from "@/features/menu/hooks/useMenuQueries";
import { useIngredients, useStock } from "@/features/inventory/hooks/useInventoryQueries";
import { usePurchaseOrders, useSuppliers } from "@/features/purchasing/hooks/usePurchases";
import { placePurchaseOrder, receivePurchase } from "@/features/purchasing/api/purchasingApi";
import { categoryFormSchema, productFormSchema } from "@/features/menu/schemas/menuSchemas";
import { ingredientFormSchema, stockAdjustmentSchema } from "@/features/inventory/schemas/inventorySchemas";
import { purchaseOrderFormSchema, supplierFormSchema } from "@/features/purchasing/schemas/purchaseSchemas";
import { apiClient, apiRequest, getErrorMessage } from "@/lib/api-client";

export type OperationsModule =
  | "categories"
  | "products"
  | "ingredients"
  | "recipes"
  | "inventory"
  | "suppliers"
  | "purchases"
  | "branches"
  | "team";
type Item = Record<string, unknown>;
const moduleTitles: Record<OperationsModule, string> = {
  categories: "Menu categories",
  products: "Products",
  ingredients: "Ingredients",
  recipes: "Recipes",
  inventory: "Inventory",
  suppliers: "Suppliers",
  purchases: "Purchases",
  branches: "Branches",
  team: "Team",
};
const resourceUrl = (tenantId: string, module: OperationsModule) =>
  `/tenants/${tenantId}/${module}`;

async function getRows(
  tenantId: string,
  module: OperationsModule,
  branchId?: string,
) {
  const path =
    module === "categories"
      ? "categories"
      : module === "products"
        ? "products"
        : module === "ingredients"
          ? "ingredients"
          : module === "recipes"
            ? "recipes"
            : module === "inventory"
              ? "inventory"
              : module === "suppliers"
                ? "suppliers"
                : module === "purchases"
                  ? "purchases"
                  : module === "branches"
                    ? "branches"
                    : "team";
  const result = await apiRequest<Record<string, unknown>>(
    apiClient.get(`/tenants/${tenantId}/${path}`, {
      params: branchId ? { branchId } : undefined,
    }),
  );
  const key =
    module === "categories"
      ? "categories"
      : module === "products"
        ? "products"
        : module === "ingredients"
          ? "ingredients"
          : module === "recipes"
            ? "recipes"
            : module === "inventory"
              ? "stock"
              : module === "suppliers"
                ? "suppliers"
                : module === "purchases"
                  ? "purchases"
                  : module === "branches"
                    ? "branches"
                    : "memberships";
  return (result[key] as Item[] | undefined) ?? [];
}
function rowText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object")
    return Array.isArray(value)
      ? value
          .map((entry) =>
            typeof entry === "object" && entry && "name" in entry
              ? String(entry.name)
              : "",
          )
          .filter(Boolean)
          .join(", ") || `${value.length} items`
      : "name" in value
        ? String(value.name)
        : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
function rowLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace("Id", "");
}

export function OperationsConsolePage({
  module,
}: {
  module: OperationsModule;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: authQueryKeys.loggedInUser,
    queryFn: authApi.getLoggedInUser,
    retry: false,
  });
  const memberships = profile.data?.memberships ?? [];
  const [tenantId, setTenantId] = useState("");
  const requestedTenantId = searchParams.get("tenantId") ?? tenantId;
  const activeMembership = memberships.find(({ tenant }) => tenant.id === requestedTenantId)
    ?? (!requestedTenantId ? memberships[0] : undefined);
  const activeTenantId = activeMembership?.tenant.id ?? "";
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteAction, setDeleteAction] = useState<ActionModel | null>(null);
  const [recipeLines, setRecipeLines] = useState([
    { ingredientId: "", quantity: "" },
  ]);
  const [purchaseLines, setPurchaseLines] = useState([
    { ingredientId: "", quantity: "", unit: "EACH", unitFactor: "1", unitCost: "" },
  ]);
  const [receivingPurchase, setReceivingPurchase] = useState<Item | null>(null);
  const [receivingQuantities, setReceivingQuantities] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [createdInviteUrl, setCreatedInviteUrl] = useState("");
  const [error, setError] = useState("");
  const branches = useQuery({
    queryKey: ["operations", activeTenantId, "branches"],
    queryFn: () => getRows(activeTenantId, "branches"),
    enabled: !!activeTenantId,
  });
  const pendingInvitationsQuery = useQuery({
    queryKey: ["operations", activeTenantId, "team-invitations"],
    queryFn: async () => (await apiRequest<{ invitations: { id: string; email: string; role: string; expiresAt: string; branches: { branchId: string; branch: { name: string } }[] }[] }>(apiClient.get(`/tenants/${activeTenantId}/team/invitations`))).invitations,
    enabled: !!activeTenantId && module === "team",
    retry: false,
  });
  const selectedBranchId =
    branchId || (branches.data?.[0]?.id as string | undefined) || "";
  const generalRowsQuery = useQuery({
    queryKey: ["operations", activeTenantId, module, selectedBranchId],
    queryFn: () =>
      getRows(
        activeTenantId,
        module,
        module === "inventory" ? selectedBranchId : undefined,
      ),
    enabled: !!activeTenantId && !["inventory", "purchases"].includes(module),
    retry: false,
  });
  const categories = useMenuCategories(activeTenantId, module === "products");
  const products = useMenuProducts(activeTenantId, module === "recipes");
  const ingredients = useIngredients(activeTenantId, ["recipes", "inventory", "purchases"].includes(module));
  const suppliers = useSuppliers(activeTenantId, module === "purchases");
  const stock = useStock(activeTenantId, selectedBranchId, module === "inventory");
  const purchaseOrders = usePurchaseOrders(activeTenantId, module === "purchases");
  const receiveMutation = useMutation({
    mutationFn: () => receivePurchase(activeTenantId, String(receivingPurchase?.id ?? ""), Object.entries(receivingQuantities).filter(([, value]) => Number(value) > 0).map(([purchaseItemId, value]) => ({ purchaseItemId, quantity: Number(value) }))),
    onSuccess: async () => { setReceivingPurchase(null); setError(""); setNotice("Delivery received. Stock quantities and weighted average costs were updated."); await Promise.all([queryClient.invalidateQueries({ queryKey: ["purchasing", activeTenantId] }), queryClient.invalidateQueries({ queryKey: ["inventory", activeTenantId] })]); },
    onError: (reason) => setError(getErrorMessage(reason)),
  });
  const rowsQuery = module === "inventory"
    ? { ...stock, data: stock.data?.stock as unknown as Item[] | undefined }
    : module === "purchases"
      ? { ...purchaseOrders, data: purchaseOrders.data as unknown as Item[] | undefined }
      : generalRowsQuery;
  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = resourceUrl(activeTenantId, module);
      const payload: Record<string, unknown> =
        module === "categories"
          ? { name: form.name, sortOrder: Number(form.sortOrder || 0), isActive: form.isActive !== "false" }
          : module === "products"
            ? {
                name: form.name,
                categoryId: form.categoryId || null,
                description: form.description || null,
                sku: form.sku || null,
                price: Number(form.price || 0),
                isAvailable: form.isAvailable !== "false",
              }
            : module === "ingredients"
              ? { name: form.name, unit: form.unit || "EACH", unitCost: form.unitCost === "" ? null : Number(form.unitCost), isActive: form.isActive !== "false" }
              : module === "suppliers"
                ? {
                    name: form.name,
                    email: form.email || null,
                    phone: form.phone || null,
                    address: form.address || null,
                    isActive: form.isActive !== "false",
                  }
                : module === "branches"
                  ? {
                      name: form.name,
                      timezone: form.timezone || "Asia/Kathmandu",
                    }
                  : module === "team"
                    ? {
                        role: form.role || "CASHIER",
                        ...(editingId ? {} : { email: form.email }),
                        branchIds: (form.branchIds || selectedBranchId)
                          .split(",")
                          .map((id) => id.trim())
                          .filter(Boolean),
                      }
                    : module === "inventory"
                      ? {
                          branchId: selectedBranchId,
                          ingredientId: form.ingredientId,
                          quantity: Number(form.quantity),
                          type: form.type || "ADJUSTMENT",
                          reorderLevel: Number(form.reorderLevel || 0),
                          note: form.note || undefined,
                        }
                      : module === "purchases"
                        ? {
                            branchId: selectedBranchId,
                            supplierId: form.supplierId,
                            reference: form.reference || null,
                            items: purchaseLines
                              .filter((line) => line.ingredientId && Number(line.quantity) > 0)
                              .map((line) => ({
                                ingredientId: line.ingredientId,
                                quantity: Number(line.quantity),
                                unit: line.unit,
                                unitFactor: Number(line.unitFactor || 1),
                                unitCost: Number(line.unitCost || 0),
                              })),
                          }
                        : {
                            productId: form.productId,
                            notes: form.notes || null,
                            ingredients: recipeLines
                              .filter(
                                (line) =>
                                  line.ingredientId &&
                                  Number(line.quantity) > 0,
                              )
                              .map((line) => ({
                                ingredientId: line.ingredientId,
                                quantity: Number(line.quantity),
                              })),
                          };
      const validatedPayload = module === "categories"
        ? categoryFormSchema.parse(payload)
        : module === "products"
          ? productFormSchema.parse(payload)
          : module === "ingredients"
            ? ingredientFormSchema.parse(payload)
            : module === "suppliers"
              ? supplierFormSchema.parse(payload)
            : module === "inventory"
              ? stockAdjustmentSchema.parse(payload)
              : module === "purchases"
                ? purchaseOrderFormSchema.parse(payload)
                : payload;
      const path = module === "inventory" ? `${url}/adjustments` : module === "team" && !editingId ? `${url}/invitations` : editingId ? `${url}/${editingId}` : url;
      const response =
        module === "recipes"
          ? apiClient.put(path, validatedPayload)
          : editingId
            ? apiClient.patch(path, validatedPayload)
            : apiClient.post(path, validatedPayload);
      return apiRequest<{ invitation?: { inviteUrl?: string } }>(response);
    },
    onSuccess: async (result) => {
      setForm({});
      setEditingId(null);
      setFormOpen(false);
      setRecipeLines([{ ingredientId: "", quantity: "" }]);
      setPurchaseLines([{ ingredientId: "", quantity: "", unit: "EACH", unitFactor: "1", unitCost: "" }]);
      setError("");
      setNotice(module === "team" ? "Invitation created. The team member can accept it from their email." : `${moduleTitles[module].replace(/s$/, "")} saved.`);
      setCreatedInviteUrl(result?.invitation?.inviteUrl ?? "");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operations", activeTenantId] }),
        queryClient.invalidateQueries({ queryKey: ["menu", activeTenantId] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", activeTenantId] }),
        queryClient.invalidateQueries({ queryKey: ["purchasing", activeTenantId] }),
      ]);
    },
    onError: (reason) => {
      setError(getErrorMessage(reason));
      setNotice("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteAction?.resourceId) return;
      return apiRequest(apiClient.delete(`${resourceUrl(activeTenantId, module)}/${deleteAction.resourceId}`));
    },
    onSuccess: async () => {
      setDeleteAction(null);
      await queryClient.invalidateQueries({ queryKey: ["operations", activeTenantId] });
      await queryClient.invalidateQueries({ queryKey: ["menu", activeTenantId] });
    },
    onError: (reason) => setError(getErrorMessage(reason)),
  });
  const revokeInvitation = useMutation({
    mutationFn: (invitationId: string) => apiRequest(apiClient.delete(`${resourceUrl(activeTenantId, "team")}/invitations/${invitationId}`)),
    onSuccess: async () => { setNotice("Invitation revoked."); await queryClient.invalidateQueries({ queryKey: ["operations", activeTenantId, "team-invitations"] }); },
    onError: (reason) => setError(getErrorMessage(reason)),
  });
  const filteredRows = useMemo(
    () =>
      (rowsQuery.data ?? []).filter((row) =>
        JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [rowsQuery.data, search],
  );
  const title = moduleTitles[module];
  const canManage =
    module === "branches"
      ? activeMembership?.role === "OWNER"
      : module === "team"
        ? ["OWNER", "MANAGER"].includes(activeMembership?.role ?? "")
        : ["OWNER", "MANAGER", "INVENTORY_MANAGER"].includes(
            activeMembership?.role ?? "",
          );
  const activeRole = activeMembership?.role ?? "";
  const canManageMenu = ["OWNER", "MANAGER"].includes(activeRole);
  const navGroups: WorkspaceNavGroup[] = [
    { label: "Workspace", items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard, allowed: canManageMenu },
      { label: "Point of sale", href: "/pos", icon: CreditCard, capability: "orders.create" },
      { label: "Kitchen queue", href: "/kitchen", icon: ChefHat, capability: "kitchen.orders.read" },
      { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
      { label: "Register shift", href: "/shift", icon: Clock3, capability: "shifts.read" },
    ] },
    { label: "Menu", items: [
      { label: "Categories", href: "/menu/categories", icon: Coffee, allowed: canManageMenu },
      { label: "Products", href: "/menu/products", icon: UtensilsCrossed, allowed: canManageMenu },
      { label: "Modifiers", href: "/menu/modifiers", icon: PackagePlus, allowed: canManageMenu },
      { label: "Recipes", href: "/inventory/recipes", icon: ChefHat, allowed: canManageMenu },
    ] },
    { label: "Inventory", items: [
      { label: "Inventory", href: "/inventory", icon: Boxes, capability: "inventory.read" },
      { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardList, capability: "inventory.read" },
      { label: "Ingredients", href: "/inventory/ingredients", icon: Package, capability: "inventory.read" },
      { label: "Suppliers", href: "/inventory/suppliers", icon: Truck, capability: "inventory.read" },
      { label: "Purchases", href: "/inventory/purchases", icon: ShoppingBag, capability: "inventory.read" },
      { label: "Stock reports", href: "/stock-reports", icon: BarChart3, capability: "reports.inventory.read" },
    ] },
    { label: "Reports", items: [
      { label: "Sales reports", href: "/reports", icon: BarChart3, capability: "reports.sales.read" },
      { label: "Expenses", href: "/expenses", icon: CreditCard, capability: "expenses.read" },
    ] },
    { label: "Business", items: [
      { label: "Team", href: "/team", icon: Users, allowed: ["OWNER", "MANAGER"].includes(activeRole) },
      { label: "Branches", href: "/settings/branches", icon: Building2, allowed: activeRole === "OWNER" },
      { label: "Business settings", href: "/settings", icon: Settings, capability: "settings.read" },
      { label: "Help & feedback", href: "/feedback", icon: LifeBuoy },
    ] },
  ];
  const sidebarFooter = (
    <div className="truncate rounded-xl bg-sidebar-accent p-3 text-xs text-muted-foreground">
      {activeMembership?.tenant.name ?? "Your workspace"}
      <p className="mt-1 capitalize">{activeRole.toLowerCase().replaceAll("_", " ")}</p>
    </div>
  );
  const columnKeys = filteredRows[0]
    ? Object.keys(filteredRows[0])
        .filter(
          (key) =>
            ![
              "tenantId",
              "createdAt",
              "updatedAt",
              "branchAssignments",
            ].includes(key),
        )
        .slice(0, 6)
    : [];
  const field = (
    key: string,
    label: string,
    type = "text",
    options?: { value: string; label: string }[],
  ) => (
    <label
      key={key}
      className="block text-xs font-medium text-muted-foreground"
    >
      {label}
      {options ? (
        <SelectField
          required={!(["categoryId"].includes(key))}
          value={String(form[key] ?? "")}
          onValueChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
          options={[{ value: "", label: `Select ${label.toLowerCase()}` }, ...options]}
          triggerClassName="mt-1.5"
        />
      ) : (
        <Input
          required={
            ![
              "description",
              "sku",
              "phone",
              "email",
              "address",
              "notes",
              "reference",
              "note",
              "reorderLevel",
              "unitCost",
              "sortOrder",
              "timezone",
            ].includes(key)
          }
          type={type}
          min={
            type === "number" && !(module === "inventory" && key === "quantity")
              ? "0"
              : undefined
          }
          value={form[key] ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, [key]: event.target.value }))
          }
          className="mt-1.5 h-10"
        />
      )}
    </label>
  );
  function formFields() {
    if (module === "categories")
      return (
        <>
          {field("name", "Category name")}
          {field("sortOrder", "Display order", "number")}
          {field("isActive", "Status", "text", [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }])}
        </>
      );
    if (module === "products")
      return (
        <>
          {field("name", "Product name")}
          {field("price", "Price", "number")}
          {field(
            "categoryId",
            "Category",
            "text",
            (categories.data ?? []).map((item) => ({
              value: String(item.id),
              label: String(item.name),
            })),
          )}
          {field("sku", "SKU")}
          {field("description", "Description")}
          {field("isAvailable", "Availability", "text", [{ value: "true", label: "Available" }, { value: "false", label: "Unavailable" }])}
        </>
      );
    if (module === "ingredients")
      return (
        <>
          {field("name", "Ingredient name")}
          {field("unitCost", "Cost per base unit", "number")}
          {field(
            "unit",
            "Unit",
            "text",
            [
              "EACH",
              "GRAM",
              "KILOGRAM",
              "MILLILITER",
              "LITER",
              "OUNCE",
              "POUND",
            ].map((value) => ({ value, label: value.toLowerCase() })),
          )}
          {field("isActive", "Status", "text", [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }])}
        </>
      );
    if (module === "suppliers")
      return (
        <>
          {field("name", "Supplier name")}
          {field("email", "Email", "email")}
          {field("phone", "Phone")}
          {field("address", "Address")}
          {field("isActive", "Status", "text", [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }])}
        </>
      );
    if (module === "branches")
      return (
        <>
          {field("name", "Branch name")}
          {field("timezone", "Timezone")}
        </>
      );
    if (module === "team")
      return (
        <>
          {!editingId ? field("email", "Account email", "email") : null}
          {field(
            "role",
            "Role",
            "text",
            [
              ...(activeMembership?.role === "OWNER" ? ["OWNER"] : []),
              "MANAGER",
              "CASHIER",
              "WAITER",
              "KITCHEN_STAFF",
              "INVENTORY_MANAGER",
            ].map((value) => ({
              value,
              label: value.toLowerCase().replaceAll("_", " "),
            })),
          )}
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Branch access</p>
            <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
              {(branches.data ?? []).map((branch) => {
                const branchKey = String(branch.id);
                const selected = (form.branchIds || selectedBranchId).split(",").filter(Boolean).includes(branchKey);
                return <label key={branchKey} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"><Checkbox checked={selected} onCheckedChange={(checked) => setForm((current) => {
                  const ids = new Set((current.branchIds || selectedBranchId).split(",").filter(Boolean));
                  if (checked === true) ids.add(branchKey); else ids.delete(branchKey);
                  return { ...current, branchIds: [...ids].join(",") };
                })} />{String(branch.name)}</label>;
              })}
            </div>
            {branches.isError ? <p className="text-xs text-destructive">{getErrorMessage(branches.error)}</p> : null}
          </div>
          <p className="col-span-full text-xs leading-5 text-muted-foreground">
            {editingId ? "Branch access is replaced with the IDs listed above." : "Assigns to the selected branch. This email must already have an active Novara account."}
          </p>
        </>
      );
    if (module === "inventory")
      return (
        <>
          {field(
            "ingredientId",
            "Ingredient",
            "text",
            (ingredients.data ?? []).map((item) => ({
              value: String(item.id),
              label: String(item.name),
            })),
          )}
          {field("quantity", "Quantity (negative to remove)", "number")}
          {field("type", "Movement", "text", [
            { value: "ADJUSTMENT", label: "Stock adjustment" },
            { value: "WASTE", label: "Waste" },
          ])}
          {field("reorderLevel", "Reorder level", "number")}
          {field("note", "Note")}
        </>
      );
    if (module === "purchases")
      return (
        <>
          {field(
            "supplierId",
            "Supplier",
            "text",
            (suppliers.data ?? []).map((item) => ({
              value: String(item.id),
              label: String(item.name),
            })),
          )}
          {field("reference", "Reference")}
          <div className="space-y-3 sm:col-span-2 xl:col-span-3">
            <p className="text-xs font-medium text-muted-foreground">Purchase items</p>
            {purchaseLines.map((line, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_110px_130px_110px_130px_auto]">
                <SelectField required aria-label={`Purchase ingredient ${index + 1}`} value={line.ingredientId} onValueChange={(value) => setPurchaseLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ingredientId: value, unit: String(ingredients.data?.find((ingredient) => String(ingredient.id) === value)?.unit ?? item.unit) } : item))} options={[{ value: "", label: "Select ingredient" }, ...(ingredients.data ?? []).map((item) => ({ value: String(item.id), label: String(item.name) }))]} />
                <Input required type="number" min="0.001" step="any" aria-label={`Quantity ${index + 1}`} placeholder="Quantity" value={line.quantity} onChange={(event) => setPurchaseLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} />
                <SelectField aria-label={`Purchase unit ${index + 1}`} value={line.unit} onValueChange={(value) => setPurchaseLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unit: value } : item))} options={["EACH", "GRAM", "KILOGRAM", "MILLILITER", "LITER", "OUNCE", "POUND"].map((unit) => ({ value: unit, label: unit.toLowerCase() }))} />
                <Input required type="number" min="0.000001" step="any" aria-label={`Base units per purchase unit ${index + 1}`} title="Base units per purchase unit" placeholder="Base factor" value={line.unitFactor} onChange={(event) => setPurchaseLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitFactor: event.target.value } : item))} />
                <Input required type="number" min="0" step="any" aria-label={`Unit cost ${index + 1}`} placeholder="Unit cost" value={line.unitCost} onChange={(event) => setPurchaseLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitCost: event.target.value } : item))} />
                {purchaseLines.length > 1 ? <Button type="button" variant="outline" onClick={() => setPurchaseLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button> : null}
              </div>
            ))}
            <p className="text-[11px] leading-5 text-muted-foreground">Enter the conversion factor into the ingredient’s base unit. Example: 1 kg purchased for a gram-based ingredient uses factor 1,000.</p>
            <Button type="button" variant="outline" onClick={() => setPurchaseLines((current) => [...current, { ingredientId: "", quantity: "", unit: "EACH", unitFactor: "1", unitCost: "" }])}>Add item</Button>
          </div>
        </>
      );
    if (module === "recipes")
      return (
        <>
          {field(
            "productId",
            "Menu product",
            "text",
            (products.data ?? []).map((item) => ({
              value: String(item.id),
              label: String(item.name),
            })),
          )}
          <div className="space-y-3 sm:col-span-2 xl:col-span-3">
            <p className="text-xs font-medium text-muted-foreground">
              Recipe ingredients
            </p>
            {recipeLines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 sm:grid-cols-[1fr_160px_auto]"
              >
                <SelectField
                  required
                  aria-label={`Ingredient ${index + 1}`}
                  value={line.ingredientId}
                  onValueChange={(value) => setRecipeLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ingredientId: value } : item))}
                  options={[{ value: "", label: "Select ingredient" }, ...(ingredients.data ?? []).map((item) => ({ value: String(item.id), label: String(item.name) }))]}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRecipeLines((current) => [
                  ...current,
                  { ingredientId: "", quantity: "" },
                ])
              }
            >
              Add ingredient
            </Button>
          </div>
          {field("notes", "Preparation notes")}
        </>
      );
    return null;
  }
  function rowActions(row: Item) {
    const actions: ReactNode[] = [];
    if (["categories", "products", "ingredients", "suppliers"].includes(module) && canManage) {
      actions.push(
        <Button
          key="edit"
          size="sm"
          variant="outline"
          onClick={() => {
            const editableKeys = module === "categories"
              ? ["name", "sortOrder", "isActive"]
              : module === "products"
                ? ["name", "categoryId", "description", "sku", "price", "isAvailable"]
                : module === "ingredients"
                  ? ["name", "unit", "unitCost", "isActive"]
                  : ["name", "email", "phone", "address", "isActive"];
            const nextForm: Record<string, string> = {};
            for (const key of editableKeys) {
              const value = row[key];
              nextForm[key] = value === null || value === undefined ? "" : String(value);
            }
            setForm(nextForm);
            setEditingId(String(row.id));
            setFormOpen(true);
            setError("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <Pencil className="size-3.5" /> Edit
        </Button>,
      );
      if (["categories", "products"].includes(module) && (activeRole === "OWNER" || (module === "products" && activeRole === "MANAGER"))) {
        actions.push(
          <Button
            key="delete"
            size="sm"
            variant="outline"
            aria-label={`Delete ${String(row.name ?? "record")}`}
            onClick={() => setDeleteAction({ kind: "DELETE_RECORD", subject: String(row.name ?? "record"), resourceId: String(row.id) })}
          >
            <Trash2 className="size-3.5" />
          </Button>,
        );
      }
    }
    if (module === "purchases" && row.status === "DRAFT")
      actions.push(
        <Button key="place-order" size="sm" variant="outline" onClick={async () => {
          try {
            await placePurchaseOrder(activeTenantId, String(row.id));
            await queryClient.invalidateQueries({ queryKey: ["purchasing", activeTenantId, "orders"] });
            setNotice("Purchase order placed with the supplier.");
          } catch (reason) { setError(getErrorMessage(reason)); }
        }}>Place order</Button>,
      );
    if (module === "purchases" && ["ORDERED", "PARTIALLY_RECEIVED"].includes(String(row.status)))
      actions.push(
        <Button key="receive" size="sm" variant="outline" onClick={() => {
          const items = Array.isArray(row.items) ? row.items as Item[] : [];
          setReceivingPurchase(row);
          setReceivingQuantities(Object.fromEntries(items.map((item) => [String(item.id), String(Math.max(0, Number(item.quantity) - Number(item.receivedQuantity ?? 0)))])));
          setError("");
        }}>
          <PackagePlus className="size-4" /> Receive
        </Button>,
      );
    if (module === "team" && row.role !== "OWNER") {
      if (row.isActive) {
        actions.push(<Button key="edit-member" size="sm" variant="outline" onClick={() => {
          setForm({ role: String(row.role), branchIds: Array.isArray(row.branchAssignments) ? row.branchAssignments.map((assignment) => String((assignment as Item).branchId)).join(",") : selectedBranchId });
          setEditingId(String(row.id)); setFormOpen(true); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
        }}><Pencil className="size-3.5" /> Edit access</Button>);
        actions.push(<Button key="remove-access" size="sm" variant="outline" onClick={() => setDeleteAction({ kind: "DEACTIVATE_MEMBER", subject: String((row.user as Item | undefined)?.email ?? "this team member"), resourceId: String(row.id) })}>Remove access</Button>);
      } else {
        actions.push(<Button key="reactivate" size="sm" variant="outline" onClick={async () => {
          try { await apiRequest(apiClient.post(`${resourceUrl(activeTenantId, module)}/${row.id}/reactivate`, {})); await queryClient.invalidateQueries({ queryKey: ["operations", activeTenantId] }); setNotice("Team member access restored."); }
          catch (reason) { setError(getErrorMessage(reason)); }
        }}>Reactivate</Button>);
      }
    }
    return actions.length ? <div className="flex justify-end gap-2">{actions}</div> : null;
  }
  if (profile.isPending)
    return <div className="min-h-screen animate-pulse bg-secondary/30" />;
  if (profile.isError || !activeMembership)
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="max-w-lg rounded-2xl border border-border bg-card p-7">
          <h1 className="text-xl font-semibold">
            Workspace access is unavailable
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile.isError
              ? getErrorMessage(profile.error)
              : "Choose a business workspace with the required role."}
          </p>
          <Button className="mt-5" onClick={() => router.replace("/dashboard")}>
            Return to dashboard
          </Button>
        </section>
      </main>
    );
  const receivingItems = Array.isArray(receivingPurchase?.items) ? receivingPurchase.items as Item[] : [];
  const validReceiveLines = receivingItems.filter((item) => {
    const quantity = Number(receivingQuantities[String(item.id)] ?? 0);
    return quantity > 0 && quantity <= Math.max(0, Number(item.quantity) - Number(item.receivedQuantity ?? 0));
  });
  return (<>


      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground sm:block">
                Novara · {activeMembership.tenant.name}
              </p>
              <h1 className="text-base font-semibold">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WorkspaceSearch groups={navGroups} />
            <ThemeToggle />
            <span className="hidden text-xs text-muted-foreground sm:block">
              {profile.data?.name}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-4 pb-10 sm:p-7 xl:px-10 xl:py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                Business operations
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {module === "inventory"
                  ? "On-hand stock, recent activity and low-stock visibility for your selected branch."
                  : module === "purchases"
                    ? "Create supplier purchase orders and receive deliveries into branch stock."
                    : module === "team"
                      ? "Invite existing Novara accounts and scope access to the selected branch."
                      : "Organize the items and resources your team needs to deliver great service."}
              </p>
            </div>
            {memberships.length > 1 ? (
              <SelectField
                aria-label="Switch business"
                value={activeTenantId}
                onValueChange={(value) => {
                  setTenantId(value);
                  router.push(`${pathname}?tenantId=${value}`);
                }}
                options={memberships.map(({ tenant }) => ({ value: tenant.id, label: tenant.name }))}
                triggerClassName="min-w-48"
              />
            ) : null}
          </div>
          {module === "inventory" || module === "purchases" ? (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <label className="text-xs font-medium text-muted-foreground">
                {module === "inventory" ? "Branch" : "Receiving branch"}
              </label>
              <SelectField
                aria-label="Inventory branch"
                value={selectedBranchId}
                onValueChange={setBranchId}
                options={(branches.data ?? []).map((branch) => ({ value: String(branch.id), label: String(branch.name) }))}
                triggerClassName="min-w-48"
              />
            </div>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="mb-4 rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-3 text-sm"
            >
              {notice}
            </p>
          ) : null}
          {createdInviteUrl ? <div className="mb-4 break-all rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm"><p className="font-medium">Development invitation link</p><a className="mt-1 inline-block text-primary underline underline-offset-4" href={createdInviteUrl}>{createdInviteUrl}</a><p className="mt-1 text-xs text-muted-foreground">This link is shown locally when email delivery is not configured.</p></div> : null}
          {module === "team" ? <section className="mb-5 rounded-2xl border border-border/75 bg-card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Pending invitations</h3><p className="mt-1 text-xs text-muted-foreground">Invitations expire after seven days and can be revoked at any time.</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{pendingInvitationsQuery.data?.length ?? 0}</span></div>{pendingInvitationsQuery.isPending ? <div className="h-14 animate-pulse rounded-lg bg-secondary/60" /> : pendingInvitationsQuery.isError ? <div role="alert" className="text-sm text-destructive">{getErrorMessage(pendingInvitationsQuery.error)} <Button size="sm" variant="outline" onClick={() => void pendingInvitationsQuery.refetch()}>Retry</Button></div> : pendingInvitationsQuery.data?.length ? <div className="space-y-2">{pendingInvitationsQuery.data.map((invitation) => <div key={invitation.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{invitation.email}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{invitation.role.toLowerCase().replaceAll("_", " ")} · {invitation.branches.map(({ branch }) => branch.name).join(", ")} · expires {formatDateTime(new Date(invitation.expiresAt), "en", { dateStyle: "medium" })}</p></div><Button size="sm" variant="outline" disabled={revokeInvitation.isPending} onClick={() => revokeInvitation.mutate(invitation.id)}>Revoke</Button></div>)}</div> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No pending invitations.</p>}</section> : null}
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {canManage ? (
            <details className="mb-5 rounded-2xl border border-border bg-card" open={formOpen} onToggle={(event) => setFormOpen(event.currentTarget.open)}>
              <summary className="cursor-pointer list-none p-4 text-sm font-semibold">
                {editingId ? `Edit ${title.toLowerCase().replace(/s$/, "")}` : `Add ${title.toLowerCase().replace(/s$/, "")}`}{" "}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {formOpen ? "Close form" : "Open form"}
                </span>
              </summary>
              <form
                className="grid gap-4 border-t border-border p-4 sm:grid-cols-2 xl:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError("");
                  saveMutation.mutate();
                }}
              >
                {formFields()}
                <div className="flex items-end">
                  <Button disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving…" : editingId ? "Update" : "Save"}
                    <ArrowRight className="size-4" />
                  </Button>
                  {editingId ? <Button type="button" variant="outline" className="ml-2" onClick={() => { setEditingId(null); setForm({}); }}>Cancel edit</Button> : null}
                </div>
              </form>
            </details>
          ) : null}
          <section className="overflow-hidden rounded-2xl border border-border/75 bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-5">
              <div>
                <h3 className="font-semibold">
                  {module === `inventory` ? "Stock by ingredient" : title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {filteredRows.length} records · scoped to{" "}
                  {activeMembership.tenant.name}
                </p>
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 pl-9"
                  placeholder={`Search ${title.toLowerCase()}…`}
                  aria-label={`Search ${title}`}
                />
              </label>
            </div>
            {rowsQuery.isPending ? (
              <div className="space-y-3 p-5">
                <div className="h-10 animate-pulse rounded-lg bg-secondary" />
                <div className="h-10 animate-pulse rounded-lg bg-secondary" />
                <div className="h-10 animate-pulse rounded-lg bg-secondary" />
              </div>
            ) : rowsQuery.isError ? (
              <div role="alert" className="p-6 text-sm text-destructive">
                {getErrorMessage(rowsQuery.error)}{" "}
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={() => void rowsQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <DataTable
                rows={filteredRows}
                columns={columnKeys.map((key) => ({
                  id: key,
                  header: rowLabel(key),
                  className: key === "message" ? "max-w-72 truncate" : undefined,
                  cell: (row: Item) => key === "status" || key === "isActive" || key === "isAvailable"
                    ? <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium">{rowText(row[key])}</span>
                    : <span className="block truncate">{rowText(row[key])}</span>,
                }))}
                getRowId={(row, index) => String(row.id ?? index)}
                actions={rowActions}
                empty={(
                  <div className="px-6 py-14 text-center">
                    <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-primary"><Activity className="size-5" /></span>
                    <h4 className="mt-4 font-semibold">{search ? "No results found" : `No ${title.toLowerCase()} yet`}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{search ? "Try a different search." : "Create your first record to start building this workspace."}</p>
                  </div>
                )}
              />
            )}
          </section>
        </main>
      </SidebarInset>
      <Dialog open={Boolean(receivingPurchase)} onOpenChange={(open) => { if (!open && !receiveMutation.isPending) setReceivingPurchase(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Receive delivery</DialogTitle><DialogDescription>Enter the quantity received for each purchase line. You can record a partial delivery and receive the remainder later.</DialogDescription></DialogHeader>
          <div className="space-y-3">{receivingItems.map((item) => {
            const remaining = Math.max(0, Number(item.quantity) - Number(item.receivedQuantity ?? 0));
            const ingredient = item.ingredient as Item | undefined;
            return <div key={String(item.id)} className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_110px_150px]"><div className="min-w-0"><p className="truncate text-sm font-medium">{String(ingredient?.name ?? "Ingredient")}</p><p className="mt-1 text-xs text-muted-foreground">Received {Number(item.receivedQuantity ?? 0)} of {Number(item.quantity)} {String(item.unit ?? ingredient?.unit ?? "units").toLowerCase()} · {remaining} remaining</p></div><Input type="number" min="0" max={remaining} step="any" aria-label={`Receive quantity for ${String(ingredient?.name ?? "ingredient")}`} value={receivingQuantities[String(item.id)] ?? "0"} onChange={(event) => setReceivingQuantities((current) => ({ ...current, [String(item.id)]: event.target.value }))} /><span className="text-xs text-muted-foreground">to receive now</span></div>;
          })}</div>
          <DialogFooter><Button type="button" variant="outline" disabled={receiveMutation.isPending} onClick={() => setReceivingPurchase(null)}>Cancel</Button><Button type="button" disabled={!validReceiveLines.length || receiveMutation.isPending} onClick={() => receiveMutation.mutate()}><PackagePlus aria-hidden />{receiveMutation.isPending ? "Receiving…" : `Receive ${validReceiveLines.length} line${validReceiveLines.length === 1 ? "" : "s"}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {deleteAction ? (
        <ActionDialog
          action={deleteAction}
          open
          pending={deleteMutation.isPending}
          onOpenChange={(open) => { if (!open) setDeleteAction(null); }}
          onConfirm={() => deleteMutation.mutate()}
          error={deleteMutation.error ? getErrorMessage(deleteMutation.error) : undefined}
        />
      ) : null}

  </>);
}
