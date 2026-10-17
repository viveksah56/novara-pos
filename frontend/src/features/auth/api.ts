import { apiClient, apiRequest } from "@/lib/api-client";
import type { AuthUser, LoggedInUserResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse } from "@/features/auth/types";
import type { LoginFormValues, RegisterFormValues } from "@/features/auth/schemas";

export const authQueryKeys = {
  all: ["auth"] as const,
  loggedInUser: ["auth", "logged-in-user"] as const,
};

export const authApi = {
  async register(input: RegisterFormValues): Promise<AuthUser> {
    const request: RegisterRequest = input;
    const result = await apiRequest<RegisterResponse["data"]>(apiClient.post<RegisterResponse>("/auth/register", request));
    return result.user;
  },
  async login(input: LoginFormValues): Promise<AuthUser> {
    const request: LoginRequest = input;
    const result = await apiRequest<LoginResponse["data"]>(apiClient.post<LoginResponse>("/auth/login", request));
    return result.user;
  },
  async getLoggedInUser(): Promise<AuthUser> {
    const result = await apiRequest<LoggedInUserResponse["data"]>(apiClient.get<LoggedInUserResponse>("/auth/me"));
    return result.user;
  },
  async logout(): Promise<void> {
    await apiRequest<LogoutResponse["data"]>(apiClient.post<LogoutResponse>("/auth/logout", {}));
  },
};
