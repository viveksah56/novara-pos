/**
 * Local demo identities for each Novara role. Passwords are deliberately not
 * stored here; the seed command reads DEMO_PASSWORD from backend/.env.local.
 */
export type BusinessSeedRole =
  | "OWNER"
  | "MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN_STAFF"
  | "INVENTORY_MANAGER";

export type PlatformSeedRole = "SUPER_ADMIN" | "SUPPORT_AGENT";

export type UserSeedRecord =
  | {
      id: string;
      name: string;
      email: string;
      scope: "BUSINESS";
      role: BusinessSeedRole;
    }
  | {
      id: string;
      name: string;
      email: string;
      scope: "PLATFORM";
      role: PlatformSeedRole;
    };

/** Eight login identities: six business roles and both platform roles. */
export const userSeedData = [
  { id: "00000000-0000-4000-8000-000000000201", name: "Novara Demo Owner", email: "owner@test.com", scope: "BUSINESS", role: "OWNER" },
  { id: "00000000-0000-4000-8000-000000000202", name: "Novara Demo Manager", email: "manager@test.com", scope: "BUSINESS", role: "MANAGER" },
  { id: "00000000-0000-4000-8000-000000000203", name: "Novara Demo Cashier", email: "cashier@test.com", scope: "BUSINESS", role: "CASHIER" },
  { id: "00000000-0000-4000-8000-000000000204", name: "Novara Demo Waiter", email: "waiter@test.com", scope: "BUSINESS", role: "WAITER" },
  { id: "00000000-0000-4000-8000-000000000205", name: "Novara Demo Kitchen", email: "kitchen@test.com", scope: "BUSINESS", role: "KITCHEN_STAFF" },
  { id: "00000000-0000-4000-8000-000000000206", name: "Novara Demo Inventory Manager", email: "inventory@test.com", scope: "BUSINESS", role: "INVENTORY_MANAGER" },
  { id: "00000000-0000-4000-8000-000000000207", name: "Novara Demo Super Admin", email: "admin@test.com", scope: "PLATFORM", role: "SUPER_ADMIN" },
  { id: "00000000-0000-4000-8000-000000000208", name: "Novara Demo Support Agent", email: "support@test.com", scope: "PLATFORM", role: "SUPPORT_AGENT" },
] as const satisfies readonly UserSeedRecord[];
