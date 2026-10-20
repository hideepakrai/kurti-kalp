/**
 * Storefront BFF Shell (`/api/storefront/v1/*`).
 *
 * Security & Architecture Guarantees:
 * - Browser calls ONLY same-origin `/api/storefront/v1/*` endpoints.
 * - Manages `HttpOnly; SameSite=Lax` storefront session cookie (`gayraa_sf_sid`).
 * - Echoes validated or server-generated `X-Correlation-Id` on every response and error envelope.
 * - Rejects browser attempts to pass privileged tenant, database, admin, authorization, proof,
 *   or upstream-routing headers (`X-Tenant-DB`, `X-Kalp-Tenant`, `Authorization`, `X-Order-Access-Proof`, etc.).
 * - Enforces `Idempotency-Key` on every mutation (`POST`, `PATCH`, `PUT`, `DELETE`).
 * - Uses `KalpUpstreamClient` with a strict outbound header allowlist (`X-Tenant-DB` from server env only).
 * - Translates verified Kalp `{ data, ... }` envelopes for public catalog/merchandising and multi-step
 *   guest order access (`challenge -> verify -> server-held proof -> protected order detail`).
 * - Keeps raw proof tokens strictly server-side bound to `(sessionId, tenantDb, orderReference)`.
 * - Returns honest HTTP 503 `UPSTREAM_UNAVAILABLE` when Kalp upstream is unconfigured or when a route's
 *   upstream contract is not yet confirmed—never serving fake demo fixtures as live data.
 */

import crypto from 'crypto';
import express, { type Request, type Response, type Router } from 'express';
import { GAYRAA_NAVIGATION } from '../src/config/navigation.ts';
import { buildStorefrontCapabilities, GAYRAA_STOREFRONT_CONFIG } from '../src/config/storefront.ts';
import { isStorefrontError, StorefrontError } from '../src/domain/errors.ts';
import {
  KalpUpstreamClient,
  type KalpUpstreamEnvironmentConfig,
  translateKalpCollectionResultEnvelope,
  translateKalpCollectionsEnvelope,
  translateKalpGuestChallengeEnvelope,
  translateKalpGuestVerifyEnvelope,
  translateKalpHomePageEnvelope,
  translateKalpOrderDetailEnvelope,
  translateKalpProductDetailEnvelope,
} from './kalp-upstream-adapter.ts';

const SESSION_COOKIE_NAME = 'gayraa_sf_sid';

/**
 * Browser-supplied privileged headers that the BFF must always reject with 400 VALIDATION_ERROR.
 */
export const FORBIDDEN_CLIENT_HEADERS = [
  'x-tenant-db',
  'x-kalp-tenant',
  'x-tenant-id',
  'x-kalp-admin-key',
  'x-admin-key',
  'x-mongo-uri',
  'authorization',
  'x-kalp-service-token',
  'x-order-access-proof',
  'x-guest-order-proof',
  'x-kalp-proof-token',
  'x-upstream-host',
  'x-forwarded-host',
] as const;

interface ServerStoredOrderProof {
  sessionId: string;
  tenantDb: string;
  orderReference: string;
  email: string;
  proofToken: string;
  expiresAtMs: number;
}

export interface StorefrontBffRouterOptions {
  upstreamEnvOverride?: Partial<KalpUpstreamEnvironmentConfig>;
}

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

function resolveUpstreamEnv(
  override?: Partial<KalpUpstreamEnvironmentConfig>
): KalpUpstreamEnvironmentConfig | null {
  const upstreamBaseUrl = (
    override?.upstreamBaseUrl ??
    process.env.KALP_UPSTREAM_BASE_URL ??
    ''
  ).trim();
  const tenantDb = (
    override?.tenantDb ??
    process.env.KALP_TENANT_DB ??
    process.env.KALP_TENANT_ID ??
    ''
  ).trim();
  const serverApiCredential = (
    override?.serverApiCredential ??
    process.env.KALP_SERVER_API_CREDENTIAL ??
    ''
  ).trim();

  if (!upstreamBaseUrl || !tenantDb) {
    return null;
  }

  return {
    upstreamBaseUrl,
    tenantDb,
    serverApiCredential: serverApiCredential || undefined,
    timeoutMs: override?.timeoutMs ?? 6000,
    fetchImpl: override?.fetchImpl,
  };
}

export interface UpstreamKalpConfigStatus {
  upstreamConfigured: boolean;
  liveKalpConnected: boolean;
  reason: string;
}

