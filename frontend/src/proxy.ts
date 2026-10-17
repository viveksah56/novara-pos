import { NextRequest, NextResponse } from "next/server";
import { capabilityForPath, roleHasCapability, type BusinessRole, type PlatformRole } from "@/lib/rbac";

/**
 * These checks are an optimistic navigation guard. The API still authorizes every
 * request and applies tenant/branch scope before returning protected data.
 */
const API_ORIGIN = (process.env.API_PROXY_TARGET ?? "http://localhost:8000").replace(/\/$/, "");
const ACCESS_COOKIE_NAMES = ["novara_access", "accessToken"] as const;

type Profile = {
  platformRole?: PlatformRole | null;
  isPlatformAdmin?: boolean;
  memberships?: Array<{ role: BusinessRole; tenant?: { id: string } }>;
};

function getMembershipRole(profile: Profile, tenantId: string | null): BusinessRole | PlatformRole | undefined {
  if (profile.platformRole) return profile.platformRole;
  if (profile.isPlatformAdmin) return "PLATFORM_ADMIN";

  // If a business was explicitly selected, never silently fall back to another tenant.
  const membership = tenantId
    ? profile.memberships?.find((item) => item.tenant?.id === tenantId)
    : profile.memberships?.[0];
  return membership?.role;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function serviceUnavailable(): NextResponse {
  return new NextResponse("Authentication service is temporarily unavailable.", {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "5" },
  });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token = ACCESS_COOKIE_NAMES.map((name) => request.cookies.get(name)?.value).find(Boolean);

  if (!token) return redirectToLogin(request);

  // Ask the authenticated API for the current membership/role. Role claims are not
  // embedded in the access JWT today, and trusting a client-editable cookie would be unsafe.
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/v1/auth/me`, {
      headers: { Cookie: `novara_access=${encodeURIComponent(token)}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    return serviceUnavailable();
  }

  if (response.status === 401) return redirectToLogin(request);
  if (response.status === 403) return NextResponse.redirect(new URL("/unauthorized", request.url));
  if (!response.ok) return serviceUnavailable();

  let profile: Profile | undefined;
  try {
    const envelope = await response.json() as { data?: { user?: Profile } };
    profile = envelope.data?.user;
  } catch {
    return serviceUnavailable();
  }

  if (!profile) return redirectToLogin(request);

  const role = getMembershipRole(profile, request.nextUrl.searchParams.get("tenantId"));
  const capability = capabilityForPath(pathname);
  const allowed = capability === undefined || (role !== undefined && roleHasCapability(role, capability));

  if (!allowed) return NextResponse.redirect(new URL("/unauthorized", request.url));
  return NextResponse.next();
}

// Keep this list aligned with the protected route groups requested for Novara.
export const config = {
  matcher: ["/dashboard/:path*", "/pos/:path*", "/kitchen/:path*", "/orders/:path*", "/shift/:path*", "/reports/:path*", "/stock-reports/:path*"],
};
