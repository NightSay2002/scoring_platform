import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["platform.wongwingfung.xyz"],
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:folder/:fileName",
        destination: "/api/uploads/:folder/:fileName",
      },
    ];
  },
};

export default nextConfig;
