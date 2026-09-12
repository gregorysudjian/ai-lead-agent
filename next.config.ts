import type { NextConfig } from "next";

/**
 * Security headers on every response.
 *
 * The app is public on Vercel with one password in front of it, so the
 * browser-side protections that cost nothing are switched on:
 *
 *   - no page may be framed by another site (clickjacking the login or a
 *     status toggle). Our own design grid frames our own pages, so framing by
 *     the same origin stays allowed;
 *   - no MIME-type guessing;
 *   - referrers carry only our origin to other sites -- and nothing at all
 *     from a share page, whose URL holds the token that grants access;
 *   - camera, microphone, location, payment and USB are refused outright;
 *   - nothing here belongs in a search index: a dashboard of named businesses
 *     and draft proposals. The header covers every route, including the login
 *     page, without adding a public robots.txt route.
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // A share URL is a credential; never send it anywhere as a referrer.
      { source: "/s/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
