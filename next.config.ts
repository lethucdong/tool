import type { NextConfig } from "next";
import os from "node:os";

const networkInterfaces = os.networkInterfaces();

const lanOrigins = Object.values(networkInterfaces)
  .flat()
  .filter(
    (item) =>
      item &&
      item.family === "IPv4" &&
      !item.internal &&
      item.address.startsWith("192.168.")
  )
  .map((item) => item!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  allowedDevOrigins: ["localhost","192.168.20.73"],
};

export default nextConfig;