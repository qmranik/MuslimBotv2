/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${process.env.ORCHESTRATOR_URL || 'http://go-orchestrator:8080'}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
