/**
 * Storefront BFF Shell (`/api/storefront/v1/*`).
 *
 * Security & Architecture Guarantees:
 * - Browser calls ONLY same-origin `/api/storefront/v1/*` endpoints.
 * - Manages `HttpOnly; SameSite=Lax` storefront session cookie (`gayraa_sf_sid`).
 * - Echoes `X-Correlation-Id` on every response and error envelope.
 * - Rejects browser attempts to pass privileged tenant or admin headers (`X-Tenant-DB`, `X-Kalp-Tenant`).
 * - Never emits `Access-Control-Allow-Origin: *` for credentialed flows.
 * - Keeps upstream Kalp Business Core integration as an explicit unavailable stub (HTTP 503)
 *   until the official Kalp Business API contract is provisioned.
 * - Never serves fake demo fixtures as live data on `/api/storefront/v1/*`.
 */

import crypto from 'crypto';
import express, { type Request, type Response, type Router } from 'express';
import { GAYRAA_NAVIGATION } from '../src/config/navigation.ts';
import { buildStorefrontCapabilities, GAYRAA_STOREFRONT_CONFIG } from '../src/config/storefront.ts';

const SESSION_COOKIE_NAME = 'gayraa_sf_sid';
const FORBIDDEN_CLIENT_HEADERS = [
  'x-tenant-db',
  'x-kalp-tenant',
  'x-kalp-admin-key',
  'x-mongo-uri',
];

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

function resolveCorrelationId(req: Request, res: Response): string {
  const incoming = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const raw = Array.isArray(incoming) ? incoming[0] : incoming;
  const clean =
    raw && /^[a-zA-Z0-9._-]{4,64}$/.test(raw)
      ? raw
      : `bff_${crypto.randomBytes(8).toString('hex')}`;
  res.setHeader('X-Correlation-Id', clean);
  return clean;
}

export interface UpstreamKalpConfigStatus {
  upstreamConfigured: boolean;
  liveKalpConnected: boolean;
  reason: string;
}

export function getKalpUpstreamStatus(): UpstreamKalpConfigStatus {
  const hasUpstreamUrl = Boolean(process.env.KALP_UPSTREAM_BASE_URL?.trim());
  const hasTenantId = Boolean(process.env.KALP_TENANT_ID?.trim());

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

function respondUpstreamUnavailable(req: Request, res: Response): void {
  const status = getKalpUpstreamStatus();
  const correlationId = String(res.getHeader('X-Correlation-Id') || resolveCorrelationId(req, res));
  res.status(503).json({
    error: {
      code: 'UPSTREAM_UNAVAILABLE',
      message: status.reason,
      recoverable: true,
      correlationId,
    },
  });
}

export function createStorefrontBffRouter(): Router {
  const router = express.Router();

  router.use(express.json({ limit: '64kb' }));

  // Standard BFF security headers, correlation ID, session cookie, and forbidden header guard
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const correlationId = resolveCorrelationId(req, res);
    ensureSessionCookie(req, res);

    // Reject any client attempt to inject tenant/database or privileged headers
    for (const forbidden of FORBIDDEN_CLIENT_HEADERS) {
      if (req.headers[forbidden] !== undefined) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Client header "${forbidden}" is forbidden. Tenant resolution is strictly server-controlled.`,
            recoverable: false,
            correlationId,
          },
        });
        return;
      }
    }

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

  // Upstream Kalp catalog, search, product, and review endpoints
  router.get('/home', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/collections', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/collections/:slug', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/search', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/products/:slug', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/products/:productId/reviews', (req, res) => respondUpstreamUnavailable(req, res));

  // Cart & Checkout endpoints
  router.get('/cart', (req, res) => respondUpstreamUnavailable(req, res));
  router.post('/cart/items', (req, res) => respondUpstreamUnavailable(req, res));
  router.patch('/cart/items/:lineItemId', (req, res) => respondUpstreamUnavailable(req, res));
  router.delete('/cart/items/:lineItemId', (req, res) => respondUpstreamUnavailable(req, res));
  router.post('/checkout/quote', (req, res) => respondUpstreamUnavailable(req, res));
  router.post('/orders', (req, res) => respondUpstreamUnavailable(req, res));

  // Guest Order Lookup, Support & 3-Day Exchange endpoints
  router.post('/orders/lookup', (req, res) => respondUpstreamUnavailable(req, res));
  router.post('/support/inquiries', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/exchanges/eligibility', (req, res) => respondUpstreamUnavailable(req, res));
  router.post('/exchanges', (req, res) => respondUpstreamUnavailable(req, res));

  // Customer OTP Session, Orders, Addresses & Saved Items endpoints
  router.get('/customer/session', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/customer/orders', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/customer/orders/:orderId', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/customer/addresses', (req, res) => respondUpstreamUnavailable(req, res));
  router.get('/customer/saved', (req, res) => respondUpstreamUnavailable(req, res));

  // Catch-all for unknown /api/storefront/v1/* endpoints
  router.use((req, res) => {
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Storefront BFF route "${req.method} ${req.originalUrl}" does not exist.`,
        recoverable: false,
        correlationId,
      },
    });
  });

  return router;
}
