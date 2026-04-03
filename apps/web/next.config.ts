import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@worldcoin/idkit", "@worldcoin/idkit-core", "wagmi", "@tanstack/react-query"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