export function getKalpUpstreamStatus(
  override?: Partial<KalpUpstreamEnvironmentConfig>
): UpstreamKalpConfigStatus {
  const env = resolveUpstreamEnv(override);

  if (!env) {
    return {
      upstreamConfigured: false,
      liveKalpConnected: false,
      reason:
        'Kalp Business Core upstream environment (KALP_UPSTREAM_BASE_URL and server-owned KALP_TENANT_DB / KALP_TENANT_ID) is not configured on the storefront BFF. Refusing to serve fabricated live catalog or checkout data.',
    };
  }

  return {
    upstreamConfigured: true,
    liveKalpConnected: false,
    reason:
      'Kalp upstream contract adapter is configured for verified public catalog and multi-step guest order access. Unconfirmed customer-care and checkout mutation contracts remain gated with honest 503 UPSTREAM_UNAVAILABLE.',
  };
}

function sendStorefrontError(req: Request, res: Response, err: unknown): void {
  const correlationId = String(res.getHeader('X-Correlation-Id') || resolveCorrelationId(req, res));
  if (isStorefrontError(err)) {
    const status = err.statusCode ?? 500;
    res.status(status).json({
      error: {
        code: err.code,
        message: err.message,
        recoverable: err.recoverable,
        correlationId: err.correlationId || correlationId,
        fieldIssues: err.fieldIssues,
        latestCartRevision: err.latestCartRevision,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: 'Storefront BFF encountered an unexpected internal error.',
      recoverable: true,
      correlationId,
    },
  });
}

function respondUpstreamUnavailable(
  req: Request,
  res: Response,
  override?: Partial<KalpUpstreamEnvironmentConfig>,
  customReason?: string
): void {
  const status = getKalpUpstreamStatus(override);
  const correlationId = String(res.getHeader('X-Correlation-Id') || resolveCorrelationId(req, res));
  res.status(503).json({
    error: {
      code: 'UPSTREAM_UNAVAILABLE',
      message: customReason || status.reason,
      recoverable: true,
      correlationId,
    },
  });
}

function requireIdempotencyKey(req: Request, res: Response): string | null {
  const raw = req.headers['idempotency-key'];
  const headerVal = Array.isArray(raw) ? raw[0] : raw;
  const bodyVal =
    req.body && typeof req.body === 'object' && typeof req.body.idempotencyKey === 'string'
      ? req.body.idempotencyKey
      : undefined;
  const key = (headerVal || bodyVal || '').trim();

  if (!key || !/^[a-zA-Z0-9._:-]{6,128}$/.test(key)) {
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Every BFF mutation requires a valid Idempotency-Key header (6–128 chars).',
        recoverable: true,
        correlationId,
      },
    });
    return null;
  }
  return key;
}

