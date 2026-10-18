import { apiClient, apiRequest, type ApiSuccess } from "@/lib/api-client";
import type { PlatformRole, TenantStatus, SubscriptionStatus, PlatformTicketType, PlatformTicketStatus, PlatformTicketPriority } from "@/constants/system-constants";

export type { PlatformRole } from "@/constants/system-constants";
export type BusinessStatus = TenantStatus;
export type PlatformBusiness = {
  id: string; name: string; status: BusinessStatus; currency: string; planId: string | null;
  createdAt: string; plan: { id: string; name: string; priceMonthly: number | string; currency: string } | null;
  _count: { branches: number; memberships: number };
};
export type BusinessDetails = PlatformBusiness & {
  branches: { id: string; name: string; timezone: string; createdAt: string }[];
  memberships: { role: string; user: { id: string; name: string; email: string; isActive: boolean } }[];
};
export type SubscriptionPlan = {
  id: string; name: string; description: string | null; priceMonthly: number | string; currency: string;
  trialDays: number; maxBranches: number | null; maxStaff: number | null; isActive: boolean;
  createdAt: string; updatedAt: string; _count: { tenants: number };
};
export type SupportAgent = {
  id: string; role: PlatformRole; createdAt: string;
  user: { id: string; name: string; email: string; isActive: boolean };
};
export type PlatformOverview = {
  metrics: { businesses: number; activeBusinesses: number; suspendedBusinesses: number; users: number; activePlans: number; unassignedBusinesses: number; trialsEndingSoon: number; pastDueSubscriptions: number; monthlyRecurringRevenue: { currency: string; amount: number }[] };
  recentBusinesses: PlatformBusiness[];
};
export type PlatformHealth = {
  status: "operational" | "degraded";
  services: { name: string; status: "operational" | "degraded" }[];
  runtime: { nodeVersion: string; uptimeSeconds: number; environment: string };
  checkedAt: string;
};
export type PlatformTicket = { id: string; tenantId: string | null; type: PlatformTicketType; priority: PlatformTicketPriority; status: PlatformTicketStatus; subject: string; message: string; createdAt: string; updatedAt: string; tenant: { id: string; name: string } | null; createdBy: { id: string; name: string; email: string } };
export type BusinessSubscription = { id: string; status: SubscriptionStatus; currentPeriodStart: string; currentPeriodEnd: string | null; trialEndsAt: string | null; plan: { id: string; name: string; priceMonthly: number | string; currency: string } };

async function request<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> { return apiRequest<T>(promise); }
const base = "/platform";
const tenantBase = "/tenants";
export const platformKeys = {
  all: ["platform"] as const,
  overview: ["platform", "overview"] as const,
  businesses: (search: string) => ["platform", "businesses", search] as const,
  business: (id: string) => ["platform", "business", id] as const,
  plans: ["platform", "plans"] as const,
  agents: ["platform", "support-agents"] as const,
  health: ["platform", "system-health"] as const,
  search: (query: string) => ["platform", "search", query] as const,
  tickets: ["platform", "tickets"] as const,
  tenantComplaints: (tenantId: string) => ["platform", "tenant-complaints", tenantId] as const,
  myFeedback: ["platform", "my-feedback"] as const,
};

export const platformApi = {
  overview: () => request<PlatformOverview>(apiClient.get(`${base}/overview`)),
  businesses: (q = "") => request<{ businesses: PlatformBusiness[] }>(apiClient.get(`${base}/businesses`, { params: q ? { q } : undefined })).then((result) => result.businesses),
  business: (id: string) => request<{ business: BusinessDetails }>(apiClient.get(`${base}/businesses/${id}`)).then((result) => result.business),
  updateBusiness: (id: string, input: { status?: BusinessStatus; planId?: string | null }) => request<{ business: PlatformBusiness }>(apiClient.patch(`${base}/businesses/${id}`, input)).then((result) => result.business),
  plans: () => request<{ plans: SubscriptionPlan[] }>(apiClient.get(`${base}/plans`)).then((result) => result.plans),
  createPlan: (input: Omit<SubscriptionPlan, "id" | "createdAt" | "updatedAt" | "_count" | "isActive">) => request<{ plan: SubscriptionPlan }>(apiClient.post(`${base}/plans`, input)).then((result) => result.plan),
  updatePlan: (id: string, input: Partial<Pick<SubscriptionPlan, "name" | "description" | "priceMonthly" | "currency" | "trialDays" | "maxBranches" | "maxStaff" | "isActive">>) => request<{ plan: SubscriptionPlan }>(apiClient.patch(`${base}/plans/${id}`, input)).then((result) => result.plan),
  deletePlan: (id: string) => request<{ id: string; deleted: true }>(apiClient.delete(`${base}/plans/${id}`)),
  agents: () => request<{ agents: SupportAgent[] }>(apiClient.get(`${base}/support-agents`)).then((result) => result.agents),
  addAgent: (email: string) => request<{ agent: SupportAgent }>(apiClient.post(`${base}/support-agents`, { email })).then((result) => result.agent),
  removeAgent: (userId: string) => request<{ userId: string; removed: true }>(apiClient.delete(`${base}/support-agents/${userId}`)),
  health: () => request<PlatformHealth>(apiClient.get(`${base}/system-health`)),
  search: (q: string) => request<{ businesses: { id: string; name: string; status: BusinessStatus }[]; plans: { id: string; name: string }[] }>(apiClient.get(`${base}/search`, { params: { q } })),
  tickets: () => request<{ tickets: PlatformTicket[] }>(apiClient.get(`${base}/tickets`)).then((result) => result.tickets),
  tenantComplaints: (tenantId: string) => request<{ tickets: PlatformTicket[] }>(apiClient.get(`${base}/businesses/${tenantId}/complaints`)).then((result) => result.tickets),
  updateTenantComplaint: (tenantId: string, ticketId: string, status: PlatformTicket["status"]) => request<{ ticket: PlatformTicket }>(apiClient.patch(`${base}/businesses/${tenantId}/complaints/${ticketId}`, { status })).then((result) => result.ticket),
  updateTicket: (id: string, status: PlatformTicket["status"], priority?: PlatformTicket["priority"]) => request<{ ticket: PlatformTicket }>(apiClient.patch(`${base}/tickets/${id}`, { status, priority })).then((result) => result.ticket),
  submitFeedback: (input: { tenantId?: string; type: PlatformTicket["type"]; subject: string; message: string }) => request<{ ticket: PlatformTicket }>(apiClient.post(`${base}/feedback`, input)).then((result) => result.ticket),
  myFeedback: () => request<{ tickets: PlatformTicket[] }>(apiClient.get(`${base}/my-feedback`)).then((result) => result.tickets),
  publicPlans: () => request<{ plans: Omit<SubscriptionPlan, "isActive" | "createdAt" | "updatedAt" | "_count">[] }>(apiClient.get(`${base}/public-plans`)).then((result) => result.plans),
  subscription: (tenantId: string) => request<{ subscription: BusinessSubscription | null }>(apiClient.get(`${tenantBase}/${tenantId}/subscription`)).then((result) => result.subscription),
  startSubscription: (tenantId: string, planId: string) => request<{ subscription: BusinessSubscription }>(apiClient.post(`${tenantBase}/${tenantId}/subscription`, { planId })).then((result) => result.subscription),
};
