/**
 * Storefront BFF Shell (`/api/storefront/v1/*`).
 *
 * Security & Architecture Guarantees:
 * - Browser calls ONLY same-origin `/api/storefront/v1/*` endpoints.
 * - Manages `HttpOnly; SameSite=Lax` storefront session cookie (`gayraa_sf_sid`).
 * - Keeps upstream Kalp Business Core integration as an explicit unavailable stub (HTTP 503)
 *   until the official Kalp Business API contract is provisioned.
 * - Never serves fake demo fixtures as live data on `/api/storefront/v1/*`.
 * - Never leaks server-side environment variables, tenant IDs, or credentials to the browser.
 */

import crypto from 'crypto';
import express, { Request, Response, Router } from 'express';
import { GAYRAA_NAVIGATION } from '../src/config/navigation';
import { buildStorefrontCapabilities, GAYRAA_STOREFRONT_CONFIG } from '../src/config/storefront';

const SESSION_COOKIE_NAME = 'gayraa_sf_sid';

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      out[key] = decodeURIComponent(val);
    }
  }
  return out;
}

function ensureSessionCookie(req: Request, res: Response): string {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[SESSION_COOKIE_NAME];
  if (existing && /^[a-zA-Z0-9_-]{12,64}$/.test(existing)) {
    return existing;
  }
  const sid = `sf_${crypto.randomBytes(12).toString('hex')}`;
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${sid}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`
  );
  return sid;
}

export interface UpstreamKalpConfigStatus {
  upstreamConfigured: boolean;
  liveKalpConnected: boolean;
  reason: string;
}

export function getKalpUpstreamStatus(): UpstreamKalpConfigStatus {
  const hasUpstreamUrl = Boolean(process.env.KALP_UPSTREAM_BASE_URL?.trim());
  const hasTenantId = Boolean(process.env.KALP_TENANT_ID?.trim());

  // Even if env vars are present, the official Stage B Kalp Business API contract
  // Remains an explicit unavailable stub until verified upstream endpoints are wired.
  if (!hasUpstreamUrl || !hasTenantId) {
    return {
      upstreamConfigured: false,
      liveKalpConnected: false,
      reason:
        'Kalp Business Core upstream environment (KALP_UPSTREAM_BASE_URL / KALP_TENANT_ID) is not configured on the storefront BFF. Refusing to serve fabricated live catalog or checkout data.',
    };
  }

  return {
    upstreamConfigured: true,
    liveKalpConnected: false,
    reason:
      'Kalp upstream stub: Official Kalp Business API adapter contract is pending Stage B implementation. Refusing to return mock data from /api/storefront/v1/*.',
  };
}

function respondUpstreamUnavailable(res: Response): void {
  const status = getKalpUpstreamStatus();
  res.status(503).json({
    error: {
      code: 'UPSTREAM_UNAVAILABLE',
      message: status.reason,
      recoverable: true,
    },
  });
}

export function createStorefrontBffRouter(): Router {
  const router = express.Router();

  router.use(express.json({ limit: '64kb' }));

  // Standard BFF security headers & session cookie initialization
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    ensureSessionCookie(req, res);
    next();
  });

  router.get('/health', (_req, res) => {
    const status = getKalpUpstreamStatus();
    res.status(200).json({
      status: 'ok',
      service: 'gayraa-storefront-bff',
      version: 'v1',
      upstreamConfigured: status.upstreamConfigured,
      liveKalpConnected: status.liveKalpConnected,
    });
  });

  router.get('/capabilities', (_req, res) => {
    const caps = buildStorefrontCapabilities('connected');
    res.status(200).json(caps);
  });

  router.get('/config', (_req, res) => {
    res.status(200).json(GAYRAA_STOREFRONT_CONFIG);
  });

  router.get('/navigation', (_req, res) => {
    res.status(200).json(GAYRAA_NAVIGATION);
  });

  // Upstream Kalp catalog, search, cart, quote, and order endpoints (Stub until official contract is ready)
  router.get('/home', (_req, res) => respondUpstreamUnavailable(res));
  router.get('/collections', (_req, res) => respondUpstreamUnavailable(res));
  router.get('/collections/:slug', (_req, res) => respondUpstreamUnavailable(res));
  router.get('/search', (_req, res) => respondUpstreamUnavailable(res));
  router.get('/products/:slug', (_req, res) => respondUpstreamUnavailable(res));
  router.get('/cart', (_req, res) => respondUpstreamUnavailable(res));
  router.post('/cart/items', (_req, res) => respondUpstreamUnavailable(res));
  router.patch('/cart/items/:lineItemId', (_req, res) => respondUpstreamUnavailable(res));
  router.delete('/cart/items/:lineItemId', (_req, res) => respondUpstreamUnavailable(res));
  router.post('/checkout/quote', (_req, res) => respondUpstreamUnavailable(res));
  router.post('/orders', (_req, res) => respondUpstreamUnavailable(res));

  // Catch-all for unknown /api/storefront/v1/* endpoints
  router.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Storefront BFF route "${req.method} ${req.originalUrl}" does not exist.`,
        recoverable: false,
      },
    });
  });

  return router;
}
