/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: 'tile.openstreetmap.org' },
            { protocol: 'https', hostname: 'cdnjs.cloudflare.com' },
        ],
    },
};

module.exports = nextConfig;
