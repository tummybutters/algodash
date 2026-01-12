/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '8mb',
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'i.ytimg.com',
                pathname: '/vi/**',
            },
            {
                protocol: 'https',
                hostname: 'yt3.ggpht.com',
                pathname: '/**',
            },
        ],
    },
};

module.exports = nextConfig;
