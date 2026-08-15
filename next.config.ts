import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify's OAuth loopback redirect requires 127.0.0.1 (not localhost), but
  // Next's dev server only trusts "localhost" for its cross-origin dev-asset
  // protection by default — without this, same-origin fetches/chunk loads from
  // http://127.0.0.1:3000 get blocked with a 403, breaking client hydration.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
