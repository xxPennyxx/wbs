/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // mssql is a native/server-only package; keep it out of the client bundle.
    serverComponentsExternalPackages: ["mssql"],
  },
};

export default nextConfig;
