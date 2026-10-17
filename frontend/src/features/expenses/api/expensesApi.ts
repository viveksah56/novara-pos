import { apiClient, apiRequest } from "@/lib/api-client";

export type ExpensePaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "DIGITAL_WALLET" | "OTHER";
export type ExpenseCategory = { id: string; name: string; isActive: boolean };
export type ExpenseRecord = {
  id: string;
  amount: string | number;
  expenseDate: string;
  description: string;
  paymentMethod: ExpensePaymentMethod;
  reference: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  category: { id: string; name: string };
  branch: { id: string; name: string };
  createdBy: { id: string; name: string; email: string };
  voidedBy?: { id: string; name: string } | null;
};

export async function getExpenseCategories(tenantId: string) {
  return apiRequest<{ categories: ExpenseCategory[] }>(apiClient.get(`/tenants/${tenantId}/expense-categories`));
}
export async function getExpenses(tenantId: string, filters: { branchId?: string; from: string; to: string }) {
  return apiRequest<{ expenses: ExpenseRecord[] }>(apiClient.get(`/tenants/${tenantId}/expenses`, { params: filters }));
}
export async function createExpense(tenantId: string, input: { branchId: string; categoryId: string; amount: number; expenseDate: string; description: string; paymentMethod: ExpensePaymentMethod; reference?: string }) {
  return apiRequest<{ expense: ExpenseRecord }>(apiClient.post(`/tenants/${tenantId}/expenses`, input));
}
export async function createExpenseCategory(tenantId: string, name: string) {
  return apiRequest<{ category: ExpenseCategory }>(apiClient.post(`/tenants/${tenantId}/expense-categories`, { name }));
}
export async function voidExpense(tenantId: string, expenseId: string, reason: string) {
  return apiRequest<{ expense: ExpenseRecord }>(apiClient.post(`/tenants/${tenantId}/expenses/${expenseId}/void`, { reason }));
}
