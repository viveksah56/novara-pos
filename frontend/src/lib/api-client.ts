"use client";

import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { RefreshResponse } from "@/features/auth/types";

export type ApiSuccess<T> = { data: T; status: "success" };
export type ApiFailure = {
  data: null;
  status: "error";
  error: { code: string; message: string; details?: Record<string, string[]>; requestId?: string };
};

type AuthRequestConfig = InternalAxiosRequestConfig & { authRetried?: boolean; skipAuthRefresh?: boolean };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | undefined,
    readonly code: string,
    readonly details?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiClient = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 15_000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

function normalizeAxiosError(error: AxiosError<ApiFailure>): ApiError {
  const payload = error.response?.data;
  return new ApiError(
    payload?.error?.message ?? (error.code === "ECONNABORTED" ? "The request timed out. Please try again." : "We could not reach the server. Check your connection and try again."),
    error.response?.status,
    payload?.error?.code ?? (error.response ? "REQUEST_FAILED" : "NETWORK_ERROR"),
    payload?.error?.details,
    payload?.error?.requestId,
  );
}

let refreshRequest: Promise<void> | null = null;

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Carry the selected scope as context, while the API independently validates
  // tenant membership and branch assignment from the authenticated user.
  const tenantId = config.url?.match(/\/tenants\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];
  if (tenantId) config.headers.set("X-Tenant-Id", tenantId);
  const params = config.params as Record<string, unknown> | undefined;
  const body = typeof config.data === "object" && config.data !== null
    ? config.data as Record<string, unknown>
    : undefined;
  const branchId = params?.branchId ?? body?.branchId;
  if (typeof branchId === "string" && branchId) config.headers.set("X-Branch-Id", branchId);
  if (config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
    config.headers.set("X-Requested-With", "XMLHttpRequest");
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError<ApiFailure>(error)) return Promise.reject(error);

    const config = error.config as AuthRequestConfig | undefined;
    const url = config?.url ?? "";
    const isSessionEndpoint = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"].some((path) => url.includes(path));

    if (error.response?.status === 401 && config && !config.authRetried && !config.skipAuthRefresh && !isSessionEndpoint) {
      config.authRetried = true;
      refreshRequest ??= apiClient
        .post<RefreshResponse>("/auth/refresh", {}, { headers: { "X-Requested-With": "XMLHttpRequest" } })
        .then(() => undefined)
        .finally(() => {
          refreshRequest = null;
        });

      try {
        await refreshRequest;
        return apiClient.request(config);
      } catch (refreshError) {
        // A rejected refresh token means the session is over. Avoid leaving the
        // user on an operational screen with a misleading generic API error.
        if (
          typeof window !== "undefined" &&
          axios.isAxiosError(refreshError) &&
          refreshError.response?.status === 401 &&
          !window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/register")
        ) {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?reason=session-expired&returnTo=${encodeURIComponent(returnTo)}`);
        }
        return Promise.reject(
          axios.isAxiosError<ApiFailure>(refreshError) ? normalizeAxiosError(refreshError) : refreshError,
        );
      }
    }

    return Promise.reject(normalizeAxiosError(error));
  },
);

export async function apiRequest<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  const response = await request;
  return response.data.data;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
