/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Tree-shake heavy, icon-and-motion packages so only the components actually
  // used ship to the browser — big win for first-load JS on every page.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@clerk/nextjs"],
  },
  // API calls are made directly to backend server via NEXT_PUBLIC_API_URL
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
