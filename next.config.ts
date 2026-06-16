import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 旧コミックURL /comic は /comics に統一。短期間公開していたため恒久リダイレクト。
  async redirects() {
    return [
      { source: "/comic", destination: "/comics", permanent: true },
    ];
  },
};

export default nextConfig;
