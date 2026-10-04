import type { NextConfig } from "next";

/**
 * Documents must never be cached for long.
 *
 * `next build` rewrites content-hashed chunk names, and a prerendered page is served
 * with `Cache-Control: s-maxage=31536000` by default. Anything that caches the HTML —
 * a browser, a preview proxy, a CDN — can then replay a document that references a
 * chunk a later build deleted, which is exactly how the whole UI once rendered with no
 * CSS at all. Revalidating the small HTML document costs one conditional request; the
 * content-hashed `/_next/static/*` assets stay immutably cached, which is where the
 * real bytes are.
 */
const DOCUMENT_CACHE_CONTROL = "public, max-age=0, must-revalidate";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The app is entirely client-side once the shell streams, so there is nothing to
  // bundle for a server runtime.
  poweredByHeader: false,

  // Allow the sandboxed live-preview host to drive the dev server without
  // cross-origin dev warnings.
  allowedDevOrigins: ["*.e2b.app"],

  experimental: {
    // Inline the (small) stylesheet into the prerendered HTML. Beyond removing the
    // first-paint flash, it means a document can never render as an unstyled skeleton
    // just because its separate CSS request failed or was served from a stale cache —
    // the styles travel with the markup that references them.
    inlineCss: true,
  },

  async headers() {
    return [
      { source: "/", headers: [{ key: "Cache-Control", value: DOCUMENT_CACHE_CONTROL }] },
      {
        source: "/builder",
        headers: [{ key: "Cache-Control", value: DOCUMENT_CACHE_CONTROL }],
      },
    ];
  },
};

export default nextConfig;
