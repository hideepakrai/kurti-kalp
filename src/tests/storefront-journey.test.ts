/**
 * Comprehensive Automated Verification Suite for GAYRAA / Kurti Kalp Storefront (Fourth Revision):
 * 1. Domain Money Minor-Unit & URL Query Sanitization Unit Tests
 * 2. Explicit Runtime Modes (demo, connected, unavailable) & UnavailableStorefrontConnector Honesty Tests
 * 3. HttpStorefrontConnector Contract Tests:
 *    - Same-origin enforcement & credentials: 'include'
 *    - Context-aware GET deduplication (merges identical context, separates distinct correlationId/signal)
 *    - Safe GET-only transient retry & zero retry for POST/PATCH/DELETE mutations
 *    - Mandatory Idempotency-Key header on every implemented mutation
 * 4. Express Storefront BFF (/api/storefront/v1/*) Security & Kalp Contract Adapter Tests:
 *    - Forbidden client header rejection (tenant, database, admin, auth, proof, routing headers)
 *    - Missing Idempotency-Key rejection on BFF mutations
 *    - Unavailable upstream returning typed 503 UPSTREAM_UNAVAILABLE without demo fallback
 *    - Server-owned tenant routing (strict outbound allowlist) & Kalp { data } envelope translation
 *    - Malformed upstream response handling (502 BAD_GATEWAY)
 *    - Guest challenge -> verification -> server-held proof -> protected order access
 *    - Tenant, session, and order proof isolation (401 / 403)
 * 5. End-to-End Demo Mode Customer Journeys & Customer Care Adapters
 * 6. Accessibility Contrast & Browser Security Boundary Audit
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createStorefrontBffRouter, FORBIDDEN_CLIENT_HEADERS } from '../../server/storefront-bff';
import { buildStorefrontCapabilities } from '../config/storefront';
import {
  composeStorefrontConnector,
  HttpStorefrontConnector,
  UnavailableStorefrontConnector,
} from '../connector';
import { StorefrontError } from '../domain/errors';
import { assertValidMoney, createMoney, formatMoney } from '../domain/money';
import { sanitizeCollectionSearchParams } from '../pages/CollectionPage';
import { LocalMockStorefrontConnector } from '../testing/mock-connector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runTests() {
  console.log('Running Kurti Kalp / GAYRAA Storefront Fourth Revision Verification Suite...');

  // ---------------------------------------------------------------------------
  // 1. Unit Tests: Money Minor-Unit Domain & URL Query Sanitization
  // ---------------------------------------------------------------------------
  const validMoney = createMoney(349000, 'INR', 2);
  assertValidMoney(validMoney);
  assert(formatMoney(validMoney).includes('3,490'), 'Money formats minor units accurately');

  let floatRejected = false;
  try {
    createMoney(3490.5, 'INR', 2);
  } catch {
    floatRejected = true;
  }
  assert(floatRejected, 'createMoney rejects non-integer float amounts');

  const dirtyParams = new URLSearchParams(
    'q=' +
      'a'.repeat(160) +
      '&page=-12&maxPrice=notanumber&sort=INVALID_SORT&inStock=invalid&sizes=S,M'
  );
  const sanitized = sanitizeCollectionSearchParams(dirtyParams);
  assert(sanitized.hadInvalidParams === true, 'Detects malformed URL query parameters');
  assert(sanitized.page === 1, 'Negative page falls back safely to page 1');
  assert(sanitized.maxPriceMinor === undefined, 'Non-numeric maxPrice is safely ignored');
  assert(sanitized.sort === 'FEATURED', 'Unknown sort option falls back to FEATURED');
  assert(sanitized.q.length === 120, 'Overly long search query is clamped to 120 chars');
  assert(sanitized.sizes.join(',') === 'S,M', 'Valid size filters are preserved');
  console.log('✓ 1. Domain Money & URL query sanitization unit tests passed');

  // ---------------------------------------------------------------------------
  // 2. Explicit Modes & UnavailableStorefrontConnector Honesty Tests
  // ---------------------------------------------------------------------------
  const demoCaps = buildStorefrontCapabilities('demo');
  const connectedCaps = buildStorefrontCapabilities('connected');
  const unavailableCaps = buildStorefrontCapabilities('unavailable');

  assert(demoCaps.mode === 'demo' && demoCaps.liveKalpConnected === false, 'Demo mode capabilities honest');
  assert(
    connectedCaps.mode === 'connected' && connectedCaps.liveKalpConnected === false,
    'Connected mode does not claim live Kalp connection prematurely'
  );
  assert(
    unavailableCaps.mode === 'unavailable' &&
      !unavailableCaps.cartEnabled &&
      !unavailableCaps.searchEnabled,
    'Unavailable mode disables commerce capabilities cleanly'
  );

  const composedUnavailable = await composeStorefrontConnector('unavailable');
  assert(
    composedUnavailable.effectiveMode === 'unavailable' &&
      composedUnavailable.connector instanceof UnavailableStorefrontConnector,
    'composeStorefrontConnector returns UnavailableStorefrontConnector for unavailable mode'
  );

  let unavailableThrew = false;
  try {
    await composedUnavailable.connector.getHomePage();
  } catch (err) {
    unavailableThrew = err instanceof StorefrontError && err.code === 'UPSTREAM_UNAVAILABLE';
  }
  assert(
    unavailableThrew,
    'UnavailableStorefrontConnector throws UPSTREAM_UNAVAILABLE instead of fake data'
  );
  console.log('✓ 2. Explicit modes & UnavailableStorefrontConnector honesty tests passed');

  // ---------------------------------------------------------------------------
  // 3. HttpStorefrontConnector Contract Tests (Context-Aware Dedup, No Mutation Retry, Idempotency Keys)
  // ---------------------------------------------------------------------------
  let externalOriginRejected = false;
  try {
    new HttpStorefrontConnector({ basePath: 'https://external-kalp.example.com/api' });
  } catch {
    externalOriginRejected = true;
  }
  assert(externalOriginRejected, 'HttpStorefrontConnector rejects non-same-origin base paths');

  // 3a. Context-aware GET deduplication: merges identical context, does NOT merge distinct correlationId contexts
  let getCallCount = 0;
  let lastInit: RequestInit | undefined;
  const dedupConnector = new HttpStorefrontConnector({
    basePath: '/api/storefront/v1',
    fetchImpl: async (_input, init) => {
      getCallCount += 1;
      lastInit = init;
      await new Promise((r) => setTimeout(r, 15));
      return new Response(JSON.stringify(buildStorefrontCapabilities('connected')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await Promise.all([dedupConnector.getCapabilities(), dedupConnector.getCapabilities()]);
  assert(
    getCallCount === 1,
    'HttpStorefrontConnector deduplicates concurrent GETs with identical default context'
  );
  assert(
    lastInit?.credentials === 'include',
    'HttpStorefrontConnector always uses credentials: include'
  );

  getCallCount = 0;
  await Promise.all([
    dedupConnector.getCapabilities({ correlationId: 'ctx_alpha_001' }),
    dedupConnector.getCapabilities({ correlationId: 'ctx_beta_002' }),
  ]);
  assert(
    getCallCount === 2,
    'HttpStorefrontConnector does NOT merge concurrent GET requests with different correlationId contexts'
  );

  // 3b. Safe retry for GET vs. NO retry for POST/PATCH/DELETE mutations
  let getRetryAttempts = 0;
  const getRetryConnector = new HttpStorefrontConnector({
    basePath: '/api/storefront/v1',
    maxReadRetries: 1,
    retryDelayMs: 5,
    fetchImpl: async () => {
      getRetryAttempts += 1;
      if (getRetryAttempts === 1) {
        return new Response(
          JSON.stringify({ error: { code: 'BAD_GATEWAY', message: 'Transient 502' } }),
          { status: 502, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(buildStorefrontCapabilities('connected')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await getRetryConnector.getCapabilities();
  assert(getRetryAttempts === 2, 'HttpStorefrontConnector retries transient 502 on idempotent GET');

  const mutationMethodsAttempted: string[] = [];
  const recordedIdempotencyKeys: string[] = [];
  const mutationConnector = new HttpStorefrontConnector({
    basePath: '/api/storefront/v1',
    maxReadRetries: 2,
    retryDelayMs: 5,
    fetchImpl: async (_input, init) => {
      const method = (init?.method || 'GET').toUpperCase();
      mutationMethodsAttempted.push(method);
      const headers = (init?.headers || {}) as Record<string, string>;
      if (headers['Idempotency-Key']) {
        recordedIdempotencyKeys.push(headers['Idempotency-Key']);
      }
      return new Response(
        JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'Transient 502 on mutation' } }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    },
  });

  // Exercise all implemented mutations to verify 1) zero automatic retries and 2) Idempotency-Key header presence
  const mutationCalls: Array<() => Promise<unknown>> = [
    () => mutationConnector.addCartItem({ productId: 'p1', variantId: 'v1', quantity: 1 }),
    () => mutationConnector.updateCartItem({ lineItemId: 'l1', quantity: 2 }),
    () => mutationConnector.removeCartItem({ lineItemId: 'l1' }),
    () => mutationConnector.getCheckoutQuote({ cartRevision: 'rev_1' }),
    () =>
      mutationConnector.createOrder({
        idempotencyKey: 'idem_order_explicit_01',
        quoteId: 'q1',
        cartRevision: 'rev_1',
        contact: { fullName: 'A', email: 'a@example.com', phone: '9876543210' },
        shippingAddress: {
          recipientName: 'A',
          line1: '12 Jaipur Gate',
          city: 'Jaipur',
          state: 'RJ',
          postalCode: '302029',
          countryCode: 'IN',
        },
        billingSameAsShipping: true,
        shippingMethodId: 'ship-standard-free',
        paymentMethodCode: 'PREPAID_INTENT',
      }),
    () =>
      mutationConnector.createGuestOrderChallenge({
        orderReference: 'GAY-1041',
        email: 'a@example.com',
      }),
    () =>
      mutationConnector.verifyGuestOrderChallenge({
        challengeId: 'chal_1',
        orderReference: 'GAY-1041',
        email: 'a@example.com',
        code: '123456',
      }),
    () =>
      mutationConnector.submitSupportInquiry({
        fullName: 'A',
        email: 'a@example.com',
        topic: 'GENERAL',
        message: 'Test support message',
      }),
    () =>
      mutationConnector.submitExchangeRequest({
        orderReference: 'GAY-1041',
        email: 'a@example.com',
        reason: 'SIZE_FIT_ISSUE',
        confirmedWithin3Days: true,
        confirmedUnusedWithTags: true,
        confirmedCustomerReturnShipping: true,
      }),
  ];

  for (const call of mutationCalls) {
    let failedOnce = false;
    try {
      await call();
    } catch {
      failedOnce = true;
    }
    assert(failedOnce, 'Mutation surfaces failure immediately');
  }

  assert(
    mutationMethodsAttempted.length === mutationCalls.length,
    `Every POST/PATCH/DELETE mutation executed exactly once with zero automatic retries (${mutationMethodsAttempted.length}/${mutationCalls.length})`
  );
  assert(
    recordedIdempotencyKeys.length === mutationCalls.length &&
      recordedIdempotencyKeys.every((k) => k.length >= 6),
    'Every implemented mutation sends a valid Idempotency-Key header'
  );
  console.log('✓ 3. HttpStorefrontConnector contract tests (context-aware dedup, no mutation retry, idempotency keys) passed');

  // ---------------------------------------------------------------------------
  // 4. Express BFF Security, Outbound Allowlist, Envelope Translation & Guest Proof Isolation Tests
  // ---------------------------------------------------------------------------
  // 4a. Unconfigured upstream returns 503 UPSTREAM_UNAVAILABLE and rejects all forbidden client headers
  const unconfiguredApp = express();
  unconfiguredApp.use('/api/storefront/v1', createStorefrontBffRouter());
  const unconfiguredServer = http.createServer(unconfiguredApp);
  await new Promise<void>((resolve) => unconfiguredServer.listen(0, '127.0.0.1', () => resolve()));
  const unconfPort = (unconfiguredServer.address() as { port: number }).port;
  const unconfOrigin = `http://127.0.0.1:${unconfPort}`;

  try {
    for (const forbiddenHeader of FORBIDDEN_CLIENT_HEADERS) {
      const res = await fetch(`${unconfOrigin}/api/storefront/v1/config`, {
        headers: { [forbiddenHeader]: 'malicious-client-override' },
      });
      assert(
        res.status === 400,
        `BFF rejects forbidden browser header "${forbiddenHeader}" with HTTP 400`
      );
    }

    // Mutation without Idempotency-Key is rejected by BFF with HTTP 400
    const missingIdemRes = await fetch(`${unconfOrigin}/api/storefront/v1/orders/lookup/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderReference: 'GAY-1041', email: 'a@example.com' }),
    });
    assert(
      missingIdemRes.status === 400,
      'BFF rejects POST mutation missing Idempotency-Key header with HTTP 400'
    );

    // Unconfigured upstream returns 503 UPSTREAM_UNAVAILABLE without demo fallback
    const home503Res = await fetch(`${unconfOrigin}/api/storefront/v1/home`);
    assert(
      home503Res.status === 503,
      'Unconfigured BFF /home returns 503 UPSTREAM_UNAVAILABLE without demo fallback'
    );
  } finally {
    await new Promise<void>((resolve) => unconfiguredServer.close(() => resolve()));
  }

  // 4b. Configured BFF with mock Kalp upstream: verify server-owned tenant routing, { data } envelope translation,
  //     malformed upstream handling, and guest challenge -> verify -> proof-isolated order access
  const capturedUpstreamCalls: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
  }> = [];
  let simulateMalformedProductEnvelope = false;

  const mockKalpUpstreamFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    const headers = (init?.headers || {}) as Record<string, string>;
    capturedUpstreamCalls.push({ url, method, headers });

    if (url.endsWith('/api/v1/storefront/collections')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'kalp-col-anarkali',
              slug: 'anarkali-suit-sets',
              title: 'Kalp Live Anarkali Sets',
              description: 'Authoritative Kalp collection',
              kind: 'CATEGORY',
            },
          ],
          meta: { total: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/api/v1/storefront/products/')) {
      if (simulateMalformedProductEnvelope) {
        return new Response(
          JSON.stringify({ wrongRootKey: 'missing_data_envelope' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          data: {
            id: 'kalp-prod-1',
            slug: 'kalp-chanderi-kurta',
            title: 'Kalp Authoritative Chanderi Kurta Set',
            categorySlug: 'kurta-sets',
            categoryName: 'Kurta Sets',
            fabricTag: 'Chanderi Silk',
            setSummary: '3-Piece Set',
            startingPrice: { amountMinor: 459000, currency: 'INR', minorUnitDigits: 2 },
            availability: 'IN_STOCK',
            availableSizes: ['S', 'M'],
            primaryImage: {
              id: 'img-1',
              url: '/assets/demo/product-kurta-emerald-1.svg',
              alt: 'Chanderi Kurta',
              width: 900,
              height: 1200,
              aspectRatio: '3:4',
            },
            occasions: ['festive'],
            isNewArrival: true,
            isBestSeller: false,
            description: 'Translated from Kalp { data } envelope.',
            optionDefinitions: [{ id: 'opt-size', name: 'Size', values: ['S', 'M'] }],
            variants: [
              {
                id: 'kalp-var-s',
                sku: 'KALP-KUR-S',
                title: 'Size S',
                selectedOptions: { Size: 'S' },
                price: { amountMinor: 459000, currency: 'INR', minorUnitDigits: 2 },
                availability: 'IN_STOCK',
                stockQty: 7,
              },
            ],
            measurements: [
              {
                size: 'S',
                bustInches: '36"',
                waistInches: '32"',
                hipInches: '38"',
                garmentLengthInches: '46"',
              },
            ],
            specifications: {
              fabric: 'Chanderi Silk',
              craftTechnique: 'Zari Weave',
              setInclusions: ['Kurta', 'Trousers', 'Dupatta'],
              silhouetteNote: 'Straight Cut',
              washCare: 'Dry clean only',
              origin: 'Jaipur, India',
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/v1/storefront/orders/guest-challenge') && method === 'POST') {
      return new Response(
        JSON.stringify({
          data: {
            challengeId: 'kalp_chal_9901',
            maskedEmail: 'an***@example.com',
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            // Even if upstream accidentally includes secret fields, adapter must strip them:
            otpSecretLeakTest: '999999',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/v1/storefront/orders/guest-verify') && method === 'POST') {
      return new Response(
        JSON.stringify({
          data: {
            verified: true,
            proofToken: 'srv_secret_proof_token_kalp_1041',
            proofExpiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/v1/storefront/orders/GAY-KALP-1041') && method === 'GET') {
      if (headers['X-Order-Access-Proof'] !== 'srv_secret_proof_token_kalp_1041') {
        return new Response(JSON.stringify({ error: 'Missing server proof' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          data: {
            orderId: 'kalp_ord_1041',
            orderReference: 'GAY-KALP-1041',
            createdAt: '2026-10-20T12:00:00.000Z',
            idempotencyKey: 'idem_1041',
            quoteId: 'qt_1041',
            orderStatus: 'CONFIRMED',
            paymentStatus: 'PENDING_PAYMENT_INTENT_HANDOFF',
            paymentMethodCode: 'PREPAID_INTENT',
            paymentAction: {
              type: 'PROVIDER_INTENT_PLACEHOLDER',
              summary: 'Prepaid Intent',
              nextStepInstruction: 'Complete payment',
              intentReference: 'pi_1041',
            },
            contact: {
              fullName: 'Ananya Sharma',
              email: 'ananya.demo@example.com',
              phone: '9876543210',
            },
            shippingAddress: {
              recipientName: 'Ananya Sharma',
              line1: '14 C-Scheme',
              city: 'Jaipur',
              state: 'Rajasthan',
              postalCode: '302001',
              countryCode: 'IN',
            },
            shippingMethod: {
              id: 'ship-standard-free',
              title: 'Free Standard Shipping',
              dispatchEstimate: '48h',
              transitEstimate: '5-7d',
              fee: { amountMinor: 0, currency: 'INR', minorUnitDigits: 2 },
              eligible: true,
            },
            items: [],
            totals: {
              itemsSubtotal: { amountMinor: 459000, currency: 'INR', minorUnitDigits: 2 },
              discountTotal: { amountMinor: 0, currency: 'INR', minorUnitDigits: 2 },
              shippingFee: { amountMinor: 0, currency: 'INR', minorUnitDigits: 2 },
              taxTotal: { amountMinor: 49179, currency: 'INR', minorUnitDigits: 2 },
              payableTotal: { amountMinor: 459000, currency: 'INR', minorUnitDigits: 2 },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };

  let activeTenantDb = 'gayraa_tenant_alpha';
  const configuredApp = express();
  configuredApp.use('/api/storefront/v1', (req, res, next) =>
    createStorefrontBffRouter({
      upstreamEnvOverride: {
        upstreamBaseUrl: 'https://kalp-upstream.internal.example',
        tenantDb: activeTenantDb,
        serverApiCredential: 'kalp_srv_secret_key_99',
        fetchImpl: mockKalpUpstreamFetch,
      },
    })(req, res, next)
  );

  // Better: mount a single router instance so its serverProofStore persists across requests, while reading process.env.KALP_TENANT_DB dynamically!
  process.env.KALP_UPSTREAM_BASE_URL = 'https://kalp-upstream.internal.example';
  process.env.KALP_TENANT_DB = 'gayraa_tenant_alpha';
  process.env.KALP_SERVER_API_CREDENTIAL = 'kalp_srv_secret_key_99';

  const statefulBffApp = express();
  statefulBffApp.use(
    '/api/storefront/v1',
    createStorefrontBffRouter({
      upstreamEnvOverride: {
        fetchImpl: mockKalpUpstreamFetch,
      },
    })
  );
  const statefulServer = http.createServer(statefulBffApp);
  await new Promise<void>((resolve) => statefulServer.listen(0, '127.0.0.1', () => resolve()));
  const statefulPort = (statefulServer.address() as { port: number }).port;
  const statefulOrigin = `http://127.0.0.1:${statefulPort}`;

  try {
    let sessionCookie = '';
    const sessionFetch: typeof fetch = async (input, init) => {
      const targetUrl = `${statefulOrigin}${String(input)}`;
      const headers = new Headers(init?.headers || {});
      if (sessionCookie) {
        headers.set('Cookie', sessionCookie);
      }
      const res = await fetch(targetUrl, { ...init, headers });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        sessionCookie = setCookie.split(';')[0];
      }
      return res;
    };

    const connectedConnector = new HttpStorefrontConnector({
      basePath: '/api/storefront/v1',
      maxReadRetries: 0,
      fetchImpl: sessionFetch,
    });

    // Verify Kalp { data } envelope translation & server-owned tenant routing
    const collections = await connectedConnector.getCollections();
    assert(
      collections.length === 1 &&
        collections[0].slug === 'anarkali-suit-sets' &&
        collections[0].isDemoFixture === false,
      'BFF translates Kalp { data } collections envelope into CollectionMetadata[]'
    );

    const lastUpstreamCall = capturedUpstreamCalls[capturedUpstreamCalls.length - 1];
    assert(
      lastUpstreamCall.headers['X-Tenant-DB'] === 'gayraa_tenant_alpha' &&
        lastUpstreamCall.headers.Authorization === 'Bearer kalp_srv_secret_key_99',
      'BFF sends server-owned X-Tenant-DB and Authorization headers via strict outbound allowlist'
    );

    const productDetail = await connectedConnector.getProduct({ slug: 'kalp-chanderi-kurta' });
    assert(
      productDetail.startingPrice.amountMinor === 459000 &&
        productDetail.variants[0].availability === 'IN_STOCK' &&
        productDetail.isDemoFixture === false,
      'BFF translates Kalp { data } product detail envelope with authoritative minor-unit price and availability'
    );

    // Verify malformed upstream response handling (missing { data } envelope -> 502 BAD_GATEWAY)
    simulateMalformedProductEnvelope = true;
    let malformedCaught = false;
    try {
      await connectedConnector.getProduct({ slug: 'malformed-product' });
    } catch (err) {
      malformedCaught =
        err instanceof StorefrontError && err.code === 'BAD_GATEWAY' && err.statusCode === 502;
    }
    simulateMalformedProductEnvelope = false;
    assert(
      malformedCaught,
      'Malformed upstream response (missing { data } envelope) is rejected with 502 BAD_GATEWAY'
    );

    // Verify Multi-Step Guest Order Access:
    // Attempting to fetch order detail BEFORE challenge/verify must fail with 401 UNAUTHORIZED
    let unverifiedBlocked = false;
    try {
      await connectedConnector.getVerifiedGuestOrder('GAY-KALP-1041');
    } catch (err) {
      unverifiedBlocked =
        err instanceof StorefrontError && err.code === 'UNAUTHORIZED' && err.statusCode === 401;
    }
    assert(
      unverifiedBlocked,
      'Protected guest order detail rejects unverified session with 401 UNAUTHORIZED'
    );

    // Step 1: Create challenge
    const challengeRes = await connectedConnector.createGuestOrderChallenge({
      orderReference: 'GAY-KALP-1041',
      email: 'ananya.demo@example.com',
    });
    assert(
      challengeRes.challengeId === 'kalp_chal_9901' &&
        !('otpSecretLeakTest' in (challengeRes as unknown as Record<string, unknown>)),
      'BFF guest challenge translates envelope and strips any upstream secret fields'
    );

    // Step 2: Verify challenge -> stores proof server-side, never exposes proofToken to browser
    const verifyRes = await connectedConnector.verifyGuestOrderChallenge({
      challengeId: challengeRes.challengeId,
      orderReference: 'GAY-KALP-1041',
      email: 'ananya.demo@example.com',
      code: '123456',
    });
    assert(
      verifyRes.verified === true &&
        !('proofToken' in (verifyRes as unknown as Record<string, unknown>)) &&
        !('serverOnlyProofToken' in (verifyRes as unknown as Record<string, unknown>)),
      'BFF guest verification keeps proofToken strictly server-side and never returns it to browser'
    );

    // Step 3: Access protected order detail for the verified order GAY-KALP-1041
    const verifiedOrder = await connectedConnector.getVerifiedGuestOrder('GAY-KALP-1041');
    assert(
      verifiedOrder.orderReference === 'GAY-KALP-1041' &&
        verifiedOrder.totals.payableTotal.amountMinor === 459000,
      'BFF attaches server-held X-Order-Access-Proof upstream and returns translated OrderResult'
    );

    // Proof isolation test 1: Using session proof for GAY-KALP-1041 to request GAY-KALP-9999 must fail with 403 FORBIDDEN
    let crossOrderBlocked = false;
    try {
      await connectedConnector.getVerifiedGuestOrder('GAY-KALP-9999');
    } catch (err) {
      crossOrderBlocked =
        err instanceof StorefrontError && err.code === 'FORBIDDEN' && err.statusCode === 403;
    }
    assert(
      crossOrderBlocked,
      'Order proof isolation blocks access to a different orderReference with 403 FORBIDDEN'
    );

    // Proof isolation test 2: Switching server tenant DB invalidates access for proof issued under gayraa_tenant_alpha
    process.env.KALP_TENANT_DB = 'gayraa_tenant_beta';
    let crossTenantBlocked = false;
    try {
      await connectedConnector.getVerifiedGuestOrder('GAY-KALP-1041');
    } catch (err) {
      crossTenantBlocked =
        err instanceof StorefrontError && err.code === 'FORBIDDEN' && err.statusCode === 403;
    }
    assert(
      crossTenantBlocked,
      'Tenant proof isolation blocks using a proof across different tenant databases with 403 FORBIDDEN'
    );
  } finally {
    delete process.env.KALP_UPSTREAM_BASE_URL;
    delete process.env.KALP_TENANT_DB;
    delete process.env.KALP_SERVER_API_CREDENTIAL;
    await new Promise<void>((resolve) => statefulServer.close(() => resolve()));
  }
  console.log('✓ 4. Express BFF security, outbound allowlist, envelope translation & proof isolation tests passed');

  // ---------------------------------------------------------------------------
  // 5. End-to-End Customer Journeys, Customer Care Adapters & Dynamic Merchandising Slots (Demo Mode)
  // ---------------------------------------------------------------------------
  const connector = new LocalMockStorefrontConnector({ latencyMs: 0, quoteTtlMs: 60_000 });

  const manifest = await connector.getHomePage();
  const sectionTypes = manifest.sections.map((s) => s.type);
  assert(
    sectionTypes.includes('hero') &&
      sectionTypes.includes('editorial-story-block') &&
      sectionTypes.includes('campaign-banner-slot') &&
      sectionTypes.includes('product-collection') &&
      sectionTypes.includes('service-policy-strip'),
    'Homepage manifest includes all dynamic merchandising slots'
  );

  const allCollection = await connector.getCollection({ slug: 'all', pageSize: 20 });
  assert(
    allCollection.totalCount >= 6 && allCollection.products.length === allCollection.totalCount,
    `Catalog has ${allCollection.totalCount} product-specific Jaipur demo fixtures`
  );

  const searchRes = await connector.searchProducts({ q: 'Chanderi' });
  assert(searchRes.totalCount >= 1, 'Search query for Chanderi returns matching products');

  // Variant matrix & Add to Bag
  const sareeProduct = await connector.getProduct({ slug: 'vaani-ivory-zari-tissue-organza-saree' });
  const inStockVariant = sareeProduct.variants.find((v) => v.availability === 'IN_STOCK')!;
  const updatedCart = await connector.addCartItem({
    productId: sareeProduct.id,
    variantId: inStockVariant.id,
    quantity: 1,
    idempotencyKey: 'idem_demo_cart_add_1',
  });
  assert(updatedCart.items.length === 2, 'Cart contains 2 line items after adding saree');

  // Revision conflict detection
  let conflictDetected = false;
  try {
    await connector.updateCartItem({
      lineItemId: updatedCart.items[0].lineItemId,
      quantity: 2,
      expectedRevision: 'rev_stale_0',
      idempotencyKey: 'idem_demo_cart_upd_1',
    });
  } catch (err) {
    conflictDetected = err instanceof StorefrontError && err.code === 'CART_CONFLICT';
  }
  assert(conflictDetected, 'Stale cart revision triggers CART_CONFLICT');

  // Checkout quote expiry & idempotent order creation
  const currentCart = await connector.getCart();
  const quote = await connector.getCheckoutQuote({
    cartRevision: currentCart.revision,
    shippingAddress: {
      postalCode: '302029',
      city: 'Jaipur',
      state: 'Rajasthan',
      countryCode: 'IN',
    },
  });
  assert(quote.totals.shippingFee.amountMinor === 0, 'Standard Pan-India shipping is free');

  connector.expireActiveQuotesNow();
  let expiredQuoteRejected = false;
  try {
    await connector.createOrder({
      idempotencyKey: 'idem_test_expired_01',
      quoteId: quote.quoteId,
      cartRevision: currentCart.revision,
      contact: { fullName: 'Test User', email: 'test@example.com', phone: '9876543210' },
      shippingAddress: {
        recipientName: 'Test User',
        line1: '12 Jaipur Gate, Sanganer',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302029',
        countryCode: 'IN',
      },
      billingSameAsShipping: true,
      shippingMethodId: 'ship-standard-free',
      paymentMethodCode: 'PREPAID_INTENT',
    });
  } catch (err) {
    expiredQuoteRejected = err instanceof StorefrontError && err.code === 'QUOTE_EXPIRED';
  }
  assert(expiredQuoteRejected, 'Expired checkout quote is rejected with QUOTE_EXPIRED');

  const freshQuote = await connector.getCheckoutQuote({
    cartRevision: currentCart.revision,
    shippingAddress: {
      postalCode: '302029',
      city: 'Jaipur',
      state: 'Rajasthan',
      countryCode: 'IN',
    },
  });

  const orderInput = {
    idempotencyKey: 'idem_test_valid_order_99',
    quoteId: freshQuote.quoteId,
    cartRevision: currentCart.revision,
    contact: { fullName: 'Test User', email: 'test@example.com', phone: '9876543210' },
    shippingAddress: {
      recipientName: 'Test User',
      line1: '12 Jaipur Gate, Sanganer',
      city: 'Jaipur',
      state: 'Rajasthan',
      postalCode: '302029',
      countryCode: 'IN',
    },
    billingSameAsShipping: true,
    shippingMethodId: 'ship-standard-free',
    paymentMethodCode: 'PREPAID_INTENT' as const,
  };

  const order1 = await connector.createOrder(orderInput);
  const order2 = await connector.createOrder(orderInput);
  assert(
    order1.orderId === order2.orderId &&
      order1.orderStatus === 'CREATED_DEMO_HOLD' &&
      order1.paymentStatus === 'PENDING_PAYMENT_INTENT_HANDOFF',
    'Idempotent order submission returns identical OrderResult with separated orderStatus and paymentStatus'
  );

  // Multi-Step Guest Order Access in Demo Mode: Challenge -> Verify -> Order Detail & Exchange
  const demoChallenge = await connector.createGuestOrderChallenge({
    orderReference: order1.orderReference,
    email: 'test@example.com',
    idempotencyKey: 'idem_demo_chal_01',
  });
  await connector.verifyGuestOrderChallenge({
    challengeId: demoChallenge.challengeId,
    orderReference: order1.orderReference,
    email: 'test@example.com',
    code: '123456',
    idempotencyKey: 'idem_demo_ver_01',
  });

  const lookedUp = await connector.getVerifiedGuestOrder(order1.orderReference);
  assert(
    lookedUp.orderReference === order1.orderReference,
    '3-step guest order verification retrieves demo order detail'
  );

  // Proof isolation in demo connector: attempting to read GAY-DEMO-1041 using proof for order1 must fail with FORBIDDEN
  let demoCrossOrderBlocked = false;
  try {
    await connector.getVerifiedGuestOrder('GAY-DEMO-1041');
  } catch (err) {
    demoCrossOrderBlocked = err instanceof StorefrontError && err.code === 'FORBIDDEN';
  }
  assert(
    demoCrossOrderBlocked,
    'Demo connector enforces proof isolation across different order references'
  );

  const eligibility = await connector.checkExchangeEligibility({
    orderReference: order1.orderReference,
  });
  assert(
    eligibility.eligible === true &&
      eligibility.windowDays === 3 &&
      eligibility.refundsAllowed === false &&
      eligibility.customerReturnShippingRequired === true,
    '3-day exchange eligibility enforces GAYRAA policy rules'
  );

  const exchangeResult1 = await connector.submitExchangeRequest({
    idempotencyKey: 'idem_demo_exchange_01',
    orderReference: order1.orderReference,
    email: 'test@example.com',
    reason: 'SIZE_FIT_ISSUE',
    replacementSize: 'M',
    confirmedWithin3Days: true,
    confirmedUnusedWithTags: true,
    confirmedCustomerReturnShipping: true,
  });
  const exchangeResult2 = await connector.submitExchangeRequest({
    idempotencyKey: 'idem_demo_exchange_01',
    orderReference: order1.orderReference,
    email: 'test@example.com',
    reason: 'SIZE_FIT_ISSUE',
    replacementSize: 'M',
    confirmedWithin3Days: true,
    confirmedUnusedWithTags: true,
    confirmedCustomerReturnShipping: true,
  });
  assert(
    exchangeResult1.exchangeReference === exchangeResult2.exchangeReference &&
      exchangeResult1.isDemoRecord === true,
    'submitExchangeRequest is idempotent and returns labelled demo exchange record'
  );

  const inquiryResult1 = await connector.submitSupportInquiry({
    idempotencyKey: 'idem_demo_support_01',
    fullName: 'Test User',
    email: 'test@example.com',
    topic: 'EXPRESS_SHIPPING_INQUIRY',
    message: 'Checking 3-day prepaid express delivery for PIN 302001.',
  });
  const inquiryResult2 = await connector.submitSupportInquiry({
    idempotencyKey: 'idem_demo_support_01',
    fullName: 'Test User',
    email: 'test@example.com',
    topic: 'EXPRESS_SHIPPING_INQUIRY',
    message: 'Checking 3-day prepaid express delivery for PIN 302001.',
  });
  assert(
    inquiryResult1.inquiryReference === inquiryResult2.inquiryReference &&
      inquiryResult1.status === 'RECORDED_DEMO_ONLY',
    'submitSupportInquiry is idempotent and returns labelled demo support record'
  );

  console.log('✓ 5. End-to-End customer journeys, multi-step order verification & idempotent customer-care tests passed');

  // ---------------------------------------------------------------------------
  // 6. Accessibility Contrast & Browser Security Boundary Audit
  // ---------------------------------------------------------------------------
  assert(
    contrastRatio('#161311', '#F4F1EA') >= 12,
    'Primary ink on warm stone canvas exceeds WCAG AAA contrast'
  );
  assert(
    contrastRatio('#524B44', '#F4F1EA') >= 4.5,
    'Secondary ink on warm stone canvas exceeds WCAG AA contrast'
  );
  assert(
    contrastRatio('#F4F1EA', '#7A1C1D') >= 4.5,
    'Sindoor maroon CTA contrast exceeds WCAG AA'
  );
  assert(
    contrastRatio('#F4F1EA', '#161311') >= 12,
    'Surface-contrast focus ring (#F4F1EA on #161311) exceeds 3:1 non-text contrast'
  );

  // Verify UI files in src/components, src/pages, and src/integration never import src/testing/*
  // or contain privileged headers, proof tokens, or server credentials
  const uiDirs = ['components', 'pages', 'integration'];
  for (const dir of uiDirs) {
    const fullDir = path.resolve(__dirname, '..', dir);
    const checkDir = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) checkDir(p);
        else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
          const content = fs.readFileSync(p, 'utf8');
          assert(
            !content.includes('testing/mock-connector') && !content.includes('testing/fixtures'),
            `UI module ${p} must not directly import src/testing/*`
          );
          assert(
            !content.includes('X-Tenant-DB') &&
              !content.includes('KALP_SERVER_API_CREDENTIAL') &&
              !content.includes('X-Order-Access-Proof') &&
              !content.includes('KALP_TENANT_DB'),
            `Browser module ${p} must not contain privileged headers, proof headers, or server secrets`
          );
        }
      }
    };
    checkDir(fullDir);
  }
  console.log('✓ 6. WCAG contrast & browser security boundary audit passed');

  console.log('\nALL KURTI KALP / GAYRAA FOURTH REVISION VERIFICATION CHECKS PASSED.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
