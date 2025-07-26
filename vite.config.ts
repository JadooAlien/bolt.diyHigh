import { defineConfig, type ViteDevServer } from 'vite';
import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig((config) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },

  build: {
    target: 'esnext',
  },

  server: {
    allowedHosts: 'all', // 👈 Important for Render deployment
  },

  plugins: [
    // Node.js polyfills
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream'],
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
      protocolImports: true,
      exclude: ['child_process', 'fs', 'path'],
    }),

    // Buffer polyfill for env.mjs
    {
      name: 'buffer-polyfill',
      transform(code, id) {
        if (id.includes('env.mjs')) {
          return {
            code: `import { Buffer } from 'buffer';\n${code}`,
            map: null,
          };
        }
        return null;
      },
    },

    // Remix Plugins
    config.mode !== 'test' && remixCloudflareDevProxy(),
    remixVitePlugin({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
      },
    }),

    // Utilities
    UnoCSS(),
    tsconfigPaths(),

    // Fix for Chrome 129 local dev issue
    chrome129IssuePlugin(),

    // Optimize CSS in production only
    config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
  ],

  envPrefix: [
    'VITE_',
    'OPENAI_LIKE_API_BASE_URL',
    'OLLAMA_API_BASE_URL',
    'LMSTUDIO_API_BASE_URL',
    'TOGETHER_API_BASE_URL',
  ],

  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
}));

// Chrome 129 workaround plugin
function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/(\d+)\./);
        const version = raw ? parseInt(raw[2], 10) : null;

        if (version === 129) {
          res.setHeader('content-type', 'text/html');
          res.end(`
            <body>
              <h1>Please use Chrome Canary for testing.</h1>
              <p>Chrome 129 has a known issue with JS modules & Vite.</p>
              <p>More info: <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">Issue #86</a></p>
              <p><b>Note:</b> This only affects <u>local development</u>.</p>
            </body>
          `);
          return;
        }

        next();
      });
    },
  };
}
