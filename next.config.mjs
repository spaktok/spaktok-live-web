/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{source:'/face-assets/:path*',headers:[
      {key:'Cache-Control',value:'public, max-age=604800, immutable'},
      {key:'X-Content-Type-Options',value:'nosniff'},
    ]}]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
