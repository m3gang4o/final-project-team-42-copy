import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    // Fix for pdfjs-dist with Next.js
    if (!isServer) {
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
      config.resolve.alias["pdfjs-dist/legacy/build/pdf.js"] =
        "pdfjs-dist/legacy/build/pdf.js";
      config.resolve.alias["pdfjs-dist/build/pdf.js"] =
        "pdfjs-dist/build/pdf.js";
      config.resolve.alias["pdfjs-dist/legacy/build/pdf.worker.js"] =
        "pdfjs-dist/legacy/build/pdf.worker.min.js";
      config.resolve.alias["pdfjs-dist/build/pdf.worker.js"] =
        "pdfjs-dist/build/pdf.worker.min.js";
    }

    return config;
  },
  async headers() {
    return [
      {
        // Apply these headers to all API routes (e.g., /api/*)
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Allow all origins
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS", // Specify allowed methods
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization", // Specify allowed headers
          },
        ],
      },
    ];
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    // Fix for pdfjs-dist with Next.js
    if (!isServer) {
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
      config.resolve.alias["pdfjs-dist/legacy/build/pdf.js"] =
        "pdfjs-dist/legacy/build/pdf.js";
      config.resolve.alias["pdfjs-dist/build/pdf.js"] =
        "pdfjs-dist/build/pdf.js";
      config.resolve.alias["pdfjs-dist/legacy/build/pdf.worker.js"] =
        "pdfjs-dist/legacy/build/pdf.worker.min.js";
      config.resolve.alias["pdfjs-dist/build/pdf.worker.js"] =
        "pdfjs-dist/build/pdf.worker.min.js";
    }

    return config;
  },
  async headers() {
    return [
      {
        // Apply these headers to all API routes (e.g., /api/*)
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Allow all origins
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS", // Specify allowed methods
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization", // Specify allowed headers
          },
        ],
      },
    ];
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
