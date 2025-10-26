/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Disable experimental features that cause issues
  experimental: {
    // optimizeCss: true, // Disabled - causes critters module error
    // optimizePackageImports: ['lucide-react', '@heroicons/react']
  },

  // Environment variables
  env: {
    CUSTOM_KEY: 'academic-notebook-platform'
  },

  // API rewrites for development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development' 
          ? 'http://localhost:5003/api/:path*'
          : '/api/:path*'
      }
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:; object-src 'self' data:;"
          }
        ]
      }
    ];
  },

  // Image optimization
  images: {
    domains: ['localhost', 'academic-notebooks-storage.s3.amazonaws.com'],
    formats: ['image/webp', 'image/avif']
  },

  // Static export configuration for S3 deployment
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  
  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Monaco Editor support
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: 'worker-loader' }
    });

    // Handle WebSocket connections
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false
      };
    }

    return config;
  }
};

module.exports = nextConfig;