export function createStorefrontBffRouter(options?: StorefrontBffRouterOptions): Router {
  const router = express.Router();
  const serverProofStore = new Map<string, ServerStoredOrderProof>();

  router.use(express.json({ limit: '64kb' }));

  // Standard BFF security headers, correlation ID, session cookie, forbidden header guard, and mutation idempotency guard
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const correlationId = resolveCorrelationId(req, res);
    const sessionId = ensureSessionCookie(req, res);
    (req as Request & { sfSessionId?: string; sfCorrelationId?: string }).sfSessionId = sessionId;
    (req as Request & { sfSessionId?: string; sfCorrelationId?: string }).sfCorrelationId =
      correlationId;

    // 1. Reject any browser attempt to inject tenant/database, admin, auth, proof, or upstream routing headers
    for (const forbidden of FORBIDDEN_CLIENT_HEADERS) {
      if (req.headers[forbidden] !== undefined) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Client header "${forbidden}" is forbidden. Tenant routing, authorization, and order proofs are strictly server-controlled.`,
            recoverable: false,
            correlationId,
          },
        });
        return;
      }
    }

    // 2. Enforce Idempotency-Key on every mutation method (POST, PATCH, PUT, DELETE)
    const method = req.method.toUpperCase();
    if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      const idemKey = requireIdempotencyKey(req, res);
      if (!idemKey) {
        return;
      }
    }

    next();
  });

  router.get('/health', (_req, res) => {
    const status = getKalpUpstreamStatus(options?.upstreamEnvOverride);
    res.status(200).json({
      status: 'ok',
      service: 'gayraa-storefront-bff',
      version: 'v1',
      upstreamConfigured: status.upstreamConfigured,
      liveKalpConnected: status.liveKalpConnected,
    });
  });

  router.get('/capabilities', (_req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    const caps = buildStorefrontCapabilities('connected');
    if (env) {
      caps.orderLookupEnabled = true;
    }
    res.status(200).json(caps);
  });

  router.get('/config', (_req, res) => {
    res.status(200).json(GAYRAA_STOREFRONT_CONFIG);
  });

  router.get('/navigation', (_req, res) => {
    res.status(200).json(GAYRAA_NAVIGATION);
  });

  // ---------------------------------------------------------------------------
  // Verified Catalog & Merchandising Adapter Routes
  // ---------------------------------------------------------------------------
  router.get('/home', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'GET',
        path: '/api/v1/storefront/home',
        correlationId,
      });
      const manifest = translateKalpHomePageEnvelope(envelope, correlationId);
      res.status(200).json(manifest);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  router.get('/collections', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'GET',
        path: '/api/v1/storefront/collections',
        correlationId,
      });
      const collections = translateKalpCollectionsEnvelope(envelope, correlationId);
      res.status(200).json(collections);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  router.get('/collections/:slug', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    const slug = String(req.params.slug || 'all');
    const qsIdx = req.originalUrl.indexOf('?');
    const qs = qsIdx >= 0 ? req.originalUrl.slice(qsIdx) : '';
    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'GET',
        path: `/api/v1/storefront/collections/${encodeURIComponent(slug)}${qs}`,
        correlationId,
      });
      const result = translateKalpCollectionResultEnvelope(envelope, slug, correlationId);
      res.status(200).json(result);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  router.get('/search', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    const qsIdx = req.originalUrl.indexOf('?');
    const qs = qsIdx >= 0 ? req.originalUrl.slice(qsIdx) : '';
    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'GET',
        path: `/api/v1/storefront/search${qs}`,
        correlationId,
      });
      const result = translateKalpCollectionResultEnvelope(envelope, 'search', correlationId);
      res.status(200).json(result);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  router.get('/products/:slug', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    const slug = String(req.params.slug || '');
    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'GET',
        path: `/api/v1/storefront/products/${encodeURIComponent(slug)}`,
        correlationId,
      });
      const product = translateKalpProductDetailEnvelope(envelope, correlationId);
      res.status(200).json(product);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // Multi-Step Guest Order Access (Challenge -> Verify -> Server-Held Proof -> Order Detail)
  // ---------------------------------------------------------------------------
  router.post('/orders/lookup/challenge', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;

    const orderReference =
      typeof req.body?.orderReference === 'string' ? req.body.orderReference.trim().toUpperCase() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!orderReference || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid orderReference and email are required to initiate a guest order challenge.',
          recoverable: true,
          correlationId,
        },
      });
      return;
    }

    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'POST',
        path: '/api/v1/storefront/orders/guest-challenge',
        correlationId,
        idempotencyKey,
        body: { orderReference, email },
      });
      const result = translateKalpGuestChallengeEnvelope(
        envelope,
        orderReference,
        email,
        correlationId
      );
      res.status(200).json(result);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  router.post('/orders/lookup/verify', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    const sessionId =
      (req as Request & { sfSessionId?: string }).sfSessionId || ensureSessionCookie(req, res);
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;

    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
    const orderReference =
      typeof req.body?.orderReference === 'string' ? req.body.orderReference.trim().toUpperCase() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!challengeId || !orderReference || !email || !code) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'challengeId, orderReference, email, and verification code are required.',
          recoverable: true,
          correlationId,
        },
      });
      return;
    }

    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'POST',
        path: '/api/v1/storefront/orders/guest-verify',
        correlationId,
        idempotencyKey,
        body: { challengeId, orderReference, email, code },
      });
      const { publicResult, serverOnlyProofToken, expiresAtMs } = translateKalpGuestVerifyEnvelope(
        envelope,
        orderReference,
        correlationId
      );

      // Store short-lived proof strictly server-side bound to (sessionId, tenantDb, orderReference)
      const compositeProofKey = `${sessionId}::${env.tenantDb}::${orderReference}`;
      serverProofStore.set(compositeProofKey, {
        sessionId,
        tenantDb: env.tenantDb,
        orderReference,
        email,
        proofToken: serverOnlyProofToken,
        expiresAtMs,
      });

      res.status(200).json(publicResult);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  router.get('/orders/lookup/:orderReference', async (req, res) => {
    const env = resolveUpstreamEnv(options?.upstreamEnvOverride);
    if (!env) {
      respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride);
      return;
    }
    const correlationId = String(res.getHeader('X-Correlation-Id') || '');
    const sessionId =
      (req as Request & { sfSessionId?: string }).sfSessionId || ensureSessionCookie(req, res);
    const requestedOrderRef = String(req.params.orderReference || '')
      .trim()
      .toUpperCase();

    const compositeProofKey = `${sessionId}::${env.tenantDb}::${requestedOrderRef}`;
    const storedProof = serverProofStore.get(compositeProofKey);

    if (!storedProof) {
      // Check if this session has a proof for a different order or different tenant
      let hasOtherOrderProofInSession = false;
      for (const proof of serverProofStore.values()) {
        if (proof.sessionId === sessionId) {
          hasOtherOrderProofInSession = true;
          break;
        }
      }

      if (hasOtherOrderProofInSession) {
        sendStorefrontError(
          req,
          res,
          new StorefrontError({
            code: 'FORBIDDEN',
            message: `Order proof isolation enforced: Your verified session proof is not valid for order "${requestedOrderRef}" or active tenant.`,
            statusCode: 403,
            correlationId,
            recoverable: true,
          })
        );
        return;
      }

      sendStorefrontError(
        req,
        res,
        new StorefrontError({
          code: 'UNAUTHORIZED',
          message: `Guest order verification required before viewing order "${requestedOrderRef}".`,
          statusCode: 401,
          correlationId,
          recoverable: true,
        })
      );
      return;
    }

    if (
      storedProof.tenantDb !== env.tenantDb ||
      storedProof.orderReference !== requestedOrderRef ||
      storedProof.sessionId !== sessionId
    ) {
      sendStorefrontError(
        req,
        res,
        new StorefrontError({
          code: 'FORBIDDEN',
          message: 'Tenant or order proof isolation violation.',
          statusCode: 403,
          correlationId,
          recoverable: true,
        })
      );
      return;
    }

    if (Date.now() > storedProof.expiresAtMs) {
      serverProofStore.delete(compositeProofKey);
      sendStorefrontError(
        req,
        res,
        new StorefrontError({
          code: 'SESSION_EXPIRED',
          message: `Verification proof for order "${requestedOrderRef}" has expired. Please re-verify.`,
          statusCode: 440,
          correlationId,
          recoverable: true,
        })
      );
      return;
    }

    try {
      const client = new KalpUpstreamClient(env);
      const envelope = await client.requestEnvelope({
        method: 'GET',
        path: `/api/v1/storefront/orders/${encodeURIComponent(requestedOrderRef)}`,
        correlationId,
        orderAccessProofToken: storedProof.proofToken,
      });
      const orderDetail = translateKalpOrderDetailEnvelope(envelope, correlationId);
      res.status(200).json(orderDetail);
    } catch (err) {
      sendStorefrontError(req, res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // Unconfirmed / Pending Stage B Upstream Contracts (Honest 503 Unavailable)
  // ---------------------------------------------------------------------------
  router.get('/products/:productId/reviews', (req, res) =>
    respondUpstreamUnavailable(
      req,
      res,
      options?.upstreamEnvOverride,
      'Kalp product reviews upstream contract is not yet confirmed for connected mode.'
    )
  );

  // Cart & Checkout endpoints (awaiting verified Kalp cart/quote/payment-intent upstream contract)
  router.get('/cart', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.post('/cart/items', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.patch('/cart/items/:lineItemId', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.delete('/cart/items/:lineItemId', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.post('/checkout/quote', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.post('/orders', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );

  // Customer Care & Account endpoints (awaiting confirmed Kalp customer care & OTP session contracts)
  router.post('/support/inquiries', (req, res) =>
    respondUpstreamUnavailable(
      req,
      res,
      options?.upstreamEnvOverride,
      'Kalp support inquiry upstream contract is not yet confirmed for connected mode. Please contact gayraabysnm@gmail.com or +91 7300006707 directly.'
    )
  );
  router.get('/exchanges/eligibility', (req, res) =>
    respondUpstreamUnavailable(
      req,
      res,
      options?.upstreamEnvOverride,
      'Kalp self-serve 3-day exchange eligibility upstream contract is not yet confirmed for connected mode.'
    )
  );
  router.post('/exchanges', (req, res) =>
    respondUpstreamUnavailable(
      req,
      res,
      options?.upstreamEnvOverride,
      'Kalp self-serve 3-day exchange request upstream contract is not yet confirmed for connected mode.'
    )
  );

  router.get('/customer/session', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.get('/customer/orders', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.get('/customer/orders/:orderId', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.get('/customer/addresses', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );
  router.get('/customer/saved', (req, res) =>
    respondUpstreamUnavailable(req, res, options?.upstreamEnvOverride)
  );

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
