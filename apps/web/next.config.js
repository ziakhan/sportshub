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
    // pdfkit ships .afm font assets that must load from node_modules at
    // runtime — bundling it breaks font resolution in the PDF route.
    serverComponentsExternalPackages: ['pdfkit'],
  },
}

module.exports = nextConfig
