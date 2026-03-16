/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@youthbasketballhub/db",
    "@youthbasketballhub/auth",
    "@youthbasketballhub/payments",
    "@youthbasketballhub/ui",
    "@youthbasketballhub/config",
  ],
  images: {
    domains: [
      'localhost',
      'youthbasketballhub.com',
      'vercel.app',
      // Add Vercel Blob domain when configured
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
