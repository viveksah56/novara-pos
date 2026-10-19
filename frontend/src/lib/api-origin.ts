/** Resolve the backend origin from the active Next.js environment file. */
export function getApiOrigin(): string {
  const configuredOrigin = process.env.API_PROXY_TARGET;
  if (!configuredOrigin) {
    throw new Error("API_PROXY_TARGET must be set in .env.local or .env.production.");
  }

  return configuredOrigin.replace(/\/+$/, "");
}
