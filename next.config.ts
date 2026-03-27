import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/chat", destination: "/", permanent: false }];
  },
};

export default nextConfig;
