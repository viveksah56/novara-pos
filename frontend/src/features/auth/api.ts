import { apiClient, apiRequest } from "@/lib/api-client";
import type { AuthUser, LoggedInUserResponse, LoginRequest, LogoutResponse, RegisterRequest } from "@/features/auth/types";
import type { ForgotPasswordFormValues, LoginFormValues, RegisterFormValues, ResetPasswordFormValues } from "@/features/auth/schemas";

export const authQueryKeys = {
  all: ["auth"] as const,
  loggedInUser: ["auth", "logged-in-user"] as const,
};

export type AuthSession = { user: AuthUser; activeTenantId: string | null; homeRoute: string };

export const authApi = {
  async register(input: RegisterFormValues): Promise<AuthSession> {
    const request: RegisterRequest = input;
    return apiRequest<AuthSession>(apiClient.post("/auth/register", request));
  },
  async login(input: LoginFormValues): Promise<AuthSession> {
    const request: LoginRequest = input;
    return apiRequest<AuthSession>(apiClient.post("/auth/login", request));
  },
  async getLoggedInUser(): Promise<AuthUser> {
    const result = await apiRequest<LoggedInUserResponse["data"]>(apiClient.get<LoggedInUserResponse>("/auth/me"));
    return result.user;
  },
  async logout(): Promise<void> {
    await apiRequest<LogoutResponse["data"]>(apiClient.post<LogoutResponse>("/auth/logout", {}));
  },
  async requestPasswordReset(input: ForgotPasswordFormValues): Promise<void> {
    await apiRequest<{ message: string }>(apiClient.post("/auth/password/forgot", input));
  },
  async resetPassword(token: string, input: ResetPasswordFormValues): Promise<void> {
    await apiRequest<{ passwordReset: true }>(apiClient.post("/auth/password/reset", { token, password: input.password }));
  },
  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiRequest<{ passwordChanged: true }>(apiClient.post("/auth/password/change", input));
  },
};
