import type { paths } from "@/types/api";

export type RegisterResponse = paths["/auth/register"]["post"]["responses"][201]["content"]["application/json"];
export type LoginResponse = paths["/auth/login"]["post"]["responses"][200]["content"]["application/json"];
export type LoggedInUserResponse = paths["/auth/me"]["get"]["responses"][200]["content"]["application/json"];
export type RefreshResponse = paths["/auth/refresh"]["post"]["responses"][200]["content"]["application/json"];
export type LogoutResponse = paths["/auth/logout"]["post"]["responses"][200]["content"]["application/json"];

export type RegisterRequest = NonNullable<paths["/auth/register"]["post"]["requestBody"]>["content"]["application/json"];
export type LoginRequest = NonNullable<paths["/auth/login"]["post"]["requestBody"]>["content"]["application/json"];
export type AuthUser = LoggedInUserResponse["data"]["user"];
