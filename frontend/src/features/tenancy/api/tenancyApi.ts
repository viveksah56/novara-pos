import { apiClient, apiRequest } from "@/lib/api-client";
import type { BranchSettingsInput, TenantProfileInput } from "@/features/tenancy/schemas/tenancySchemas";

export type TenantProfile = TenantProfileInput & { id: string; slug: string; status: "ACTIVE" | "SUSPENDED"; currency: string };
export type BranchSettings = Omit<BranchSettingsInput, "taxRate" | "serviceChargeRate" | "shiftVarianceTolerance" | "cashierMaxDiscountPercent"> & {
  id: string; tenantId: string; isActive: boolean; createdAt: string; updatedAt: string;
  taxRate: number | string; serviceChargeRate: number | string; shiftVarianceTolerance: number | string; cashierMaxDiscountPercent: number | string;
};
const scoped = (tenantId: string) => ({ headers: { "X-Tenant-Id": tenantId } });
export const tenancyKeys = { all: ["tenancy"] as const, tenant: (id: string) => ["tenancy", id, "tenant"] as const, branches: (id: string, includeInactive = false) => ["tenancy", id, "branches", includeInactive] as const, branch: (tenantId: string, branchId: string) => ["tenancy", tenantId, "branch", branchId] as const };
export const tenancyApi = {
  getTenant: (tenantId: string) => apiRequest<{ tenant: TenantProfile }>(apiClient.get("/tenants/current", scoped(tenantId))).then(({ tenant }) => tenant),
  updateTenant: (tenantId: string, input: TenantProfileInput) => apiRequest<{ tenant: TenantProfile }>(apiClient.patch("/tenants/current", input, scoped(tenantId))).then(({ tenant }) => tenant),
  getBranches: (tenantId: string, includeInactive = false) => apiRequest<{ branches: BranchSettings[] }>(apiClient.get("/branches", { ...scoped(tenantId), params: includeInactive ? { includeInactive: true } : undefined })).then(({ branches }) => branches),
  getBranch: (tenantId: string, branchId: string) => apiRequest<{ branch: BranchSettings }>(apiClient.get(`/branches/${branchId}`, scoped(tenantId))).then(({ branch }) => branch),
  createBranch: (tenantId: string, input: BranchSettingsInput) => apiRequest<{ branch: BranchSettings }>(apiClient.post("/branches", input, scoped(tenantId))).then(({ branch }) => branch),
  createDiningTable: (tenantId: string, input: { branchId: string; name: string; section: string | null; seats: number; sortOrder: number; isActive: boolean }) => apiRequest<{ table: { id: string } }>(apiClient.post(`/tenants/${tenantId}/tables`, input, scoped(tenantId))),
  updateBranch: (tenantId: string, branchId: string, input: Partial<BranchSettingsInput>) => apiRequest<{ branch: BranchSettings }>(apiClient.patch(`/branches/${branchId}`, input, scoped(tenantId))).then(({ branch }) => branch),
  deactivateBranch: (tenantId: string, branchId: string) => apiRequest<{ branch: BranchSettings; deactivated: boolean }>(apiClient.post(`/branches/${branchId}/deactivate`, {}, scoped(tenantId))),
};
