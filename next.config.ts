import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't pick up a stray
  // lockfile elsewhere on the machine when inferring the root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
