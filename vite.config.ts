import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';
import type { IncomingMessage, ServerResponse } from 'http';
import url from 'url';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'shopify-dynamic-proxy',
          configureServer(server) {
            // Handles: /shopify-proxy/{shopHost}/{...rest}
            // e.g.    /shopify-proxy/abc.myshopify.com/admin/oauth/access_token
            server.middlewares.use('/shopify-proxy', (req: IncomingMessage, res: ServerResponse) => {
              const rawUrl = req.url || '/';
              // rawUrl starts with "/abc.myshopify.com/admin/..."
              const withoutLeadingSlash = rawUrl.replace(/^\//, '');
              const slashIdx = withoutLeadingSlash.indexOf('/');
              const shopHost = slashIdx === -1 ? withoutLeadingSlash : withoutLeadingSlash.slice(0, slashIdx);
              const restPath = slashIdx === -1 ? '/' : withoutLeadingSlash.slice(slashIdx);

              if (!shopHost || !shopHost.includes('.')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid proxy URL — expected /shopify-proxy/{host}/path' }));
                return;
              }

              // Collect request body
              const chunks: Buffer[] = [];
              req.on('data', (chunk: Buffer) => chunks.push(chunk));
              req.on('end', () => {
                const body = Buffer.concat(chunks);

                // Forward all original headers except host, then override host
                const forwardHeaders: Record<string, string | string[]> = {};
                for (const [k, v] of Object.entries(req.headers)) {
                  if (k.toLowerCase() !== 'host' && v !== undefined) {
                    forwardHeaders[k] = v as string | string[];
                  }
                }
                forwardHeaders['host'] = shopHost;
                forwardHeaders['user-agent'] = 'Mozilla/5.0 (compatible; ShopifyProxy/1.0)';
                if (body.length > 0) {
                  forwardHeaders['content-length'] = String(body.length);
                }

                const options: https.RequestOptions = {
                  hostname: shopHost,
                  path: restPath,
                  method: req.method || 'GET',
                  headers: forwardHeaders,
                  rejectUnauthorized: true,
                };

                const proxyReq = https.request(options, (proxyRes) => {
                  res.writeHead(proxyRes.statusCode || 502, proxyRes.headers as Record<string, string>);
                  proxyRes.pipe(res, { end: true });
                });

                proxyReq.on('error', (err: Error) => {
                  console.error('[shopify-proxy] Error:', err.message);
                  if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                  }
                });

                if (body.length > 0) proxyReq.write(body);
                proxyReq.end();
              });
            });
          },
        },
        {
          name: 'telnyx-proxy',
          configureServer(server) {
            server.middlewares.use('/telnyx-proxy', (req: IncomingMessage, res: ServerResponse) => {
              const parsedUrl = url.parse(req.url || '/', true);
              const queryString = parsedUrl.search || '';
              const targetPath = `/v2/detail_records${queryString}`;

              const options: https.RequestOptions = {
                hostname: 'api.telnyx.com',
                path: targetPath,
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${env.TELNYX_API_KEY}`,
                  'Accept': 'application/json',
                },
              };

              const proxyReq = https.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 502, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                });
                proxyRes.pipe(res, { end: true });
              });

              proxyReq.on('error', (err: Error) => {
                console.error('[telnyx-proxy] Error:', err.message);
                if (!res.headersSent) {
                  res.writeHead(502, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message }));
                }
              });

              proxyReq.end();
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Polyfill Node globals needed by @telnyx/webrtc
        'global': 'globalThis',
        'process.env.NODE_ENV': JSON.stringify(mode),
      },
      build: {
        rollupOptions: {
          // Externalize @telnyx/webrtc — it will load from the ESM import map at runtime
          external: ['@telnyx/webrtc'],
        },
      },
      optimizeDeps: {
        include: ['@telnyx/webrtc'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
