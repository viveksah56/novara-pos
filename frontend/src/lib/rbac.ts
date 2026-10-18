/** Capabilities used by the optimistic route guard. The API repeats every check. */
import { BUSINESS_ROLE_CAPABILITIES, BUSINESS_ROLE_VALUES, type AppRole, type BusinessRole, type Capability, type PlatformRole as PersistedPlatformRole } from "@/constants/system-constants";

export type { BusinessRole, Capability } from "@/constants/system-constants";
export type PlatformRole = PersistedPlatformRole | "PLATFORM_ADMIN";
export type WorkspaceRole = AppRole;

export const ROUTE_CAPABILITIES: ReadonlyArray<{ path: string; capability: Capability }> = [
  { path: "/dashboard/reports", capability: "reports.sales.read" },
  { path: "/dashboard/inventory", capability: "inventory.read" },
  { path: "/dashboard/settings", capability: "settings.read" },
  { path: "/reports", capability: "reports.sales.read" },
  { path: "/stock-reports", capability: "reports.inventory.read" },
  { path: "/expenses", capability: "expenses.read" },
  { path: "/inventory/recipes", capability: "menu.manage" },
  { path: "/inventory", capability: "inventory.read" },
  { path: "/menu", capability: "menu.manage" },
  { path: "/team", capability: "staff.read" },
  { path: "/subscription", capability: "subscription.manage" },
  { path: "/audit-log", capability: "audit.read" },
  { path: "/inventory/purchases", capability: "purchases.manage" },
  { path: "/inventory/suppliers", capability: "suppliers.manage" },
  { path: "/settings", capability: "settings.read" },
  { path: "/branches", capability: "settings.read" },
  { path: "/orders", capability: "orders.read" },
  { path: "/tables", capability: "orders.read" },
  { path: "/shift", capability: "shifts.read" },
  { path: "/pos", capability: "orders.create" },
  { path: "/kitchen", capability: "kitchen.orders.read" },
];

export const ROLE_CAPABILITIES = BUSINESS_ROLE_VALUES.reduce((roles, role) => {
  roles[role] = new Set(BUSINESS_ROLE_CAPABILITIES[role]);
  return roles;
}, {} as Record<BusinessRole, ReadonlySet<Capability>>);


export function capabilityForPath(pathname: string): Capability | undefined {
  return ROUTE_CAPABILITIES
    .filter(({ path }) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0]?.capability;
}

export function roleHasCapability(role: string | undefined, capability: Capability): boolean {
  return role !== undefined && role in ROLE_CAPABILITIES && ROLE_CAPABILITIES[role as BusinessRole].has(capability);
}
