/**
 * Full-Stack Storefront Server (`server.ts`).
 *
 * Portable across both `node server.ts` (Node 22 native TypeScript execution),
 * `tsx server.ts` (dev server), and `node dist/server.mjs` (bundled JS production output).
 *
 * Mounts:
 * 1. Same-origin Storefront BFF (`/api/storefront/v1/*`)
 * 2. Vite middleware in development OR built static assets (`dist/`) with SPA history fallback in production.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createStorefrontBffRouter } from './server/storefront-bff.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createServer() {
  const app = express();
  app.disable('x-powered-by');

  // Mount same-origin Storefront BFF routes
  app.use('/api/storefront/v1', createStorefrontBffRouter());

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.basename(__dirname) === 'dist' ? __dirname : path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');

    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
      })
    );

    // Direct-route refresh support for all SPA routes (/collections/*, /products/*, /order-lookup, etc.)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      if (fs.existsSync(indexHtmlPath)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexHtmlPath);
      } else {
        res.status(503).send('Production build (dist/index.html) not found. Run npm run build first.');
      }
    });
  }

  return app;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  const port = Number(process.env.PORT || 3000);
  createServer()
    .then((app) => {
      app.listen(port, '0.0.0.0', () => {
        console.log(`GAYRAA Storefront & BFF listening on http://0.0.0.0:${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start GAYRAA storefront server:', err);
      process.exit(1);
    });
}
