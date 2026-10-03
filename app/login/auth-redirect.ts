// Auth redirect configuration helper for the hosted deployment.
// Email magic links must never be generated against localhost in production.
export function getAuthRedirectUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL}`
    : undefined;
}
