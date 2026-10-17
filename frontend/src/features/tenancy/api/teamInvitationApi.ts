import { apiClient, apiRequest } from "@/lib/api-client";

export type TeamInvitationPreview = { email: string; role: string; businessName: string; branches: string[]; expiresAt: string };
export type TeamInvitationAcceptance = { accepted: true; invitation: { tenantId: string; businessName: string; role: string }; user: { id: string }; homeRoute: string; activeTenantId: string | null };

export const teamInvitationApi = {
  preview: async (token: string) => (await apiRequest<{ invitation: TeamInvitationPreview }>(apiClient.get(`/auth/team-invitations/${encodeURIComponent(token)}`))).invitation,
  accept: async (input: { token: string; name?: string; password?: string }) => apiRequest<TeamInvitationAcceptance>(apiClient.post("/auth/team-invitations/accept", input)),
};
