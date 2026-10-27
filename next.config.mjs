// `npm run build:static` produces a fully static site in ./out (for Apache / any static host).
// `npm run build` keeps the regular Next.js server build.
const isStaticExport = process.env.STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isStaticExport && {
    output: 'export',
    // /tools/foo/ → out/tools/foo/index.html, which Apache serves without rewrites
    trailingSlash: true,
    images: { unoptimized: true },
  }),

  webpack(config, { isServer }) {
    // Some formatter plugins (e.g. @prettier/plugin-php) reference Node built-ins they never use in the browser.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, module: false, url: false };
    }

    // ─── WASM support for @jsquash/* codec packages ───────────────────────────
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // ─── Fix: treat .mjs files in node_modules as generic JS ─────────────────
    // Prevents Terser from failing on import.meta / ESM syntax inside
    // onnxruntime-web and other ESM-only packages during production build.
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    return config;
  },

  // Required for WASM threads + SharedArrayBuffer used by @imgly/background-removal.
  // (Static exports get the same headers from .htaccess instead.)
  ...(!isStaticExport && {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
            { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
