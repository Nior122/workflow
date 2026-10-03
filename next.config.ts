import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The app is entirely client-side once the shell streams, so there is nothing to
  // bundle for a server runtime.
  poweredByHeader: false,

  // Allow the sandboxed live-preview host to drive the dev server without
  // cross-origin dev warnings.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
